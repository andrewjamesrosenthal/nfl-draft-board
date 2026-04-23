import { NextResponse } from "next/server";
import db from "@/lib/db";
import { fetchDraftOrder, flattenDraftOrder } from "@/lib/espn/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/draft/order?year=2026&refresh=1
// Serves the cached DraftOrderPick rows for the requested year. With
// `refresh=1` (or when there are no rows) it re-fetches from ESPN and upserts
// the result. A daily cron (/api/cron/draft-order) keeps the cache warm without
// relying on anyone passing refresh=1 through the UI.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
  const shouldRefresh = url.searchParams.get("refresh") === "1";

  const existing = await db.draftOrderPick.count({ where: { draftYear: year } });
  if (shouldRefresh || existing === 0) {
    try {
      await refreshFromEspn(year);
    } catch (e) {
      if (existing === 0) {
        return NextResponse.json(
          { error: "upstream_failed", message: (e as Error).message },
          { status: 502 },
        );
      }
      // Serve stale cache if ESPN is down.
    }
  }

  const picks = await db.draftOrderPick.findMany({
    where: { draftYear: year },
    orderBy: { overallPick: "asc" },
  });
  return NextResponse.json({
    year,
    count: picks.length,
    picks,
    fetchedAt: picks[0]?.fetchedAt ?? null,
  });
}

export async function refreshFromEspn(year: number): Promise<number> {
  const data = await fetchDraftOrder(year);
  const flat = flattenDraftOrder(data);
  const now = new Date();
  for (const p of flat) {
    // Link to a local Player. Try ESPN athlete ID first (live draft), then
    // fall back to matching on (draftYear + actualPick) — our curated seed
    // data carries actualPick/actualTeamAbbr for historical classes so the
    // page can render headshots for past drafts too.
    let playerId: number | undefined;
    if (p.espnAthleteId) {
      const linked = await db.player.findFirst({
        where: { espnId: p.espnAthleteId },
        select: { id: true },
      });
      if (linked) playerId = linked.id;
    }
    if (!playerId) {
      const byPick = await db.player.findFirst({
        where: { draftYear: year, actualPick: p.overallPick },
        select: { id: true },
      });
      if (byPick) playerId = byPick.id;
    }
    await db.draftOrderPick.upsert({
      where: { draftYear_overallPick: { draftYear: year, overallPick: p.overallPick } },
      update: {
        round: p.round,
        pickInRound: p.pickInRound,
        teamAbbr: p.teamAbbr,
        teamName: p.teamName,
        teamLogoUrl: p.teamLogoUrl,
        isOnTheClock: p.isOnTheClock,
        isCompleted: p.isCompleted,
        espnAthleteId: p.espnAthleteId,
        selectedAthlete: p.selectedAthlete,
        tradedFromAbbr: p.tradedFromAbbr,
        playerId,
        fetchedAt: now,
      },
      create: {
        draftYear: year,
        overallPick: p.overallPick,
        round: p.round,
        pickInRound: p.pickInRound,
        teamAbbr: p.teamAbbr,
        teamName: p.teamName,
        teamLogoUrl: p.teamLogoUrl,
        isOnTheClock: p.isOnTheClock,
        isCompleted: p.isCompleted,
        espnAthleteId: p.espnAthleteId,
        selectedAthlete: p.selectedAthlete,
        tradedFromAbbr: p.tradedFromAbbr,
        playerId,
        fetchedAt: now,
      },
    });
  }
  return flat.length;
}
