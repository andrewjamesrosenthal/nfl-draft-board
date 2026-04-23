import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";
import { pickGraderUnlocked } from "@/lib/pick-grade";

export const dynamic = "force-dynamic";

// Candidate pick shape returned to the client.
export type GradePick = {
  id: number;
  slug: string;
  fullName: string;
  firstName: string;
  lastName: string;
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
  if (!pickGraderUnlocked()) {
    return NextResponse.json({ locked: true, matchup: null });
  }

  const { id: userId } = await getOrCreateUser();
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? 2026);

  // All drafted picks for this year (players with actualPick set).
  const picks = await db.player.findMany({
    where: { draftYear: year, actualPick: { not: null } },
    orderBy: { actualPick: "asc" },
    select: {
      id: true, slug: true, fullName: true, firstName: true, lastName: true,
      position: true, school: true, espnId: true, espnIdSource: true,
      actualPick: true, actualRound: true, actualTeamAbbr: true,
    },
  });

  if (picks.length < 2) {
    return NextResponse.json({ locked: false, matchup: null, reason: "not_enough_picks" });
  }

  // Fetch user's existing grades for these picks.
  const playerIds = picks.map((p) => p.id);
  const grades = await db.pickGrade.findMany({
    where: { userId, playerId: { in: playerIds } },
  });
  const gradeMap = new Map(grades.map((g) => [g.playerId, g]));

  // Recent matchup pairs to avoid repeating.
  const recent = await db.pickGradeMatchup.findMany({
    where: { userId, draftYear: year },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { leftId: true, rightId: true },
  });
  const recentPairs = new Set(recent.map((m) => pairKey(m.leftId, m.rightId)));

  // Teams for name/colors.
  const teamAbbrs = [...new Set(picks.map((p) => p.actualTeamAbbr).filter(Boolean))] as string[];
  const teams = await db.team.findMany({ where: { abbr: { in: teamAbbrs } } });
  const teamMap = new Map(teams.map((t) => [t.abbr, t]));

  // Helper: get or create a PickGrade row with initial rating 1500.
  const getGrade = (id: number) =>
    gradeMap.get(id) ?? { rating: 1500, comparisons: 0 };

  // Selection: pick the candidate with highest uncertainty (fewest comparisons),
  // then find an opponent close to them in pick number or Elo rating.
  const sorted = [...picks].sort((a, b) => {
    const ca = getGrade(a.id).comparisons;
    const cb = getGrade(b.id).comparisons;
    return ca - cb; // fewest comparisons first
  });

  let left = sorted[0];
  let right: (typeof picks)[0] | null = null;

  // Find the best opponent: not the same pick, not recently seen together,
  // score by distance in actualPick (close picks = informative comparison).
  const PICK_WINDOW = 30; // prefer picks within ±30 slots
  const candidates = picks
    .filter((p) => p.id !== left.id)
    .map((p) => {
      const dist = Math.abs((p.actualPick ?? 999) - (left.actualPick ?? 999));
      const recently = recentPairs.has(pairKey(left.id, p.id));
      return { pick: p, score: dist + (recently ? 1000 : 0) };
    })
    .sort((a, b) => a.score - b.score);

  right = candidates[0]?.pick ?? null;

  // If no valid opponent within window, just grab closest pick.
  if (!right || Math.abs((right.actualPick ?? 999) - (left.actualPick ?? 999)) > PICK_WINDOW + 1000) {
    right = candidates.find((c) => c.score < 1000)?.pick ?? candidates[0]?.pick ?? null;
  }

  if (!right) {
    return NextResponse.json({ locked: false, matchup: null, reason: "no_opponent" });
  }

  const toGradePick = (p: (typeof picks)[0]): GradePick => {
    const team = p.actualTeamAbbr ? teamMap.get(p.actualTeamAbbr) : null;
    const g = getGrade(p.id);
    return {
      id: p.id,
      slug: p.slug,
      fullName: p.fullName,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      school: p.school,
      espnId: p.espnId,
      espnIdSource: p.espnIdSource,
      actualPick: p.actualPick!,
      actualRound: p.actualRound!,
      actualTeamAbbr: p.actualTeamAbbr!,
      teamName: team ? `${team.city} ${team.name}` : p.actualTeamAbbr,
      teamPrimaryHex: team?.primaryHex ?? null,
      teamSecondaryHex: team?.secondaryHex ?? null,
      myRating: g.rating,
      myComparisons: g.comparisons,
    };
  };

  // Stats for UI counters.
  const [gradeVotes, gradeSkips] = await Promise.all([
    db.pickGradeMatchup.count({ where: { userId, draftYear: year, skipped: false } }),
    db.pickGradeMatchup.count({ where: { userId, draftYear: year, skipped: true } }),
  ]);

  return NextResponse.json({
    locked: false,
    matchup: { left: toGradePick(left), right: toGradePick(right) },
    stats: { votes: gradeVotes, skips: gradeSkips, totalPicks: picks.length },
  });
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
