import type { Position } from "./types";

export type TeamNeedSeed = {
  teamAbbr: string;
  draftYear: number;
  needs: Position[]; // ordered by priority, most important first
};

// Rough, illustrative team-needs snapshots. These drive the mock-draft CPU
// so they do not need to be perfect; they should be plausible at draft time.
// 2025 needs (pre-draft view)
const NEEDS_2025: TeamNeedSeed[] = [
  { teamAbbr: "TEN", draftYear: 2025, needs: ["QB", "OT", "WR", "EDGE"] },
  { teamAbbr: "CLE", draftYear: 2025, needs: ["QB", "RB", "IOL", "LB"] },
  { teamAbbr: "NYG", draftYear: 2025, needs: ["QB", "EDGE", "WR", "OT"] },
  { teamAbbr: "NE",  draftYear: 2025, needs: ["OT", "WR", "EDGE", "CB"] },
  { teamAbbr: "JAX", draftYear: 2025, needs: ["DT", "CB", "LB", "IOL"] },
  { teamAbbr: "LV",  draftYear: 2025, needs: ["QB", "RB", "CB", "OT"] },
  { teamAbbr: "NYJ", draftYear: 2025, needs: ["OT", "TE", "RB", "S"] },
  { teamAbbr: "CAR", draftYear: 2025, needs: ["EDGE", "WR", "S", "DT"] },
  { teamAbbr: "NO",  draftYear: 2025, needs: ["OT", "WR", "CB", "DT"] },
  { teamAbbr: "CHI", draftYear: 2025, needs: ["OT", "EDGE", "RB", "S"] },
  { teamAbbr: "SF",  draftYear: 2025, needs: ["DT", "IOL", "CB", "EDGE"] },
  { teamAbbr: "DAL", draftYear: 2025, needs: ["RB", "WR", "DT", "IOL"] },
  { teamAbbr: "MIA", draftYear: 2025, needs: ["IOL", "DT", "TE", "S"] },
  { teamAbbr: "IND", draftYear: 2025, needs: ["TE", "CB", "DT", "LB"] },
  { teamAbbr: "ATL", draftYear: 2025, needs: ["EDGE", "DT", "CB", "LB"] },
  { teamAbbr: "ARI", draftYear: 2025, needs: ["EDGE", "CB", "WR", "DT"] },
  { teamAbbr: "CIN", draftYear: 2025, needs: ["DT", "S", "IOL", "LB"] },
  { teamAbbr: "SEA", draftYear: 2025, needs: ["IOL", "LB", "DT", "QB"] },
  { teamAbbr: "TB",  draftYear: 2025, needs: ["LB", "IOL", "DT", "EDGE"] },
  { teamAbbr: "DEN", draftYear: 2025, needs: ["RB", "LB", "TE", "DT"] },
  { teamAbbr: "PIT", draftYear: 2025, needs: ["QB", "CB", "DT", "WR"] },
  { teamAbbr: "LAC", draftYear: 2025, needs: ["RB", "DT", "TE", "LB"] },
  { teamAbbr: "GB",  draftYear: 2025, needs: ["S", "EDGE", "WR", "LB"] },
  { teamAbbr: "MIN", draftYear: 2025, needs: ["CB", "IOL", "DT", "EDGE"] },
  { teamAbbr: "HOU", draftYear: 2025, needs: ["OT", "IOL", "RB", "WR"] },
  { teamAbbr: "LAR", draftYear: 2025, needs: ["OT", "LB", "S", "EDGE"] },
  { teamAbbr: "BAL", draftYear: 2025, needs: ["CB", "EDGE", "OT", "WR"] },
  { teamAbbr: "DET", draftYear: 2025, needs: ["EDGE", "DT", "CB", "LB"] },
  { teamAbbr: "WAS", draftYear: 2025, needs: ["EDGE", "CB", "OT", "RB"] },
  { teamAbbr: "BUF", draftYear: 2025, needs: ["DT", "CB", "WR", "S"] },
  { teamAbbr: "KC",  draftYear: 2025, needs: ["OT", "WR", "RB", "EDGE"] },
  { teamAbbr: "PHI", draftYear: 2025, needs: ["LB", "S", "IOL", "EDGE"] },
];

const NEEDS_2024: TeamNeedSeed[] = [
  { teamAbbr: "CHI", draftYear: 2024, needs: ["QB", "WR", "OT", "EDGE"] },
  { teamAbbr: "WAS", draftYear: 2024, needs: ["QB", "OT", "DT", "CB"] },
  { teamAbbr: "NE",  draftYear: 2024, needs: ["QB", "WR", "OT", "CB"] },
  { teamAbbr: "ARI", draftYear: 2024, needs: ["WR", "EDGE", "CB", "OT"] },
  { teamAbbr: "LAC", draftYear: 2024, needs: ["WR", "OT", "EDGE", "DT"] },
  { teamAbbr: "NYG", draftYear: 2024, needs: ["WR", "OT", "QB", "CB"] },
  { teamAbbr: "TEN", draftYear: 2024, needs: ["OT", "WR", "CB", "EDGE"] },
  { teamAbbr: "ATL", draftYear: 2024, needs: ["EDGE", "WR", "CB", "DT"] },
  { teamAbbr: "MIN", draftYear: 2024, needs: ["QB", "EDGE", "CB", "OT"] },
  { teamAbbr: "NYJ", draftYear: 2024, needs: ["OT", "TE", "WR", "DT"] },
  { teamAbbr: "PHI", draftYear: 2024, needs: ["CB", "EDGE", "OT", "S"] },
];

// 2026 needs (pre-draft view, April 2026)
const NEEDS_2026: TeamNeedSeed[] = [
  { teamAbbr: "NYG", draftYear: 2026, needs: ["QB", "EDGE", "OT", "WR"] },
  { teamAbbr: "NE",  draftYear: 2026, needs: ["EDGE", "WR", "CB", "OT"] },
  { teamAbbr: "CLE", draftYear: 2026, needs: ["QB", "WR", "LB", "OT"] },
  { teamAbbr: "TEN", draftYear: 2026, needs: ["WR", "EDGE", "CB", "OT"] },
  { teamAbbr: "LV",  draftYear: 2026, needs: ["QB", "OT", "CB", "LB"] },
  { teamAbbr: "NO",  draftYear: 2026, needs: ["QB", "OT", "WR", "EDGE"] },
  { teamAbbr: "CAR", draftYear: 2026, needs: ["EDGE", "WR", "S", "DT"] },
  { teamAbbr: "NYJ", draftYear: 2026, needs: ["OT", "TE", "WR", "CB"] },
  { teamAbbr: "JAX", draftYear: 2026, needs: ["DT", "CB", "LB", "IOL"] },
  { teamAbbr: "CHI", draftYear: 2026, needs: ["OT", "EDGE", "CB", "DT"] },
  { teamAbbr: "IND", draftYear: 2026, needs: ["QB", "CB", "DT", "LB"] },
  { teamAbbr: "MIA", draftYear: 2026, needs: ["IOL", "DT", "S", "LB"] },
  { teamAbbr: "DAL", draftYear: 2026, needs: ["WR", "DT", "IOL", "S"] },
  { teamAbbr: "ATL", draftYear: 2026, needs: ["EDGE", "DT", "CB", "LB"] },
  { teamAbbr: "ARI", draftYear: 2026, needs: ["EDGE", "DT", "LB", "S"] },
  { teamAbbr: "SEA", draftYear: 2026, needs: ["IOL", "LB", "DT", "EDGE"] },
  { teamAbbr: "SF",  draftYear: 2026, needs: ["IOL", "DT", "CB", "EDGE"] },
  { teamAbbr: "PIT", draftYear: 2026, needs: ["QB", "WR", "CB", "DT"] },
  { teamAbbr: "CIN", draftYear: 2026, needs: ["DT", "LB", "IOL", "S"] },
  { teamAbbr: "TB",  draftYear: 2026, needs: ["LB", "IOL", "EDGE", "CB"] },
  { teamAbbr: "DEN", draftYear: 2026, needs: ["TE", "LB", "DT", "WR"] },
  { teamAbbr: "LAC", draftYear: 2026, needs: ["DT", "TE", "LB", "CB"] },
  { teamAbbr: "GB",  draftYear: 2026, needs: ["EDGE", "WR", "S", "CB"] },
  { teamAbbr: "MIN", draftYear: 2026, needs: ["CB", "IOL", "EDGE", "RB"] },
  { teamAbbr: "HOU", draftYear: 2026, needs: ["OT", "RB", "WR", "LB"] },
  { teamAbbr: "LAR", draftYear: 2026, needs: ["OT", "LB", "S", "CB"] },
  { teamAbbr: "BAL", draftYear: 2026, needs: ["CB", "EDGE", "OT", "WR"] },
  { teamAbbr: "WAS", draftYear: 2026, needs: ["CB", "EDGE", "OT", "LB"] },
  { teamAbbr: "DET", draftYear: 2026, needs: ["EDGE", "CB", "DT", "S"] },
  { teamAbbr: "BUF", draftYear: 2026, needs: ["DT", "WR", "CB", "S"] },
  { teamAbbr: "KC",  draftYear: 2026, needs: ["OT", "WR", "CB", "EDGE"] },
  { teamAbbr: "PHI", draftYear: 2026, needs: ["LB", "S", "CB", "DT"] },
];

export const ALL_TEAM_NEEDS: TeamNeedSeed[] = [...NEEDS_2026, ...NEEDS_2025, ...NEEDS_2024];
