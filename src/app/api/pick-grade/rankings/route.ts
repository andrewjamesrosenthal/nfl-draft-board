import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";
import { computePercentiles, percentileToGrade, gradeInfo } from "@/lib/pick-grade";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { id: userId } = await getOrCreateUser();
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? 2026);
  const scope = url.searchParams.get("scope") ?? "personal"; // "personal" | "community"

  // All picks for the year.
  const picks = await db.player.findMany({
    where: { draftYear: year, actualPick: { not: null } },
    orderBy: { actualPick: "asc" },
    select: {
      id: true, slug: true, fullName: true, position: true, school: true,
      espnId: true, espnIdSource: true,
      actualPick: true, actualRound: true, actualTeamAbbr: true,
    },
  });

  if (picks.length === 0) {
    return NextResponse.json({ picks: [] });
  }

  const teamAbbrs = [...new Set(picks.map((p) => p.actualTeamAbbr).filter(Boolean))] as string[];
  const teams = await db.team.findMany({ where: { abbr: { in: teamAbbrs } } });
  const teamMap = new Map(teams.map((t) => [t.abbr, t]));

  let ratingMap: Map<number, number>;

  if (scope === "community") {
    const grades = await db.communityPickGrade.findMany({
      where: { draftYear: year },
    });
    const gradeByPlayer = new Map(grades.map((g) => [g.playerId, g.rating]));
    ratingMap = new Map(picks.map((p) => [p.id, gradeByPlayer.get(p.id) ?? 1500]));
  } else {
    const grades = await db.pickGrade.findMany({
      where: { userId, draftYear: year },
    });
    const gradeByPlayer = new Map(grades.map((g) => [g.playerId, g.rating]));
    ratingMap = new Map(picks.map((p) => [p.id, gradeByPlayer.get(p.id) ?? 1500]));
  }

  const percentiles = computePercentiles(
    picks.map((p) => ({ id: p.id, rating: ratingMap.get(p.id) ?? 1500 })),
  );

  const result = picks
    .map((p) => {
      const team = p.actualTeamAbbr ? teamMap.get(p.actualTeamAbbr) : null;
      const rating = ratingMap.get(p.id) ?? 1500;
      const pct = percentiles.get(p.id) ?? 50;
      const gradeLabel = percentileToGrade(pct);
      const { hex } = gradeInfo(gradeLabel);
      return {
        id: p.id,
        slug: p.slug,
        fullName: p.fullName,
        position: p.position,
        school: p.school,
        espnId: p.espnId,
        espnIdSource: p.espnIdSource,
        actualPick: p.actualPick!,
        actualRound: p.actualRound!,
        actualTeamAbbr: p.actualTeamAbbr!,
        teamName: team ? `${team.city} ${team.name}` : (p.actualTeamAbbr ?? ""),
        teamPrimaryHex: team?.primaryHex ?? null,
        rating,
        percentile: pct,
        grade: gradeLabel,
        gradeHex: hex,
      };
    })
    .sort((a, b) => b.rating - a.rating); // best pick first

  return NextResponse.json({ picks: result });
}
