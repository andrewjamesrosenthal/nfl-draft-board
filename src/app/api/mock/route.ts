import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";
import {
  buildDraftOrder,
  pickForSlot,
  DEFAULT_ORDER_2026,
  DEFAULT_ORDER_2025,
  DEFAULT_ORDER_2024,
  type MockBoardEntry,
} from "@/lib/mock-engine";
import { confidenceLevel } from "@/lib/ranking/confidence";
import type { MockMode, MockControl } from "@/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  draftYear: z.number().int(),
  mode: z.enum(["ONE_ROUND", "TWO_ROUND", "FULL_SEVEN"]).default("ONE_ROUND"),
  control: z.enum(["SINGLE_TEAM", "ALL_TEAMS", "AUTO"]).default("SINGLE_TEAM"),
  userTeamAbbr: z.string().optional(),
  boardSource: z.enum(["personal", "community"]).default("community"),
  title: z.string().optional(),
});

export async function POST(req: Request) {
  const { id: userId } = await getOrCreateUser();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const teams = await db.team.findMany({
    include: {
      needs: {
        where: { draftYear: data.draftYear },
        orderBy: { priority: "asc" },
      },
    },
  });

  // Build order (real pre-draft order for 2026 / 2025 / 2024, random for older).
  const pickOrder =
    data.draftYear === 2026 ? DEFAULT_ORDER_2026 :
    data.draftYear === 2025 ? DEFAULT_ORDER_2025 :
    data.draftYear === 2024 ? DEFAULT_ORDER_2024 : undefined;
  const slots = buildDraftOrder(teams, data.mode as MockMode, pickOrder);

  // Build the source board.
  const board = await loadBoard(userId, data.boardSource, data.draftYear);
  if (board.length === 0) {
    return NextResponse.json({ error: "Empty board. Make some comparisons or pick community." }, { status: 400 });
  }

  const mock = await db.mockDraft.create({
    data: {
      userId,
      draftYear: data.draftYear,
      mode: data.mode as MockMode,
      control: data.control as MockControl,
      userTeamAbbr: data.userTeamAbbr ?? null,
      boardSource: data.boardSource,
      title: data.title,
    },
  });

  // For non-interactive "AUTO" mocks, simulate immediately.
  if (data.control === "AUTO") {
    const picks = runAutoMock(slots, board);
    await db.mockDraftPick.createMany({
      data: picks.map((p) => ({
        mockId: mock.id,
        overallPick: p.slot.overall,
        round: p.slot.round,
        teamAbbr: p.slot.team.abbr,
        playerId: p.playerId,
      })),
    });
    await db.mockDraft.update({
      where: { id: mock.id },
      data: { completedAt: new Date() },
    });
  } else {
    // Pre-seed empty picks so the client can walk the clock.
    await db.mockDraftPick.createMany({
      data: slots.map((s) => ({
        mockId: mock.id,
        overallPick: s.overall,
        round: s.round,
        teamAbbr: s.team.abbr,
      })),
    });

    // For SINGLE_TEAM, let the CPU advance until the user's team is on the clock.
    if (data.control === "SINGLE_TEAM" && data.userTeamAbbr) {
      const available = board.slice();
      const pickedPositions = new Map<string, number>();
      for (const slot of slots) {
        if (slot.team.abbr === data.userTeamAbbr) break;
        const decision = pickForSlot(slot, available, pickedPositions);
        if (!decision) break;
        await db.mockDraftPick.updateMany({
          where: { mockId: mock.id, overallPick: slot.overall },
          data: { playerId: decision.playerId, byUser: false },
        });
        const idx = available.findIndex((b) => b.player.id === decision.playerId);
        if (idx >= 0) available.splice(idx, 1);
        const key = slot.team.abbr + ":" + decision.playerPosition;
        pickedPositions.set(key, (pickedPositions.get(key) ?? 0) + 1);
      }
    }
  }

  return NextResponse.json({ mockId: mock.id });
}

function runAutoMock(
  slots: ReturnType<typeof buildDraftOrder>,
  board: MockBoardEntry[],
) {
  const available = board.slice();
  const pickedPositions = new Map<string, number>();
  const results = [];
  for (const slot of slots) {
    const decision = pickForSlot(slot, available, pickedPositions);
    if (!decision) break;
    const idx = available.findIndex((b) => b.player.id === decision.playerId);
    if (idx >= 0) available.splice(idx, 1);
    const key = slot.team.abbr + ":" + decision.playerPosition;
    pickedPositions.set(key, (pickedPositions.get(key) ?? 0) + 1);
    results.push(decision);
  }
  return results;
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
    return rankings.map((r, idx) => ({
      player: r.player,
      rating: r.rating,
      rankOverall: idx + 1,
    }));
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

export async function GET() {
  const { id: userId } = await getOrCreateUser();
  const mocks = await db.mockDraft.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { picks: true } } },
  });
  return NextResponse.json({ items: mocks });
}
