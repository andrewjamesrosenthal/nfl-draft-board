import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";
import { gradePicks, overallGrade } from "@/lib/grading";
import { pickForSlot, type MockBoardEntry } from "@/lib/mock-engine";
import { awardEarnedBadges } from "@/lib/badges";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const mock = await db.mockDraft.findUnique({
    where: { id: params.id },
    include: {
      picks: {
        orderBy: { overallPick: "asc" },
        include: { player: true },
      },
    },
  });
  if (!mock) return NextResponse.json({ error: "not found" }, { status: 404 });

  const community = await db.communityRanking.findMany({
    where: { draftYear: mock.draftYear },
    include: { player: true },
  });

  const graded = gradePicks(mock.picks, community);
  const grade = overallGrade(graded);

  return NextResponse.json({ mock, graded, grade });
}

const advanceSchema = z.object({
  overallPick: z.number().int().min(1),
  playerId: z.number().int().nullable(),
  autoAdvance: z.boolean().default(true),
});

// POST advances the mock: either user picks or the CPU fills the next slot.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { id: userId } = await getOrCreateUser();
  const body = await req.json().catch(() => null);
  const parsed = advanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { overallPick, playerId, autoAdvance } = parsed.data;

  const mock = await db.mockDraft.findUnique({
    where: { id: params.id },
    include: {
      picks: {
        orderBy: { overallPick: "asc" },
        include: { player: true },
      },
    },
  });
  if (!mock) return NextResponse.json({ error: "not found" }, { status: 404 });

  const slot = mock.picks.find((p) => p.overallPick === overallPick);
  if (!slot) return NextResponse.json({ error: "no slot" }, { status: 400 });

  // Record the user's pick.
  await db.mockDraftPick.update({
    where: { id: slot.id },
    data: { playerId, byUser: true },
  });

  if (!autoAdvance) {
    return NextResponse.json({ ok: true });
  }

  // CPU auto-advance: pick for remaining slots until we hit the user's team again
  // (SINGLE_TEAM) or until the end (ALL_TEAMS -> user does every pick).
  if (mock.control === "ALL_TEAMS") {
    return NextResponse.json({ ok: true });
  }

  const remaining = mock.picks
    .filter((p) => p.overallPick > overallPick && !p.playerId)
    .sort((a, b) => a.overallPick - b.overallPick);

  const userTeam = mock.userTeamAbbr;
  const board = await loadBoard(userId, mock.boardSource as any, mock.draftYear);
  const alreadyPicked = new Set<number>(
    mock.picks
      .filter((p) => p.playerId != null)
      .map((p) => p.playerId as number),
  );
  if (playerId) alreadyPicked.add(playerId);

  let available = board.filter((b) => !alreadyPicked.has(b.player.id));
  const pickedPositions = new Map<string, number>();

  const teams = await db.team.findMany({
    where: { abbr: { in: remaining.map((r) => r.teamAbbr) } },
    include: { needs: { where: { draftYear: mock.draftYear }, orderBy: { priority: "asc" } } },
  });

  for (const pickRow of remaining) {
    if (mock.control === "SINGLE_TEAM" && pickRow.teamAbbr === userTeam) break;
    const team = teams.find((t) => t.abbr === pickRow.teamAbbr);
    if (!team) continue;
    const slotLike = {
      overall: pickRow.overallPick,
      round: pickRow.round,
      team,
    };
    const decision = pickForSlot(slotLike, available, pickedPositions);
    if (!decision) break;
    await db.mockDraftPick.update({
      where: { id: pickRow.id },
      data: { playerId: decision.playerId, byUser: false },
    });
    const key = team.abbr + ":" + decision.playerPosition;
    pickedPositions.set(key, (pickedPositions.get(key) ?? 0) + 1);
    available = available.filter((b) => b.player.id !== decision.playerId);
  }

  // If nothing remains, mark completed.
  const stillOpen = await db.mockDraftPick.count({
    where: { mockId: mock.id, playerId: null },
  });
  if (stillOpen === 0) {
    await db.mockDraft.update({
      where: { id: mock.id },
      data: { completedAt: new Date() },
    });
    await awardEarnedBadges(userId);
  }

  return NextResponse.json({ ok: true });
}

async function loadBoard(
  userId: string,
  source: "personal" | "community",
  draftYear: number,
): Promise<MockBoardEntry[]> {
  if (source === "personal") {
    const rankings = await db.userRanking.findMany({
      where: { userId, draftYear },
      include: { player: true },
      orderBy: { rating: "desc" },
    });
    if (rankings.length > 0) {
      return rankings.map((r, idx) => ({
        player: r.player,
        rating: r.rating,
        rankOverall: idx + 1,
      }));
    }
  }
  const community = await db.communityRanking.findMany({
    where: { draftYear },
    include: { player: true },
    orderBy: { rating: "desc" },
  });
  return community.map((c, idx) => ({
    player: c.player,
    rating: c.rating,
    rankOverall: c.rankOverall ?? idx + 1,
  }));
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { id: userId } = await getOrCreateUser();
  await db.mockDraft.deleteMany({ where: { id: params.id, userId } });
  return NextResponse.json({ ok: true });
}
