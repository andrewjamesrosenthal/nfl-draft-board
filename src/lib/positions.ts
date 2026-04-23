import type { Position, PositionGroup } from "@/types";
export type { Position, PositionGroup } from "@/types";

export const POSITION_LABELS: Record<string, string> = {
  QB:   "Quarterback",
  RB:   "Running Back",
  WR:   "Wide Receiver",
  TE:   "Tight End",
  OT:   "Offensive Tackle",
  IOL:  "Interior O-Line",
  EDGE: "Edge Rusher",
  DT:   "Defensive Tackle",
  LB:   "Linebacker",
  CB:   "Cornerback",
  S:    "Safety",
  K:    "Kicker",
  P:    "Punter",
  LS:   "Long Snapper",
};

export const POSITION_GROUP_LABELS: Record<PositionGroup, string> = {
  OFFENSE_SKILL:   "Offensive Skill",
  OFFENSIVE_LINE:  "Offensive Line",
  DEFENSIVE_LINE:  "Defensive Line",
  LINEBACKER:      "Linebacker",
  SECONDARY:       "Secondary",
  SPECIAL_TEAMS:   "Special Teams",
};

export const GROUP_FOR_POSITION: Record<Position, PositionGroup> = {
  QB:   "OFFENSE_SKILL",
  RB:   "OFFENSE_SKILL",
  WR:   "OFFENSE_SKILL",
  TE:   "OFFENSE_SKILL",
  OT:   "OFFENSIVE_LINE",
  IOL:  "OFFENSIVE_LINE",
  EDGE: "DEFENSIVE_LINE",
  DT:   "DEFENSIVE_LINE",
  LB:   "LINEBACKER",
  CB:   "SECONDARY",
  S:    "SECONDARY",
  K:    "SPECIAL_TEAMS",
  P:    "SPECIAL_TEAMS",
  LS:   "SPECIAL_TEAMS",
};

export const POSITION_COLOR: Record<string, string> = {
  QB:   "bg-rose-500/15 text-rose-200 border-rose-500/30",
  RB:   "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  WR:   "bg-sky-500/15 text-sky-200 border-sky-500/30",
  TE:   "bg-amber-500/15 text-amber-200 border-amber-500/30",
  OT:   "bg-orange-500/15 text-orange-200 border-orange-500/30",
  IOL:  "bg-orange-600/15 text-orange-200 border-orange-600/30",
  EDGE: "bg-violet-500/15 text-violet-200 border-violet-500/30",
  DT:   "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/30",
  LB:   "bg-indigo-500/15 text-indigo-200 border-indigo-500/30",
  CB:   "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
  S:    "bg-teal-500/15 text-teal-200 border-teal-500/30",
  K:    "bg-zinc-500/15 text-zinc-200 border-zinc-500/30",
  P:    "bg-zinc-500/15 text-zinc-200 border-zinc-500/30",
  LS:   "bg-zinc-500/15 text-zinc-200 border-zinc-500/30",
};

export const POSITIONS: Position[] = [
  "QB","RB","WR","TE","OT","IOL","EDGE","DT","LB","CB","S",
];

export function positionValue(pos: string): number {
  // Rough NFL positional value weighting used by the mock engine.
  switch (pos) {
    case "QB":   return 1.6;
    case "EDGE": return 1.35;
    case "OT":   return 1.3;
    case "CB":   return 1.25;
    case "WR":   return 1.2;
    case "DT":   return 1.1;
    case "S":    return 1.05;
    case "TE":   return 1.0;
    case "LB":   return 1.0;
    case "IOL":  return 0.9;
    case "RB":   return 0.75;
    case "K":
    case "P":
    case "LS":   return 0.5;
    default:     return 1.0;
  }
}
