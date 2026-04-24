import db from "@/lib/db";
import { fetchDraftOrder, flattenDraftOrder } from "@/lib/espn/client";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export async function refreshFromEspn(year: number): Promise<number> {
  const data = await fetchDraftOrder(year);
  const flat = flattenDraftOrder(data);
  const now  = new Date();

  for (const p of flat) {
    let playerId: number | undefined;

    // Only link players who are actually in this draft class.
    // Without the draftYear filter, ESPN athlete IDs for historical players
    // can match picks in the wrong year when ESPN pre-populates its order.
    if (p.espnAthleteId) {
      const linked = await db.player.findFirst({
        where: { espnId: p.espnAthleteId, draftYear: year },
        select: { id: true },
      });
      if (linked) playerId = linked.id;
    }

    // For historical classes only: fall back to matching by pick number.
    // We do NOT do name-slug matching — too many false positives (e.g. a 2026
    // prospect named "DeVonta Smith" matching the Eagles WR from 2021).
    if (!playerId) {
      const byPick = await db.player.findFirst({
        where: { draftYear: year, actualPick: p.overallPick },
        select: { id: true },
      });
      if (byPick) playerId = byPick.id;
    }

    // When a pick is completed, write the actual draft result back to the Player
    // record so the pick grader and board can surface it.
    if (p.isCompleted && playerId) {
      await db.player.update({
        where: { id: playerId },
        data: {
          actualPick:     p.overallPick,
          actualRound:    p.round,
          actualTeamAbbr: p.teamAbbr,
          // Persist the headshot URL from the live draft response if we have it.
          ...(p.headshotUrl ? { headshotUrl: p.headshotUrl } : {}),
        },
      });

      // Ensure a CommunityPickGrade row exists so the pick grader can show this pick.
      await db.communityPickGrade.upsert({
        where: { playerId },
        update: { draftYear: year },
        create: { playerId, draftYear: year, rating: 1500, comparisons: 0 },
      });
    }

    await db.draftOrderPick.upsert({
      where: { draftYear_overallPick: { draftYear: year, overallPick: p.overallPick } },
      update: {
        round:           p.round,
        pickInRound:     p.pickInRound,
        teamAbbr:        p.teamAbbr,
        teamName:        p.teamName,
        teamLogoUrl:     p.teamLogoUrl,
        isOnTheClock:    p.isOnTheClock,
        isCompleted:     p.isCompleted,
        espnAthleteId:   p.espnAthleteId,
        selectedAthlete: p.selectedAthlete,
        tradedFromAbbr:  p.tradedFromAbbr,
        playerId:        playerId ?? null,
        fetchedAt:       now,
      },
      create: {
        draftYear:       year,
        overallPick:     p.overallPick,
        round:           p.round,
        pickInRound:     p.pickInRound,
        teamAbbr:        p.teamAbbr,
        teamName:        p.teamName,
        teamLogoUrl:     p.teamLogoUrl,
        isOnTheClock:    p.isOnTheClock,
        isCompleted:     p.isCompleted,
        espnAthleteId:   p.espnAthleteId,
        selectedAthlete: p.selectedAthlete,
        tradedFromAbbr:  p.tradedFromAbbr,
        playerId:        playerId ?? null,
        fetchedAt:       now,
      },
    });
  }
  return flat.length;
}
