// Local type mirrors (SQLite schema stores these as String but we keep the
// union types here for stricter seed validation).
export type Position =
  | "QB" | "RB" | "WR" | "TE"
  | "OT" | "IOL"
  | "EDGE" | "DT" | "LB"
  | "CB" | "S"
  | "K" | "P" | "LS";

export type PositionGroup =
  | "OFFENSE_SKILL"
  | "OFFENSIVE_LINE"
  | "DEFENSIVE_LINE"
  | "LINEBACKER"
  | "SECONDARY"
  | "SPECIAL_TEAMS";

export type PlayerSeed = {
  slug: string;
  firstName: string;
  lastName: string;
  position: Position;
  positionGroup: PositionGroup;
  school: string;
  conference?: string;
  draftYear: number;

  // Measurements
  heightInches?: number;
  weightLbs?: number;
  armInches?: number;
  handInches?: number;
  wingspanInches?: number;

  // Testing
  fortyYard?: number;
  tenYardSplit?: number;
  verticalIn?: number;
  broadJumpIn?: number;
  threeConeSec?: number;
  shuttleSec?: number;
  benchReps?: number;

  age?: number;
  hometown?: string;
  jerseyNumber?: string;

  actualPick?: number;
  actualRound?: number;
  actualTeamAbbr?: string;

  headshotUrl?: string;
  highlightUrl?: string;

  espnId?: string;
  espnIdSource?: "nfl" | "college-football";

  // Scouting
  summary: string;
  strengths: string[];
  weaknesses: string[];
  nflComp?: string;
  grade?: number;
};

export function heightToInches(ft: number, inches: number): number {
  return ft * 12 + inches;
}
