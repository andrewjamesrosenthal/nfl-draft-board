import type { Player, TeamNeed, Team } from "@prisma/client";
import type { MockMode } from "@/types";
import { positionValue } from "./positions";

export type MockBoardEntry = {
  player: Player;
  rating: number;     // from user or community board
  rankOverall: number;
};

export type DraftOrderSlot = {
  overall: number;
  round: number;
  team: Team & { needs: TeamNeed[] };
};

export type MockPickDecision = {
  slot: DraftOrderSlot;
  playerId: number;
  playerName: string;
  playerPosition: string;
  reason: string;
};

const ROUND_LENGTH = 32;

export function roundsFor(mode: MockMode): number {
  switch (mode) {
    case "ONE_ROUND":  return 1;
    case "TWO_ROUND":  return 2;
    case "FULL_SEVEN": return 7;
  }
}

export function buildDraftOrder(
  teams: (Team & { needs: TeamNeed[] })[],
  mode: MockMode,
  seedPickOrder?: string[], // optional team-abbr order to match real draft order
): DraftOrderSlot[] {
  const order = seedPickOrder
    ? (seedPickOrder
        .map((abbr) => teams.find((t) => t.abbr === abbr))
        .filter(Boolean) as (Team & { needs: TeamNeed[] })[])
    : shuffleTeams(teams);
  const rounds = roundsFor(mode);
  const slots: DraftOrderSlot[] = [];
  let overall = 1;
  for (let r = 1; r <= rounds; r++) {
    for (let i = 0; i < order.length; i++) {
      slots.push({ overall: overall++, round: r, team: order[i] });
    }
  }
  return slots;
}

function shuffleTeams<T>(teams: T[]): T[] {
  const copy = teams.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Value = board value + needs bump + positional value prior.
// Temperature controls randomness: lower picks are less dialed in.
export function scoreCandidate(
  player: Player,
  entry: MockBoardEntry,
  slot: DraftOrderSlot,
  pickedPositions: Map<string, number>,
): number {
  const needs = slot.team.needs;
  const needIdx = needs.findIndex((n) => n.position === player.position);
  const needBonus =
    needIdx === -1 ? 0 : Math.max(0, 40 - needIdx * 10); // 40 / 30 / 20 / 10
  const posValue = positionValue(player.position) * 20;

  // Slight taper on value the further you go from the board rank.
  const boardValue = 500 - Math.min(500, entry.rankOverall * 4);

  // Penalize double-dipping positions in early rounds.
  const picksAtPos = pickedPositions.get(slot.team.abbr + ":" + player.position) ?? 0;
  const doubleDipPenalty = picksAtPos > 0 ? 25 * picksAtPos : 0;

  return boardValue + needBonus + posValue - doubleDipPenalty;
}

export function pickForSlot(
  slot: DraftOrderSlot,
  available: MockBoardEntry[],
  pickedPositions: Map<string, number>,
  opts: { temperature?: number } = {},
): MockPickDecision | null {
  if (available.length === 0) return null;
  const temp = opts.temperature ?? Math.max(0.1, 0.6 - slot.round * 0.05);

  const scored = available.map((entry) => ({
    entry,
    score: scoreCandidate(entry.player, entry, slot, pickedPositions),
  }));

  // Softmax-ish: take top K, pick weighted.
  scored.sort((a, b) => b.score - a.score);
  const shortlist = scored.slice(0, 5);
  const probs = shortlist.map((s) => Math.exp(s.score / (100 * temp)));
  const total = probs.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < shortlist.length; i++) {
    r -= probs[i];
    if (r <= 0) return decide(slot, shortlist[i].entry);
  }
  return decide(slot, shortlist[0].entry);
}

function decide(slot: DraftOrderSlot, entry: MockBoardEntry): MockPickDecision {
  const topNeed = slot.team.needs[0]?.position;
  const matchesTop = topNeed === entry.player.position;
  const reason = matchesTop
    ? `Fills the top team need at ${entry.player.position}.`
    : `Best player available (board rank #${entry.rankOverall}).`;
  return {
    slot,
    playerId: entry.player.id,
    playerName: entry.player.fullName,
    playerPosition: entry.player.position,
    reason,
  };
}

// A reasonable 2026 pick order (reverse standings order pre-draft, April 2026).
export const DEFAULT_ORDER_2026 = [
  "NYG","NE","CLE","TEN","LV","NO","CAR","NYJ","JAX","CHI",
  "IND","MIA","DAL","ATL","ARI","SEA","SF","PIT","CIN","TB",
  "DEN","LAC","GB","MIN","HOU","LAR","BAL","WAS","DET","BUF","KC","PHI",
];

// 2025 and 2024 pick orders (actual).
export const DEFAULT_ORDER_2025 = [
  "TEN","CLE","NYG","NE","JAX","LV","NYJ","CAR","NO","CHI",
  "SF","DAL","MIA","IND","ATL","ARI","CIN","SEA","TB","DEN",
  "PIT","LAC","GB","MIN","HOU","LAR","BAL","DET","WAS","BUF","KC","PHI",
];

export const DEFAULT_ORDER_2024 = [
  "CHI","WAS","NE","ARI","LAC","NYG","TEN","ATL","CHI","NYJ",
  "MIN","DEN","LV","NO","IND","SEA","JAX","CIN","LAR","PIT",
  "MIA","PHI","MIN","DAL","GB","TB","ARI","BUF","DET","BAL","SF","KC",
];
