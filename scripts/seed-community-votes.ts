#!/usr/bin/env tsx
/**
 * Seed community rankings with simulated pairwise votes.
 *
 * Runs N Elo matchups entirely in memory, then bulk-writes the final ratings
 * back to CommunityRanking. Does NOT create fake PairwiseMatchup rows — the
 * community board shows its own ratings independently.
 *
 * Usage:
 *   npx tsx scripts/seed-community-votes.ts --year 2026 --votes 10000
 */
import db from "../src/lib/db";

const args = Object.fromEntries(
  process.argv.slice(2).reduce<string[][]>((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1] ?? "true"]);
    return acc;
  }, []),
);

const YEAR       = Number(args.year  ?? 2026);
const N_VOTES    = Number(args.votes ?? 10000);
// Fraction of outcomes that go "against" Elo expectation (simulates human variance).
const NOISE      = 0.20;

function eloExpected(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function kFactor(comparisons: number): number {
  if (comparisons < 5)  return 24;
  if (comparisons < 15) return 20;
  if (comparisons < 40) return 16;
  return 12;
}

function opponentWeight(oppComps: number): number {
  return Math.min(1, 0.55 + 0.015 * oppComps);
}

async function main() {
  console.log(`Seeding ${N_VOTES} community votes for ${YEAR} class…`);

  // Load all players for the year with their current community ratings.
  const rows = await db.communityRanking.findMany({
    where: { draftYear: YEAR },
    include: { player: { select: { id: true, position: true, fullName: true } } },
  });

  if (rows.length < 2) {
    console.error("Not enough players in CommunityRanking for this year. Run the seed first.");
    process.exit(1);
  }

  // Work entirely in memory.
  type State = {
    id: number;          // CommunityRanking.id
    playerId: number;
    position: string;
    fullName: string;
    rating: number;
    sigma: number;
    comparisons: number;
  };

  const players: State[] = rows.map((r) => ({
    id: r.id,
    playerId: r.playerId,
    position: r.player.position,
    fullName: r.player.fullName,
    rating: r.rating,
    sigma: r.sigma,
    comparisons: r.comparisons,
  }));

  // Sort by rating desc for quick top-N lookup.
  const byId = new Map(players.map((p) => [p.playerId, p]));

  let samePositionMatchups = 0;
  let crossPositionMatchups = 0;

  for (let i = 0; i < N_VOTES; i++) {
    // Pick the player with the most uncertainty first.
    players.sort((a, b) => b.sigma - a.sigma);
    const anchor = players[0];

    // Find a nearby-rated opponent. Prefer same position in first 60% of votes,
    // allow cross-position after that so the overall ranking converges.
    const crossPosOk = i > N_VOTES * 0.6;
    const candidates = players
      .filter((p) => p.playerId !== anchor.playerId)
      .filter((p) => crossPosOk || p.position === anchor.position)
      .map((p) => ({
        p,
        score: Math.abs(p.rating - anchor.rating) + (p.sigma < 150 ? 0 : -50),
      }))
      .sort((a, b) => a.score - b.score);

    if (candidates.length === 0) continue;
    const opponent = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))].p;

    // Determine outcome. Use Elo expected probability with a noise factor so
    // the simulation doesn't converge too rigidly.
    const pureExpected = eloExpected(anchor.rating, opponent.rating);
    const noisedP = (1 - NOISE) * pureExpected + NOISE * 0.5;
    const anchorWins = Math.random() < noisedP;

    const winner = anchorWins ? anchor : opponent;
    const loser  = anchorWins ? opponent : anchor;

    // Apply Elo update.
    const kW = kFactor(winner.comparisons) * opponentWeight(loser.comparisons);
    const kL = kFactor(loser.comparisons)  * opponentWeight(winner.comparisons);
    const expW = eloExpected(winner.rating, loser.rating);

    winner.rating      += kW * (1 - expW);
    winner.sigma        = Math.max(80, winner.sigma * 0.992);
    winner.comparisons += 1;

    loser.rating       += kL * (0 - (1 - expW));
    loser.rating        = Math.max(1000, loser.rating);
    loser.sigma         = Math.max(80, loser.sigma * 0.992);
    loser.comparisons  += 1;

    if (anchor.position === opponent.position) samePositionMatchups++;
    else crossPositionMatchups++;

    if ((i + 1) % 1000 === 0) {
      process.stdout.write(`  ${i + 1}/${N_VOTES} votes simulated…\r`);
    }
  }

  console.log(`\n  Same-position: ${samePositionMatchups} | Cross-position: ${crossPositionMatchups}`);
  console.log("Writing ratings to DB…");

  // Bulk-write back in batches.
  const BATCH = 50;
  for (let i = 0; i < players.length; i += BATCH) {
    await Promise.all(
      players.slice(i, i + BATCH).map((p) =>
        db.communityRanking.update({
          where: { id: p.id },
          data: {
            rating:      p.rating,
            sigma:       p.sigma,
            comparisons: p.comparisons,
          },
        }),
      ),
    );
  }

  // Recompute rank positions.
  console.log("Recomputing rank positions…");
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const posCounters: Record<string, number> = {};
  await Promise.all(
    sorted.map((p, idx) => {
      posCounters[p.position] = (posCounters[p.position] ?? 0) + 1;
      return db.communityRanking.update({
        where: { id: p.id },
        data: { rankOverall: idx + 1, rankPos: posCounters[p.position] },
      });
    }),
  );

  // Print top 10 as a sanity check.
  console.log("\nTop 10 after seeding:");
  sorted.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.fullName.padEnd(25)} ${p.rating.toFixed(1).padStart(7)} (${p.comparisons} comps)`);
  });

  console.log(`\nDone. ${N_VOTES} votes applied across ${players.length} players.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
