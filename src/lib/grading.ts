import type { MockDraftPick, Player, CommunityRanking } from "@prisma/client";

export type GradedPick = {
  pick: MockDraftPick;
  player: Player;
  boardRank: number;
  delta: number; // positive = reach (taken earlier than board), negative = value
  verdict: "steal" | "value" | "fair" | "reach" | "major-reach";
};

export function gradePicks(
  picks: (MockDraftPick & { player: Player | null })[],
  communityRankings: (CommunityRanking & { player: Player })[],
): GradedPick[] {
  const rankByPlayer = new Map(
    communityRankings.map((c) => [c.playerId, c.rankOverall ?? 999]),
  );
  return picks
    .filter((p): p is MockDraftPick & { player: Player } => !!p.player)
    .map((p) => {
      const boardRank = rankByPlayer.get(p.player.id) ?? 999;
      const delta = p.overallPick - boardRank;
      const verdict =
        delta >= 20 ? "steal" :
        delta >= 8  ? "value" :
        delta >= -8 ? "fair" :
        delta >= -20 ? "reach" : "major-reach";
      return { pick: p, player: p.player, boardRank, delta, verdict };
    });
}

export function overallGrade(graded: GradedPick[]): { grade: number; letter: string } {
  if (graded.length === 0) return { grade: 0, letter: "N/A" };
  const avg =
    graded.reduce((acc, g) => acc + g.delta, 0) / graded.length;
  const raw = 7 + Math.tanh(avg / 15) * 2.5; // squish into 4.5..9.5
  const grade = Math.max(0, Math.min(10, raw));
  const letter =
    grade >= 9   ? "A+" :
    grade >= 8.3 ? "A"  :
    grade >= 7.8 ? "A-" :
    grade >= 7.3 ? "B+" :
    grade >= 6.8 ? "B"  :
    grade >= 6.3 ? "B-" :
    grade >= 5.8 ? "C+" :
    grade >= 5.3 ? "C"  : "C-";
  return { grade, letter };
}
