import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUserId } from "@/lib/user-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? "2026");

  const rankings = await db.communityRanking.findMany({
    where: { draftYear: year },
    include: {
      player: true,
    },
    orderBy: { rating: "desc" },
  });

  const totalMatchups = await db.pairwiseMatchup.count({ where: { draftYear: year } });

  // Most compared players: count appearances in matchups.
  const matchupCounts = await db.pairwiseMatchup.groupBy({
    by: ["leftId"],
    where: { draftYear: year },
    _count: { _all: true },
  });
  const rightCounts = await db.pairwiseMatchup.groupBy({
    by: ["rightId"],
    where: { draftYear: year },
    _count: { _all: true },
  });
  const combined = new Map<number, number>();
  for (const r of matchupCounts) combined.set(r.leftId, (combined.get(r.leftId) ?? 0) + r._count._all);
  for (const r of rightCounts) combined.set(r.rightId, (combined.get(r.rightId) ?? 0) + r._count._all);

  const mostCompared = [...combined.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([playerId, count]) => {
      const r = rankings.find((x) => x.playerId === playerId);
      return r ? { ranking: r, appearances: count } : null;
    })
    .filter((x): x is { ranking: typeof rankings[number]; appearances: number } => !!x);

  // Controversial: highest sigma among players with at least some comparisons.
  const controversial = rankings
    .filter((r) => r.comparisons >= 3)
    .sort((a, b) => b.sigma - a.sigma)
    .slice(0, 10);

  // Rising / falling based on 7d trend (field maintained by ranking ops, or zero at seed).
  const rising  = rankings.slice().sort((a, b) => b.trend7d - a.trend7d).slice(0, 10);
  const falling = rankings.slice().sort((a, b) => a.trend7d - b.trend7d).slice(0, 10);

  // Personal/community disagreement (if user exists).
  const userId = await getCurrentUserId();
  let disagreements: { player: any; communityRank: number; personalRank: number; delta: number }[] = [];
  if (userId) {
    const userRankings = await db.userRanking.findMany({
      where: { userId, draftYear: year },
      orderBy: { rating: "desc" },
      include: { player: true },
    });
    const personalRank = new Map<number, number>();
    userRankings.forEach((r, idx) => personalRank.set(r.playerId, idx + 1));
    disagreements = rankings
      .filter((r) => personalRank.has(r.playerId) && r.rankOverall != null)
      .map((r) => ({
        player: r.player,
        communityRank: r.rankOverall!,
        personalRank: personalRank.get(r.playerId)!,
        delta: personalRank.get(r.playerId)! - (r.rankOverall ?? 0),
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 10);
  }

  return NextResponse.json({
    totalMatchups,
    mostCompared,
    controversial,
    rising,
    falling,
    disagreements,
  });
}
