import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";
import { PICK_GRADE_UNLOCK } from "@/lib/pick-grade";

export const dynamic = "force-dynamic";

// Shape returned to the client for each pick card.
export type GradePick = {
  id: number;           // = overallPick — stable voting key
  playerId: number | null;
  slug: string | null;
  fullName: string;
  position: string;
  school: string;
  espnId: string | null;
  espnIdSource: string | null;
  actualPick: number;
  actualRound: number;
  actualTeamAbbr: string;
  teamName: string | null;
  teamPrimaryHex: string | null;
  teamSecondaryHex: string | null;
  myRating: number;
  myComparisons: number;
};

export async function GET(req: Request) {
  const { id: userId } = await getOrCreateUser();
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? 2026);

  if (new Date() < PICK_GRADE_UNLOCK) {
    return NextResponse.json({ locked: true, matchup: null });
  }

  // Use DraftOrderPick as the source of truth for actual picks —
  // it always reflects ESPN's live data regardless of whether we've
  // linked the pick to a Player record yet.
  const draftPicks = await db.draftOrderPick.findMany({
    where: { draftYear: year, isCompleted: true },
    orderBy: { overallPick: "asc" },
  });

  if (draftPicks.length < 2) {
    return NextResponse.json({ locked: false, matchup: null, reason: "not_enough_picks" });
  }

  // Fetch linked player details for picks that have a player linked.
  const linkedPlayerIds = draftPicks
    .map((p) => p.playerId)
    .filter((id): id is number => id != null);
  const linkedPlayers = linkedPlayerIds.length
    ? await db.player.findMany({
        where: { id: { in: linkedPlayerIds } },
        select: {
          id: true, slug: true, position: true, school: true,
          espnId: true, espnIdSource: true,
        },
      })
    : [];
  const playerById = new Map(linkedPlayers.map((p) => [p.id, p]));

  // Teams for colors.
  const teamAbbrs = [...new Set(draftPicks.map((p) => p.teamAbbr))];
  const teams = await db.team.findMany({ where: { abbr: { in: teamAbbrs } } });
  const teamMap = new Map(teams.map((t) => [t.abbr, t]));

  // Grade ratings keyed by pick's overall pick number (stable across refreshes).
  const grades = await db.pickGrade.findMany({
    where: { userId, draftYear: year },
  });
  const gradeByPickId = new Map(grades.map((g) => [String(g.playerId ?? g.id), g]));

  // Helper: grade lookup using playerId if linked, else overallPick as fallback key.
  const getGrade = (pick: (typeof draftPicks)[0]) => {
    const key = pick.playerId ? String(pick.playerId) : `pick:${pick.overallPick}`;
    return gradeByPickId.get(key) ?? { rating: 1500, comparisons: 0 };
  };

  // Recent matchups to avoid repeats.
  const recent = await db.pickGradeMatchup.findMany({
    where: { userId, draftYear: year },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { leftId: true, rightId: true },
  });
  const recentPairs = new Set(recent.map((m) => pairKey(m.leftId, m.rightId)));

  const toGradePick = (dp: (typeof draftPicks)[0]): GradePick => {
    const player = dp.playerId ? playerById.get(dp.playerId) : null;
    const team = teamMap.get(dp.teamAbbr);
    const g = getGrade(dp);
    // Prefer linked player's ESPN ID; fall back to ESPN athlete ID on the pick itself.
    const espnId = player?.espnId ?? dp.espnAthleteId ?? null;
    const espnIdSource = player?.espnIdSource ?? (espnId ? "college-football" : null);
    return {
      id: dp.overallPick,
      playerId: dp.playerId,
      slug: player?.slug ?? null,
      fullName: dp.selectedAthlete ?? player?.slug ?? `Pick ${dp.overallPick}`,
      position: player?.position ?? "—",
      school: player?.school ?? "—",
      espnId,
      espnIdSource,
      actualPick: dp.overallPick,
      actualRound: dp.round,
      actualTeamAbbr: dp.teamAbbr,
      teamName: team ? `${team.city} ${team.name}` : dp.teamName ?? dp.teamAbbr,
      teamPrimaryHex: team?.primaryHex ?? null,
      teamSecondaryHex: team?.secondaryHex ?? null,
      myRating: g.rating,
      myComparisons: g.comparisons,
    };
  };

  // Select anchor (highest uncertainty) + nearby opponent.
  const sorted = [...draftPicks].sort((a, b) => getGrade(a).comparisons - getGrade(b).comparisons);
  const anchor = sorted[0];
  const candidates = draftPicks
    .filter((p) => p.overallPick !== anchor.overallPick)
    .map((p) => ({
      pick: p,
      score: Math.abs(p.overallPick - anchor.overallPick) +
             (recentPairs.has(pairKey(anchor.overallPick, p.overallPick)) ? 1000 : 0),
    }))
    .sort((a, b) => a.score - b.score);

  const opponent = candidates.find((c) => c.score < 1000)?.pick ?? candidates[0]?.pick;
  if (!opponent) return NextResponse.json({ locked: false, matchup: null });

  const [gradeVotes, gradeSkips] = await Promise.all([
    db.pickGradeMatchup.count({ where: { userId, draftYear: year, skipped: false } }),
    db.pickGradeMatchup.count({ where: { userId, draftYear: year, skipped: true } }),
  ]);

  return NextResponse.json({
    locked: false,
    matchup: { left: toGradePick(anchor), right: toGradePick(opponent) },
    stats: { votes: gradeVotes, skips: gradeSkips, totalPicks: draftPicks.length },
  });
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
