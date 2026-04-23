import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";
import { confidenceLevel } from "@/lib/ranking/confidence";
import { rankingEngine } from "@/lib/ranking";

export const dynamic = "force-dynamic";

// Personal board. Returns EVERY player for the year, not just the ones the
// user has explicitly ranked. Players with no UserRanking get a default row
// that mirrors the community rating so the board is never empty.
//
// The `source` field on each item tells the UI whether the row is "personal"
// (real UserRanking data) or "default" (community fallback).
export async function GET(req: Request) {
  const { id: userId } = await getOrCreateUser();
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? "2026");
  const position = url.searchParams.get("position") ?? undefined;
  const teamAbbr = url.searchParams.get("team") ?? undefined;

  const [players, rankings, overrides] = await Promise.all([
    db.player.findMany({
      where: {
        draftYear: year,
        ...(position ? { position: position as any } : {}),
      },
      include: {
        reports: { take: 1, orderBy: { updatedAt: "desc" } },
        communityRanking: true,
      },
    }),
    db.userRanking.findMany({
      where: { userId, draftYear: year },
    }),
    db.userRankingOverride.findMany({
      where: { userId, draftYear: year },
    }),
  ]);

  const rankingByPlayer = new Map(rankings.map((r) => [r.playerId, r]));
  const overrideMap = new Map(overrides.map((o) => [o.playerId, o.manualRank]));

  // Build a full row per player, personal or default-from-community.
  let items = players
    .map((p) => {
      const userR = rankingByPlayer.get(p.id);
      if (userR) {
        return {
          source: "personal" as const,
          rating: userR.rating,
          sigma: userR.sigma,
          comparisons: userR.comparisons,
          wins: userR.wins,
          losses: userR.losses,
          confidence: confidenceLevel(userR.sigma, userR.comparisons),
          manualRank: overrideMap.get(p.id) ?? null,
          player: p,
        };
      }
      // No personal ranking yet — fall back to the community rating so the
      // player still appears on the board with a sensible position.
      const fallback = p.communityRanking?.rating ?? rankingEngine.defaults.rating;
      return {
        source: "default" as const,
        rating: fallback,
        sigma: rankingEngine.defaults.sigma,
        comparisons: 0,
        wins: 0,
        losses: 0,
        confidence: confidenceLevel(rankingEngine.defaults.sigma, 0),
        manualRank: overrideMap.get(p.id) ?? null,
        player: p,
      };
    })
    .sort((a, b) => b.rating - a.rating)
    .map((item, idx) => ({ rank: idx + 1, ...item }));

  // Apply manual overrides. Anything without an override keeps algo order.
  if (overrides.length) {
    const withManual = items.filter((i) => i.manualRank != null);
    const withoutManual = items.filter((i) => i.manualRank == null);
    withManual.sort((a, b) => (a.manualRank ?? 999) - (b.manualRank ?? 999));
    const reordered: typeof items = [];
    let normalIdx = 0;
    let manualIdx = 0;
    const maxRank = items.length;
    for (let rank = 1; rank <= maxRank; rank++) {
      const nextManual = withManual[manualIdx];
      if (nextManual && nextManual.manualRank === rank) {
        reordered.push({ ...nextManual, rank });
        manualIdx++;
      } else {
        const next = withoutManual[normalIdx++];
        if (next) reordered.push({ ...next, rank });
      }
    }
    items = reordered;
  }

  if (teamAbbr) {
    const needs = await db.teamNeed.findMany({
      where: { team: { abbr: teamAbbr }, draftYear: year },
      orderBy: { priority: "asc" },
    });
    const needPositions = new Set(needs.map((n) => n.position));
    items = items.map((i) => ({ ...i, onNeed: needPositions.has(i.player.position) }));
  }

  return NextResponse.json({ items, userId });
}
