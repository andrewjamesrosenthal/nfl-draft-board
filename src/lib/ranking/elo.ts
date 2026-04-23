import type { RankingEngine, Rating, MatchOutcome } from "./index";

// Base K-factor by comparison count. Much gentler than classic Elo-32/48 — a
// single early vote shouldn't be able to leapfrog a player past a well-
// established star. Full "K = 16 forever" feels too static once you have
// signal, so we taper through 24 → 20 → 16 → 12.
function baseK(comparisons: number): number {
  if (comparisons < 5)   return 24;
  if (comparisons < 15)  return 20;
  if (comparisons < 40)  return 16;
  return 12;
}

// Weight the update by how informative the opponent is. Beating a player with
// 0 votes tells us very little (their rating is a guess); beating a player
// with 60 votes is real signal. This is the same spirit as Glicko's RD-based
// weighting, scaled for our K-factor regime.
function opponentWeight(oppComparisons: number): number {
  // Scales from 0.55 at 0 comparisons to ~1.0 at 30+.
  return Math.min(1, 0.55 + 0.015 * oppComparisons);
}

function expected(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

function applyUpdate(self: Rating, opp: Rating, score: number): Rating {
  const k = baseK(self.comparisons) * opponentWeight(opp.comparisons);
  const exp = expected(self.rating, opp.rating);
  return {
    ...self,
    rating: self.rating + k * (score - exp),
    comparisons: self.comparisons + 1,
    // Sigma shrinks toward 120 with more votes. Slightly slower decay than
    // before so confidence takes a few more votes to settle.
    sigma: Math.max(120, self.sigma * 0.99),
    wins: self.wins + (score === 1 ? 1 : 0),
    losses: self.losses + (score === 0 ? 1 : 0),
  };
}

export const eloEngine: RankingEngine = {
  name: "Elo",
  description:
    "Elo with a gentle cold-start K-factor and opponent-confidence weighting. Early votes settle the board without leapfrogging established players.",
  defaults: { rating: 1500, sigma: 350 },
  update(left: Rating, right: Rating, outcome: MatchOutcome) {
    if (outcome === "SKIP") {
      return {
        left:  { ...left,  sigma: Math.max(120, left.sigma  * 0.998) },
        right: { ...right, sigma: Math.max(120, right.sigma * 0.998) },
      };
    }
    const leftScore  = outcome === "LEFT"  ? 1 : 0;
    const rightScore = outcome === "RIGHT" ? 1 : 0;
    return {
      left:  applyUpdate(left,  right, leftScore),
      right: applyUpdate(right, left,  rightScore),
    };
  },
};
