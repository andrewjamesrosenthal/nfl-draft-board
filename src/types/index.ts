// Enum unions (SQLite does not support Prisma enums). Keep these in sync with
// the allowed values used across the app and the seed scripts.

// Positions: IOL covers both guards and centers. Tackles (OT) stay separate.
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

export type RankingSource = "ALGO" | "MANUAL" | "HYBRID";

export type MockMode = "ONE_ROUND" | "TWO_ROUND" | "FULL_SEVEN";

export type MockControl = "SINGLE_TEAM" | "ALL_TEAMS" | "AUTO";

export type ReportSource = "INTERNAL" | "LICENSED" | "USER" | "AI";
