import { PrismaClient } from "@prisma/client";
import { TEAMS } from "./seed-data/teams";
import { ALL_TEAM_NEEDS } from "./seed-data/team-needs";
import { PLAYERS_2026 } from "./seed-data/players-2026";
import { PLAYERS_2025 } from "./seed-data/players-2025";
import { PLAYERS_2024 } from "./seed-data/players-2024";
import { PLAYERS_HISTORICAL } from "./seed-data/players-historical";
import { mergeNflverse } from "./seed-data/nflverse-loader";
import { mergeProspects } from "./seed-data/prospects-loader";
import { applyDeclaredRoster, declaredSlugs2026 } from "./seed-data/declared-loader";
import type { PlayerSeed } from "./seed-data/types";

const db = new PrismaClient();

// Slugs we never want in the DB, regardless of what ESPN or nflverse says.
// Use this for players who return to school / haven't declared / opt out.
// Matching is by slug (lowercase-kebab of the full name). Keep short.
const PLAYER_DENYLIST = new Set<string>([
  "dante-moore", // returned to Oregon, has not declared for 2026
]);

// Curated hand-written seeds ⊕ nflverse (historical picks + combine + NFL ESPN IDs)
//                              ⊕ ESPN prospects (pre-draft roster + college-football ESPN IDs)
//                              ⊕ declared-2026 roster (authoritative filter for current class).
// The declared list locks the 2026 class to exactly the user-provided roster
// so players who haven't declared, players already in the NFL, etc. can't
// leak in via ESPN's prospects list.
const ALL_PLAYERS: PlayerSeed[] = applyDeclaredRoster(
  mergeProspects(
    mergeNflverse([
      ...PLAYERS_2026,
      ...PLAYERS_2025,
      ...PLAYERS_2024,
      ...PLAYERS_HISTORICAL,
    ]),
    [2026],
  ),
).filter((p) => !PLAYER_DENYLIST.has(p.slug));

const CLASSES = [
  { year: 2026, name: "2026 NFL Draft", isCurrent: true,  draftDate: new Date("2026-04-23") },
  { year: 2025, name: "2025 NFL Draft", isCurrent: false, draftDate: new Date("2025-04-24") },
  { year: 2024, name: "2024 NFL Draft", isCurrent: false, draftDate: new Date("2024-04-25") },
  { year: 2023, name: "2023 NFL Draft", isCurrent: false, draftDate: new Date("2023-04-27") },
  { year: 2022, name: "2022 NFL Draft", isCurrent: false, draftDate: new Date("2022-04-28") },
  { year: 2021, name: "2021 NFL Draft", isCurrent: false, draftDate: new Date("2021-04-29") },
  { year: 2020, name: "2020 NFL Draft", isCurrent: false, draftDate: new Date("2020-04-23") },
  { year: 2019, name: "2019 NFL Draft", isCurrent: false, draftDate: new Date("2019-04-25") },
  { year: 2018, name: "2018 NFL Draft", isCurrent: false, draftDate: new Date("2018-04-26") },
];

async function main() {
  console.log("Seeding draft classes...");
  for (const c of CLASSES) {
    await db.draftClass.upsert({
      where: { year: c.year },
      update: { name: c.name, isCurrent: c.isCurrent, draftDate: c.draftDate },
      create: c,
    });
  }

  console.log("Seeding teams...");
  for (const t of TEAMS) {
    await db.team.upsert({
      where: { abbr: t.abbr },
      update: t,
      create: t,
    });
  }

  console.log("Seeding team needs...");
  for (const tn of ALL_TEAM_NEEDS) {
    const team = await db.team.findUnique({ where: { abbr: tn.teamAbbr } });
    if (!team) continue;
    for (let i = 0; i < tn.needs.length; i++) {
      const position = tn.needs[i];
      await db.teamNeed.upsert({
        where: {
          teamId_position_draftYear: {
            teamId: team.id,
            position,
            draftYear: tn.draftYear,
          },
        },
        update: { priority: i + 1 },
        create: {
          teamId: team.id,
          position,
          draftYear: tn.draftYear,
          priority: i + 1,
        },
      });
    }
  }

  // Hard-delete denied players. Cascades take down rankings/watchlist/etc.
  const denyList = Array.from(PLAYER_DENYLIST);
  if (denyList.length > 0) {
    const purged = await db.player.deleteMany({ where: { slug: { in: denyList } } });
    if (purged.count > 0) console.log(`Purged ${purged.count} denylisted player rows.`);
  }

  // Purge any existing 2026 DB row whose slug isn't in the declared roster.
  // Upsert-by-slug won't delete rows on its own, so this is how we get rid of
  // players who were seeded in a previous run but are no longer eligible.
  const allowed2026 = declaredSlugs2026();
  if (allowed2026.size > 0) {
    const toPurge = await db.player.findMany({
      where: { draftYear: 2026, slug: { notIn: Array.from(allowed2026) } },
      select: { id: true },
    });
    const purgeIds = toPurge.map((p) => p.id);
    if (purgeIds.length > 0) {
      // PairwiseMatchup + MockDraftPick references don't cascade, so clear
      // them before the Player deletes.
      await db.pairwiseMatchup.deleteMany({
        where: {
          OR: [
            { leftId: { in: purgeIds } },
            { rightId: { in: purgeIds } },
            { winnerId: { in: purgeIds } },
          ],
        },
      });
      await db.mockDraftPick.updateMany({
        where: { playerId: { in: purgeIds } },
        data: { playerId: null },
      });
      await db.draftOrderPick.updateMany({
        where: { playerId: { in: purgeIds } },
        data: { playerId: null },
      });
      const purged2026 = await db.player.deleteMany({ where: { id: { in: purgeIds } } });
      console.log(`Purged ${purged2026.count} non-declared 2026 player rows.`);
    }
  }

  console.log(`Seeding ${ALL_PLAYERS.length} players...`);
  for (const p of ALL_PLAYERS) {
    const player = await db.player.upsert({
      where: { slug: p.slug },
      update: {
        firstName: p.firstName,
        lastName: p.lastName,
        fullName: `${p.firstName} ${p.lastName}`,
        position: p.position,
        positionGroup: p.positionGroup,
        school: p.school,
        conference: p.conference,
        draftYear: p.draftYear,
        heightInches: p.heightInches,
        weightLbs: p.weightLbs,
        armInches: p.armInches,
        handInches: p.handInches,
        wingspanInches: p.wingspanInches,
        fortyYard: p.fortyYard,
        tenYardSplit: p.tenYardSplit,
        verticalIn: p.verticalIn,
        broadJumpIn: p.broadJumpIn,
        threeConeSec: p.threeConeSec,
        shuttleSec: p.shuttleSec,
        benchReps: p.benchReps,
        age: p.age,
        hometown: p.hometown,
        jerseyNumber: p.jerseyNumber,
        actualPick: p.actualPick,
        actualRound: p.actualRound,
        actualTeamAbbr: p.actualTeamAbbr,
        espnId: p.espnId,
        espnIdSource: p.espnIdSource,
        headshotUrl: p.headshotUrl,
        highlightUrl: p.highlightUrl,
      },
      create: {
        slug: p.slug,
        firstName: p.firstName,
        lastName: p.lastName,
        fullName: `${p.firstName} ${p.lastName}`,
        position: p.position,
        positionGroup: p.positionGroup,
        school: p.school,
        conference: p.conference,
        draftYear: p.draftYear,
        heightInches: p.heightInches,
        weightLbs: p.weightLbs,
        armInches: p.armInches,
        handInches: p.handInches,
        wingspanInches: p.wingspanInches,
        fortyYard: p.fortyYard,
        tenYardSplit: p.tenYardSplit,
        verticalIn: p.verticalIn,
        broadJumpIn: p.broadJumpIn,
        threeConeSec: p.threeConeSec,
        shuttleSec: p.shuttleSec,
        benchReps: p.benchReps,
        age: p.age,
        hometown: p.hometown,
        jerseyNumber: p.jerseyNumber,
        actualPick: p.actualPick,
        actualRound: p.actualRound,
        actualTeamAbbr: p.actualTeamAbbr,
        espnId: p.espnId,
        espnIdSource: p.espnIdSource,
        headshotUrl: p.headshotUrl,
        highlightUrl: p.highlightUrl,
      },
    });

    // Initial scouting report. We don't persist curated nflComp values —
    // those were hand-written placeholders in the seed files. Real comps
    // come from /api/scouting/generate (Claude/OpenAI) via the admin UI.
    const existingReport = await db.scoutingReport.findFirst({
      where: { playerId: player.id, source: "INTERNAL" },
    });
    if (!existingReport) {
      await db.scoutingReport.create({
        data: {
          playerId: player.id,
          source: "INTERNAL",
          summary: p.summary,
          strengths: JSON.stringify(p.strengths),
          weaknesses: JSON.stringify(p.weaknesses),
          nflComp: null,
          grade: p.grade,
        },
      });
    } else {
      await db.scoutingReport.update({
        where: { id: existingReport.id },
        data: {
          summary: p.summary,
          strengths: JSON.stringify(p.strengths),
          weaknesses: JSON.stringify(p.weaknesses),
          nflComp: null,
          grade: p.grade,
        },
      });
    }

    // Seed an initial community ranking so the board isn't empty
    await db.communityRanking.upsert({
      where: { playerId: player.id },
      update: { draftYear: p.draftYear, rating: 1500 + (p.grade ?? 7) * 20 },
      create: {
        playerId: player.id,
        draftYear: p.draftYear,
        rating: 1500 + (p.grade ?? 7) * 20,
      },
    });
  }

  // Reconcile stale draftYear refs. When a player's draftYear moves (e.g.
  // nflverse tells us Trevor Etienne was actually a 2024 pick, not a 2026
  // prospect), we need to fix every related row or the player leaks into the
  // old class's views via personal rankings, matchups, snapshots, etc.
  console.log("Reconciling stale draftYear refs...");
  const allPlayers = await db.player.findMany({ select: { id: true, draftYear: true, fullName: true } });
  let reconciled = 0;
  for (const p of allPlayers) {
    const fixes = await Promise.all([
      db.userRanking.updateMany({
        where: { playerId: p.id, draftYear: { not: p.draftYear } },
        data: { draftYear: p.draftYear },
      }),
      db.pairwiseMatchup.updateMany({
        where: {
          draftYear: { not: p.draftYear },
          OR: [{ leftId: p.id }, { rightId: p.id }],
        },
        data: { draftYear: p.draftYear },
      }),
      db.rankingSnapshot.updateMany({
        where: { playerId: p.id, draftYear: { not: p.draftYear } },
        data: { draftYear: p.draftYear },
      }),
      db.communityRanking.updateMany({
        where: { playerId: p.id, draftYear: { not: p.draftYear } },
        data: { draftYear: p.draftYear },
      }),
    ]);
    const total = fixes.reduce((acc, r) => acc + r.count, 0);
    if (total > 0) {
      console.log(`  ${p.fullName}: reconciled ${total} stale rows to draftYear=${p.draftYear}`);
      reconciled += total;
    }
  }
  console.log(`Reconciled ${reconciled} rows total.`);

  console.log("Computing initial community ranks...");
  for (const year of CLASSES.map((c) => c.year)) {
    const rankings = await db.communityRanking.findMany({
      where: { draftYear: year },
      orderBy: { rating: "desc" },
    });
    let overallRank = 1;
    const posCounters: Record<string, number> = {};
    for (const r of rankings) {
      const player = await db.player.findUnique({ where: { id: r.playerId } });
      if (!player) continue;
      const pos = player.position;
      posCounters[pos] = (posCounters[pos] ?? 0) + 1;
      await db.communityRanking.update({
        where: { id: r.id },
        data: { rankOverall: overallRank++, rankPos: posCounters[pos] },
      });
    }
  }

  const counts = {
    players: await db.player.count(),
    classes: await db.draftClass.count(),
    teams: await db.team.count(),
    needs: await db.teamNeed.count(),
    reports: await db.scoutingReport.count(),
  };
  console.log("Seed complete.", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
