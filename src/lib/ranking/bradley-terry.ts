import type { RankingEngine, Rating, MatchOutcome } from "./index";

// A lightweight Bradley-Terry style updater that treats rating as
// log-strength. Approximated with gradient-style steps for online updates.
// Not a true global MLE; this is the online companion of a batch BT fit.

const STEP = 0.08;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function applyUpdate(self: Rating, opp: Rating, score: number): Rating {
  const ds = (self.rating - opp.rating) / 100;
  const p = sigmoid(ds);
  const grad = score - p;
  return {
    ...self,
    rating: self.rating + STEP * grad * 100,
    comparisons: self.comparisons + 1,
    sigma: Math.max(120, self.sigma * 0.99),
    wins: self.wins + (score === 1 ? 1 : 0),
    losses: self.losses + (score === 0 ? 1 : 0),
  };
}

export const bradleyTerryEngine: RankingEngine = {
  name: "Bradley-Terry (online)",
  description:
    "Logistic paired-comparison model. Updates each rating using gradient steps derived from predicted win probability.",
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
