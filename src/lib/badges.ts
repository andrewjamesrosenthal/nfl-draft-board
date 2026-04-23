import db from "./db";

export type BadgeDef = {
  key: string;
  label: string;
  blurb: string;
  emoji: string;
  earnedWhen: (ctx: UserProgress) => boolean;
};

export type UserProgress = {
  comparisons: number;
  rankings: number;
  mocks: number;
  distinctPositions: number;
  watchlist: number;
};

export const BADGES: BadgeDef[] = [
  {
    key: "first_vote",
    label: "First ballot",
    blurb: "You made your very first comparison",
    emoji: "🗳️",
    earnedWhen: (c) => c.comparisons >= 1,
  },
  {
    key: "vote_25",
    label: "Scout in training",
    blurb: "Logged 25 matchups",
    emoji: "🎯",
    earnedWhen: (c) => c.comparisons >= 25,
  },
  {
    key: "vote_100",
    label: "Big board builder",
    blurb: "Logged 100 matchups",
    emoji: "📋",
    earnedWhen: (c) => c.comparisons >= 100,
  },
  {
    key: "vote_500",
    label: "Lifer",
    blurb: "Logged 500 matchups. That is draft Twitter energy.",
    emoji: "🏟️",
    earnedWhen: (c) => c.comparisons >= 500,
  },
  {
    key: "all_positions",
    label: "Positional polyglot",
    blurb: "Voted across at least six distinct positions",
    emoji: "🔀",
    earnedWhen: (c) => c.distinctPositions >= 6,
  },
  {
    key: "mock_run",
    label: "On the clock",
    blurb: "Completed your first mock draft",
    emoji: "⏱️",
    earnedWhen: (c) => c.mocks >= 1,
  },
  {
    key: "mock_three",
    label: "Mock obsessive",
    blurb: "Finished three mock drafts",
    emoji: "🧠",
    earnedWhen: (c) => c.mocks >= 3,
  },
  {
    key: "watch_ten",
    label: "Watchlist locked",
    blurb: "Tracked ten prospects on your watchlist",
    emoji: "👀",
    earnedWhen: (c) => c.watchlist >= 10,
  },
];

export async function computeProgress(userId: string): Promise<UserProgress> {
  const [matchups, rankings, mocks, watch, distinctPosRaw] = await Promise.all([
    db.pairwiseMatchup.count({ where: { userId } }),
    db.userRanking.count({ where: { userId } }),
    db.mockDraft.count({ where: { userId, completedAt: { not: null } } }),
    db.watchlistEntry.count({ where: { userId } }),
    db.pairwiseMatchup.findMany({
      where: { userId },
      select: { left: { select: { position: true } }, right: { select: { position: true } } },
      take: 1000,
    }),
  ]);
  const positions = new Set<string>();
  for (const m of distinctPosRaw) {
    positions.add(m.left.position);
    positions.add(m.right.position);
  }
  return {
    comparisons: matchups,
    rankings,
    mocks,
    distinctPositions: positions.size,
    watchlist: watch,
  };
}

export async function awardEarnedBadges(userId: string): Promise<string[]> {
  const progress = await computeProgress(userId);
  const earned = BADGES.filter((b) => b.earnedWhen(progress));
  if (earned.length === 0) return [];
  const existing = await db.userBadge.findMany({
    where: { userId, key: { in: earned.map((b) => b.key) } },
    select: { key: true },
  });
  const existingKeys = new Set(existing.map((e) => e.key));
  const newlyEarned = earned.filter((b) => !existingKeys.has(b.key));
  if (newlyEarned.length === 0) return [];
  await db.userBadge.createMany({
    data: newlyEarned.map((b) => ({ userId, key: b.key })),
    skipDuplicates: true,
  });
  return newlyEarned.map((b) => b.key);
}
