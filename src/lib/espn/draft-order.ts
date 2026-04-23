import db from "@/lib/db";
import { fetchDraftOrder, flattenDraftOrder } from "@/lib/espn/client";

export async function refreshFromEspn(year: number): Promise<number> {
  const data = await fetchDraftOrder(year);
  const flat = flattenDraftOrder(data);
  const now = new Date();
  for (const p of flat) {
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
