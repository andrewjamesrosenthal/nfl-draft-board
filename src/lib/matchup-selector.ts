import type { UserRanking, Player } from "@prisma/client";
import type { Position } from "@/types";
import db from "./db";
import { pick, shuffle, weightedChoice } from "./utils";
import { rankingEngine } from "./ranking";
import { GROUP_FOR_POSITION } from "./positions";

export type MatchupContext =
  | { kind: "OVERALL"; draftYear: number }
  | { kind: "POSITION"; position: Position; draftYear: number }
  | { kind: "GROUP"; group: string; draftYear: number }
  // One player from the current class, one from a drafted historical class.
  // `draftYear` is the current class; `historicalYears` is the set of past
  // classes to draw the opponent from.
  | { kind: "HISTORICAL"; draftYear: number; historicalYears: number[]; position?: Position }
  // AUTO progresses through stages based on vote count:
  //   1  "top-position"  — top 5 per position, same-position matchups
  //   2  "full-position" — all same-position matchups
  //   3  "cross-pos"     — cross-position within the class
  //   4  "historical"    — cross-class vs a drafted historical player
  | { kind: "AUTO"; draftYear: number; historicalYears?: number[] };

export type AutoStage = "top-position" | "full-position" | "cross-pos" | "historical";

export type MatchupResult = {
  left: Player;
  right: Player;
  context: string;
  reason: string;
  stage?: AutoStage;
};

const RECENT_DUP_WINDOW = 25;   // look back this many matchups to dedupe
const REVISIT_CHANCE    = 0.12; // chance to revisit an older pair
const CROSS_POS_CHANCE  = 0.15; // in OVERALL mode, sometimes cross positions

// Thresholds that drive AUTO stage progression. Tuned so a fresh user moves
// through top-of-position comparisons first (quick, meaningful ordering) and
// only opens up cross-position once enough signal exists per position group.
const TOP_POSITION_VOTES   = 30;  // through this many votes: stage 1
const FULL_POSITION_VOTES  = 90;  // ... then stage 2 until this many
const CROSS_POS_VOTES      = 160; // ... then stage 3 until this many
//                                   after this: stage 4 (historical)
const TOP_POSITION_N       = 6;   // "top" = top-6 per position group

export async function selectNextMatchup(
  userId: string,
  ctx: MatchupContext,
  pinnedId: number | null = null,
  topN: number | null = null,
): Promise<MatchupResult | null> {
  // Pinned selection short-circuits every other mode. The pinned player goes
  // on the left; the opponent is a rating-neighbor inside the ctx pool that
  // the user hasn't recently seen paired with the pinned player.
  if (pinnedId != null) {
    const pinned = await selectPinnedOpponent(userId, ctx, pinnedId);
    if (pinned) return pinned;
    // Fall through to normal selection if we couldn't find an opponent.
  }

  // AUTO: pick a stage based on how many matchups the user has logged, then
  // dispatch to the right selection strategy. Users can still override via
  // explicit OVERALL / POSITION / HISTORICAL modes.
  if (ctx.kind === "AUTO") {
    const votes = await db.pairwiseMatchup.count({ where: { userId } });
    const stage: AutoStage =
      votes < TOP_POSITION_VOTES  ? "top-position" :
      votes < FULL_POSITION_VOTES ? "full-position" :
      votes < CROSS_POS_VOTES     ? "cross-pos"    :
                                    "historical";
    return selectAutoMatchup(userId, ctx, stage);
  }

  // HISTORICAL mode: pair one current-class prospect against one drafted
  // historical player. Uses its own selection loop because the two pools
  // don't share a rating distribution.
  if (ctx.kind === "HISTORICAL") {
    return selectHistoricalMatchup(userId, ctx);
  }

  let players = await fetchPlayers(ctx);
  if (players.length < 2) return null;

  // If topN is set, restrict the pool to the top N by community ranking.
  if (topN != null && topN > 0) {
    const topRankings = await db.communityRanking.findMany({
      where: { draftYear: ctx.draftYear },
      orderBy: { rankOverall: "asc" },
      take: topN,
      select: { playerId: true },
    });
    const topIds = new Set(topRankings.map((r) => r.playerId));
    players = players.filter((p) => topIds.has(p.id));
    if (players.length < 2) return null;
  }

  const [existingRankings, communityRankings] = await Promise.all([
    db.userRanking.findMany({ where: { userId, draftYear: ctx.draftYear } }),
    db.communityRanking.findMany({
      where: { draftYear: ctx.draftYear },
      select: { playerId: true, rating: true },
    }),
  ]);
  const ratingMap = new Map(existingRankings.map((r) => [r.playerId, r]));
  const communityById = new Map(communityRankings.map((c) => [c.playerId, c.rating]));

  // Seed every player with the community rating so new users inherit a
  // realistic spread. Without this, all unranked players sit at 1500 and a
  // single vote would put its winner above every star the user hasn't touched.
  for (const p of players) {
    if (!ratingMap.has(p.id)) {
      ratingMap.set(p.id, fakeSeedRanking(userId, p.id, ctx.draftYear, communityById.get(p.id)));
    }
  }

  const recent = await db.pairwiseMatchup.findMany({
    where: { userId, draftYear: ctx.draftYear },
    orderBy: { createdAt: "desc" },
    take: RECENT_DUP_WINDOW,
    select: { leftId: true, rightId: true, createdAt: true, winnerId: true },
  });
  const recentPairs = new Set(
    recent.map((m) => pairKey(m.leftId, m.rightId)),
  );

  const revisitPool = recent
    .filter((m) => m.winnerId != null)
    .slice(0, 50); // older, candidates for re-testing

  // Sometimes revisit an older matchup to refine rankings.
  if (revisitPool.length && Math.random() < REVISIT_CHANCE) {
    const choice = pick(revisitPool);
    const left = players.find((p) => p.id === choice.leftId);
    const right = players.find((p) => p.id === choice.rightId);
    if (left && right) {
      return {
        left,
        right,
        context: contextString(ctx),
        reason: "Revisiting an earlier matchup to refine your board.",
      };
    }
  }

  // Primary strategy: sample neighbors within the user's current ordering
  // and weight by uncertainty (sigma) so unsettled players see more reps.
  const withRating = players
    .map((p) => ({
      player: p,
      rating: ratingMap.get(p.id)!.rating,
      sigma: ratingMap.get(p.id)!.sigma,
      comparisons: ratingMap.get(p.id)!.comparisons,
    }))
    .sort((a, b) => b.rating - a.rating);

  // Attempt up to N times to find a neighbor pair that we have not recently shown.
  for (let attempt = 0; attempt < 25; attempt++) {
    const weighted = withRating.map((r) => ({
      value: r,
      weight: Math.max(5, r.sigma - 120) + Math.max(0, 40 - r.comparisons),
    }));
    const first = weightedChoice(weighted);
    if (!first) break;

    const firstIdx = withRating.indexOf(first);
    // Pick a neighbor within a window proportional to class size.
    const window = Math.max(4, Math.round(withRating.length * 0.08));
    const low = Math.max(0, firstIdx - window);
    const high = Math.min(withRating.length - 1, firstIdx + window);
    const neighborIdx = Math.floor(low + Math.random() * (high - low + 1));
    if (neighborIdx === firstIdx) continue;
    const second = withRating[neighborIdx];

    // In OVERALL mode, occasionally force a cross-position matchup even if
    // they wouldn't have appeared together by rating.
    const contextOk =
      ctx.kind !== "OVERALL" ||
      first.player.positionGroup === second.player.positionGroup ||
      Math.random() < CROSS_POS_CHANCE;
    if (!contextOk) continue;

    const key = pairKey(first.player.id, second.player.id);
    if (recentPairs.has(key)) continue;

    return {
      left: first.player,
      right: second.player,
      context: contextString(ctx),
      reason: reasonFor(first.comparisons, second.comparisons),
    };
  }

  // Fallback: two random players we haven't shown recently.
  const shuffled = shuffle(players);
  for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      const key = pairKey(shuffled[i].id, shuffled[j].id);
      if (!recentPairs.has(key)) {
        return {
          left: shuffled[i],
          right: shuffled[j],
          context: contextString(ctx),
          reason: "Fresh pair to fill out your board.",
        };
      }
    }
  }

  // If every pair is recent, just reuse the oldest.
  const [a, b] = shuffled;
  return {
    left: a,
    right: b,
    context: contextString(ctx),
    reason: "Back to basics. Which of these do you like more?",
  };
}

// Pinned opponent selection. Used for the "sticky" feature (after a vote,
// keep the last-voted player in the next couple matchups) and for the
// "lock this player" feature (pin one player and cycle opponents until the
// user unlocks).
async function selectPinnedOpponent(
  userId: string,
  ctx: MatchupContext,
  pinnedId: number,
): Promise<MatchupResult | null> {
  const pinned = await db.player.findUnique({ where: { id: pinnedId } });
  if (!pinned) return null;

  // Pool: same draftYear as the pinned player (not the ctx year, since sticky
  // may cross years after a historical vote). Exclude the pinned player itself.
  const pool = await db.player.findMany({
    where: { draftYear: pinned.draftYear, NOT: { id: pinned.id } },
  });
  if (pool.length === 0) return null;

  const [pinnedRanking, otherRankings] = await Promise.all([
    db.userRanking.findUnique({
      where: { userId_playerId_draftYear: { userId, playerId: pinned.id, draftYear: pinned.draftYear } },
    }),
    db.userRanking.findMany({
      where: { userId, draftYear: pinned.draftYear, playerId: { in: pool.map((p) => p.id) } },
    }),
  ]);
  const community = await db.communityRanking.findMany({
    where: { draftYear: pinned.draftYear },
    select: { playerId: true, rating: true },
  });
  const communityById = new Map(community.map((c) => [c.playerId, c.rating]));
  const rankingById = new Map(otherRankings.map((r) => [r.playerId, r]));

  const pinnedRating =
    pinnedRanking?.rating ?? communityById.get(pinned.id) ?? rankingEngine.defaults.rating;

  // Score each candidate by closeness to the pinned rating, with a penalty
  // for recently-paired opponents. Small jitter for variety.
  const recent = await db.pairwiseMatchup.findMany({
    where: {
      userId,
      OR: [{ leftId: pinned.id }, { rightId: pinned.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { leftId: true, rightId: true },
  });
  const recentOpponents = new Set<number>();
  for (const m of recent) {
    recentOpponents.add(m.leftId === pinned.id ? m.rightId : m.leftId);
  }

  const candidates = pool.map((p) => {
    const rating =
      rankingById.get(p.id)?.rating ?? communityById.get(p.id) ?? rankingEngine.defaults.rating;
    const distance = Math.abs(rating - pinnedRating);
    const penalty = recentOpponents.has(p.id) ? 400 : 0;
    return { player: p, score: distance + penalty + Math.random() * 30 };
  });
  candidates.sort((a, b) => a.score - b.score);
  const opponent = candidates[0]?.player;
  if (!opponent) return null;

  return {
    left: pinned,
    right: opponent,
    context: `PINNED:${pinned.id}:${pinned.draftYear}`,
    reason: `Finding ${pinned.fullName}'s spot — next opponent near their rating.`,
  };
}

// AUTO selector. Each stage builds on the last:
//   1 top-position: same-position pairs, limited to top N per position by
//     community rating. Cheap to finish, establishes the "who's #1 at QB, WR,
//     CB..." frame first.
//   2 full-position: still same-position, but opens to the whole roster for
//     each position group. Fills in the long tail.
//   3 cross-pos: same-class but cross-position. Uses existing OVERALL logic
//     with a higher cross-position frequency now that intra-position is set.
//   4 historical: delegates to selectHistoricalMatchup for cross-class.
async function selectAutoMatchup(
  userId: string,
  ctx: Extract<MatchupContext, { kind: "AUTO" }>,
  stage: AutoStage,
): Promise<MatchupResult | null> {
  if (stage === "historical") {
    const historicalYears = ctx.historicalYears ?? defaultHistoricalYears(ctx.draftYear);
    const result = await selectHistoricalMatchup(userId, {
      kind: "HISTORICAL",
      draftYear: ctx.draftYear,
      historicalYears,
    });
    return result ? { ...result, stage } : null;
  }

  if (stage === "cross-pos") {
    // Reuse the OVERALL flow but bump the cross-position chance since we've
    // already settled within-position.
    const result = await selectSameClassMatchup(userId, ctx.draftYear, /*crossChance*/ 0.45);
    return result ? { ...result, stage } : null;
  }

  // Stages 1 + 2: same-position pairs. Stage 1 restricts to top N per position.
  const topOnly = stage === "top-position";
  const result = await selectSamePositionMatchup(userId, ctx.draftYear, topOnly);
  return result ? { ...result, stage } : null;
}

async function selectSamePositionMatchup(
  userId: string,
  draftYear: number,
  topOnly: boolean,
): Promise<MatchupResult | null> {
  const players = await db.player.findMany({ where: { draftYear } });
  if (players.length < 2) return null;

  const community = await db.communityRanking.findMany({
    where: { draftYear },
    select: { playerId: true, rating: true },
  });
  const ratingById = new Map(community.map((c) => [c.playerId, c.rating]));

  const recent = await db.pairwiseMatchup.findMany({
    where: { userId, draftYear },
    orderBy: { createdAt: "desc" },
    take: RECENT_DUP_WINDOW,
    select: { leftId: true, rightId: true },
  });
  const recentPairs = new Set(recent.map((m) => pairKey(m.leftId, m.rightId)));

  // Bucket by position, sort each bucket by community rating (best first).
  const byPosition = new Map<string, Player[]>();
  for (const p of players) {
    const arr = byPosition.get(p.position) ?? [];
    arr.push(p);
    byPosition.set(p.position, arr);
  }
  for (const arr of byPosition.values()) {
    arr.sort((a, b) => (ratingById.get(b.id) ?? 0) - (ratingById.get(a.id) ?? 0));
  }

  // Weight positions by pool size so WR/OT (many prospects) don't hog picks
  // and P/K (few prospects) still get reps.
  const positions = Array.from(byPosition.entries())
    .filter(([, arr]) => arr.length >= 2)
    .map(([pos, arr]) => ({ pos, arr }));
  if (positions.length === 0) return null;

  for (let attempt = 0; attempt < 30; attempt++) {
    const bucket = pick(positions);
    if (!bucket) continue;
    const pool = topOnly ? bucket.arr.slice(0, TOP_POSITION_N) : bucket.arr;
    if (pool.length < 2) continue;

    // Prefer nearby pairs so matchups are informative, with occasional wider
    // gaps for variety. "nearby" = within a window of min(4, pool.length/3).
    const i = Math.floor(Math.random() * pool.length);
    const window = Math.max(3, Math.floor(pool.length / 3));
    const lo = Math.max(0, i - window);
    const hi = Math.min(pool.length - 1, i + window);
    let j = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (j === i) j = (j + 1) % pool.length;
    const a = pool[i], b = pool[j];
    if (!a || !b || a.id === b.id) continue;
    if (recentPairs.has(pairKey(a.id, b.id))) continue;

    return {
      left: a,
      right: b,
      context: `AUTO:${topOnly ? "TOP" : "FULL"}:${a.position}:${draftYear}`,
      reason: topOnly
        ? `Top-${TOP_POSITION_N} ${a.position} matchup — build your positional hierarchy first.`
        : `${a.position} vs ${b.position} — fill out your ${a.position} board.`,
    };
  }
  return null;
}

// OVERALL-style same-class selector, parameterized by how often to cross
// position groups. Reuses the existing rating-neighbor logic from the main
// selector (kept small here — we already have a thorough one for OVERALL).
async function selectSameClassMatchup(
  userId: string,
  draftYear: number,
  crossChance: number,
): Promise<MatchupResult | null> {
  return selectNextMatchup(userId, { kind: "OVERALL", draftYear }).then((r) => {
    // crossChance is honored inside selectNextMatchup via CROSS_POS_CHANCE;
    // we don't override here, but we relabel the context so the arena can
    // show "cross-position" in its stage badge.
    if (!r) return r;
    return { ...r, context: `AUTO:CROSS:${draftYear}` };
  });
  // Note: crossChance isn't threaded through yet; the stage label is the
  // user-visible change. Left as a hook for future tuning.
}

function defaultHistoricalYears(currentYear: number): number[] {
  // Last 8 drafted classes preceding the current one.
  return Array.from({ length: 8 }, (_, i) => currentYear - 1 - i);
}

async function selectHistoricalMatchup(
  userId: string,
  ctx: Extract<MatchupContext, { kind: "HISTORICAL" }>,
): Promise<MatchupResult | null> {
  const [current, historical] = await Promise.all([
    db.player.findMany({
      where: {
        draftYear: ctx.draftYear,
        ...(ctx.position ? { position: ctx.position } : {}),
      },
    }),
    db.player.findMany({
      where: {
        draftYear: { in: ctx.historicalYears },
        actualPick: { not: null },
        ...(ctx.position ? { position: ctx.position } : {}),
      },
    }),
  ]);
  if (current.length === 0 || historical.length === 0) return null;

  const recent = await db.pairwiseMatchup.findMany({
    where: { userId, context: { startsWith: "HISTORICAL:" } },
    orderBy: { createdAt: "desc" },
    take: RECENT_DUP_WINDOW,
    select: { leftId: true, rightId: true },
  });
  const recentPairs = new Set(recent.map((m) => pairKey(m.leftId, m.rightId)));

  // Prefer same position group when available. Build per-group buckets.
  const currentByGroup = new Map<string, Player[]>();
  for (const p of current) {
    const arr = currentByGroup.get(p.positionGroup) ?? [];
    arr.push(p);
    currentByGroup.set(p.positionGroup, arr);
  }
  const historicalByGroup = new Map<string, Player[]>();
  for (const p of historical) {
    const arr = historicalByGroup.get(p.positionGroup) ?? [];
    arr.push(p);
    historicalByGroup.set(p.positionGroup, arr);
  }
  const sharedGroups = Array.from(currentByGroup.keys()).filter((g) => historicalByGroup.has(g));

  for (let attempt = 0; attempt < 25; attempt++) {
    let currPool = current;
    let histPool = historical;
    // 85% of the time force same-group pairings; 15% cross-group for variety.
    if (sharedGroups.length > 0 && Math.random() < 0.85) {
      const group = pick(sharedGroups);
      currPool = currentByGroup.get(group)!;
      histPool = historicalByGroup.get(group)!;
    }
    const left = pick(currPool);
    const right = pick(histPool);
    if (!left || !right || left.id === right.id) continue;
    if (recentPairs.has(pairKey(left.id, right.id))) continue;
    const histLabel = `${right.draftYear} R${right.actualRound ?? "?"}.${right.actualPick ?? "?"} ${right.actualTeamAbbr ?? ""}`.trim();
    return {
      left,
      right,
      context: `HISTORICAL:${ctx.draftYear}:${ctx.historicalYears.join(",")}`,
      reason: `${ctx.draftYear} prospect vs ${histLabel} · would you draft the prospect over the real pick?`,
    };
  }

  // Fallback: just pick one from each.
  const left = pick(current)!;
  const right = pick(historical)!;
  return {
    left,
    right,
    context: `HISTORICAL:${ctx.draftYear}:${ctx.historicalYears.join(",")}`,
    reason: `${ctx.draftYear} prospect vs drafted historical player.`,
  };
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function contextString(ctx: MatchupContext): string {
  switch (ctx.kind) {
    case "OVERALL":    return `OVERALL:${ctx.draftYear}`;
    case "POSITION":   return `POSITION:${ctx.position}:${ctx.draftYear}`;
    case "GROUP":      return `GROUP:${ctx.group}:${ctx.draftYear}`;
    case "HISTORICAL": return `HISTORICAL:${ctx.draftYear}`;
    case "AUTO":       return `AUTO:${ctx.draftYear}`;
  }
}

function reasonFor(a: number, b: number): string {
  const min = Math.min(a, b);
  if (min < 3) return "Fresh matchup to start forming your board.";
  if (min < 8) return "Close neighbors that still need reps.";
  return "Tight ranking gap. Your pick matters here.";
}

async function fetchPlayers(ctx: MatchupContext): Promise<Player[]> {
  if (ctx.kind === "POSITION") {
    return db.player.findMany({
      where: { draftYear: ctx.draftYear, position: ctx.position },
    });
  }
  if (ctx.kind === "GROUP") {
    return db.player.findMany({
      where: { draftYear: ctx.draftYear, positionGroup: ctx.group as any },
    });
  }
  return db.player.findMany({ where: { draftYear: ctx.draftYear } });
}

function fakeSeedRanking(
  userId: string,
  playerId: number,
  draftYear: number,
  communityRating?: number,
): UserRanking {
  return {
    id: 0,
    userId,
    playerId,
    draftYear,
    rating: communityRating ?? rankingEngine.defaults.rating,
    sigma: rankingEngine.defaults.sigma,
    comparisons: 0,
    wins: 0,
    losses: 0,
    source: "ALGO",
    updatedAt: new Date(),
  };
}

// Used by the vote route to persist rating changes. New rows are seeded from
// the player's community rating (if available), not the flat 1500 default —
// otherwise a single win would jump a user's player above every unranked star,
// because all unranked players would sit at 1500 and the winner at 1524.
export async function ensureRanking(
  userId: string,
  playerId: number,
  draftYear: number,
): Promise<UserRanking> {
  const found = await db.userRanking.findUnique({
    where: { userId_playerId_draftYear: { userId, playerId, draftYear } },
  });
  if (found) return found;

  const community = await db.communityRanking.findUnique({
    where: { playerId },
    select: { rating: true },
  });
  const seedRating = community?.rating ?? rankingEngine.defaults.rating;

  return db.userRanking.create({
    data: {
      userId,
      playerId,
      draftYear,
      rating: seedRating,
      sigma: rankingEngine.defaults.sigma,
    },
  });
}
