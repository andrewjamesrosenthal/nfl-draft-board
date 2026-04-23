import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";
import { ensureRanking } from "@/lib/matchup-selector";
import { rankingEngine, type MatchOutcome } from "@/lib/ranking";
import { awardEarnedBadges } from "@/lib/badges";

export const dynamic = "force-dynamic";

const schema = z.object({
  leftId: z.number().int(),
  rightId: z.number().int(),
  winnerId: z.number().int().optional(), // omit for skip
  outcome: z.enum(["LEFT", "RIGHT", "SKIP"]),
  draftYear: z.number().int(),
  context: z.string().default("OVERALL"),
});

export async function POST(req: Request) {
  const { id: userId } = await getOrCreateUser();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { leftId, rightId, winnerId, outcome, draftYear, context } = parsed.data;

  if (leftId === rightId) {
    return NextResponse.json({ error: "Cannot compare a player with themselves" }, { status: 400 });
  }

  // Cross-year matchups (HISTORICAL mode) pair a current-year prospect with a
  // historical draftee. Each player's UserRanking must be keyed by their own
  // draftYear so cross-year votes don't create phantom rankings.
  const [leftPlayer, rightPlayer] = await Promise.all([
    db.player.findUnique({ where: { id: leftId }, select: { draftYear: true } }),
    db.player.findUnique({ where: { id: rightId }, select: { draftYear: true } }),
  ]);
  if (!leftPlayer || !rightPlayer) {
    return NextResponse.json({ error: "player not found" }, { status: 404 });
  }

  const leftRank  = await ensureRanking(userId, leftId,  leftPlayer.draftYear);
  const rightRank = await ensureRanking(userId, rightId, rightPlayer.draftYear);

  const update = rankingEngine.update(
    leftRank,
    rightRank,
    outcome as MatchOutcome,
  );

  await db.$transaction([
    db.pairwiseMatchup.create({
      data: {
        userId, leftId, rightId, draftYear,
        winnerId: outcome === "SKIP" ? null : winnerId,
        skipped: outcome === "SKIP",
        context,
      },
    }),
    db.userRanking.update({
      where: { userId_playerId_draftYear: { userId, playerId: leftId, draftYear: leftPlayer.draftYear } },
      data: {
        rating: update.left.rating,
        sigma: update.left.sigma,
        comparisons: update.left.comparisons,
        wins: update.left.wins,
        losses: update.left.losses,
        source: leftRank.source,
      },
    }),
    db.userRanking.update({
      where: { userId_playerId_draftYear: { userId, playerId: rightId, draftYear: rightPlayer.draftYear } },
      data: {
        rating: update.right.rating,
        sigma: update.right.sigma,
        comparisons: update.right.comparisons,
        wins: update.right.wins,
        losses: update.right.losses,
        source: rightRank.source,
      },
    }),
  ]);

  // Fold into the community model (simple running average of user ratings).
  if (outcome !== "SKIP" && winnerId) {
    await updateCommunity(leftId, rightId, winnerId, draftYear);
  }

  const newBadges = await awardEarnedBadges(userId);

  return NextResponse.json({ ok: true, newBadges });
}

async function updateCommunity(
  leftId: number,
  rightId: number,
  winnerId: number,
  draftYear: number,
) {
  const [leftC, rightC] = await Promise.all([
    db.communityRanking.upsert({
      where: { playerId: leftId },
      update: {},
      create: { playerId: leftId, draftYear },
    }),
    db.communityRanking.upsert({
      where: { playerId: rightId },
      update: {},
      create: { playerId: rightId, draftYear },
    }),
  ]);

  const leftScore  = winnerId === leftId  ? 1 : 0;
  const rightScore = winnerId === rightId ? 1 : 0;

  const update = rankingEngine.update(
    { rating: leftC.rating, sigma: leftC.sigma, comparisons: leftC.comparisons, wins: 0, losses: 0 },
    { rating: rightC.rating, sigma: rightC.sigma, comparisons: rightC.comparisons, wins: 0, losses: 0 },
    leftScore === 1 ? "LEFT" : "RIGHT",
  );

  await db.$transaction([
    db.communityRanking.update({
      where: { playerId: leftId },
      data: {
        rating: update.left.rating,
        sigma: update.left.sigma,
        comparisons: update.left.comparisons,
      },
    }),
    db.communityRanking.update({
      where: { playerId: rightId },
      data: {
        rating: update.right.rating,
        sigma: update.right.sigma,
        comparisons: update.right.comparisons,
      },
    }),
  ]);

  // Recompute ranks for the year (cheap at this scale).
  await recomputeCommunityRanks(draftYear);
}

async function recomputeCommunityRanks(draftYear: number) {
  const rankings = await db.communityRanking.findMany({
    where: { draftYear },
    orderBy: { rating: "desc" },
    include: { player: true },
  });
  const posCounters: Record<string, number> = {};
  let overall = 1;
  const updates = rankings.map((r) => {
    const pos = r.player.position;
    posCounters[pos] = (posCounters[pos] ?? 0) + 1;
    return db.communityRanking.update({
      where: { id: r.id },
      data: { rankOverall: overall++, rankPos: posCounters[pos] },
    });
  });
  await db.$transaction(updates);
}
