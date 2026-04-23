import { eloEngine } from "./elo";
import { bradleyTerryEngine } from "./bradley-terry";

export type Rating = {
  rating: number;
  sigma: number;
  comparisons: number;
  wins: number;
  losses: number;
};

export type MatchOutcome = "LEFT" | "RIGHT" | "SKIP";

export type RatingUpdate = {
  left: Rating;
  right: Rating;
};

export interface RankingEngine {
  readonly name: string;
  readonly description: string;
  readonly defaults: Pick<Rating, "rating" | "sigma">;
  /** Apply a single matchup to two ratings, returning new values. */
  update(left: Rating, right: Rating, outcome: MatchOutcome): RatingUpdate;
}

// Default engine (Elo); change to bradleyTerryEngine to swap system-wide.
export const rankingEngine: RankingEngine = eloEngine;

export { eloEngine, bradleyTerryEngine };
