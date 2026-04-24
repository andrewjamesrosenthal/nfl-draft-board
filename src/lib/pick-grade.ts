// Grade scale: 14 grades A+ → F-, assigned by percentile rank within the class.
// Percentile = what fraction of picks are ranked below this pick (0–100).

export const GRADE_SCALE = [
  { min: 97, label: "A+", hex: "#10b981" },
  { min: 92, label: "A",  hex: "#22c55e" },
  { min: 85, label: "A-", hex: "#4ade80" },
  { min: 75, label: "B+", hex: "#a3e635" },
  { min: 62, label: "B",  hex: "#facc15" },
  { min: 50, label: "B-", hex: "#fb923c" },
  { min: 40, label: "C+", hex: "#f97316" },
  { min: 30, label: "C",  hex: "#ef4444" },
  { min: 22, label: "C-", hex: "#dc2626" },
  { min: 15, label: "D+", hex: "#b91c1c" },
  { min:  9, label: "D",  hex: "#991b1b" },
  { min:  4, label: "D-", hex: "#7f1d1d" },
  { min:  1, label: "F",  hex: "#6b21a8" },
  { min:  0, label: "F-", hex: "#581c87" },
] as const;

export type GradeLabel = (typeof GRADE_SCALE)[number]["label"];

export function percentileToGrade(percentile: number): GradeLabel {
  for (const g of GRADE_SCALE) {
    if (percentile >= g.min) return g.label;
  }
  return "F-";
}

export function gradeInfo(label: GradeLabel) {
  return GRADE_SCALE.find((g) => g.label === label) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
}

// Compute percentile rank (0–100) for each pick given an array of ratings.
// Higher rating → higher percentile.
export function computePercentiles(
  ratings: { id: number; rating: number }[],
): Map<number, number> {
  const sorted = [...ratings].sort((a, b) => a.rating - b.rating);
  const n = sorted.length;
  const map = new Map<number, number>();
  sorted.forEach((r, i) => {
    map.set(r.id, n === 1 ? 50 : Math.round((i / (n - 1)) * 100));
  });
  return map;
}

// Elo update for pick grading. Simpler than the prospect version:
// fixed K that only decays by comparisons (no opponent-confidence weight).
export function eloUpdatePick(
  winnerRating: number,
  loserRating: number,
  winnerComparisons: number,
  loserComparisons: number,
): { winnerDelta: number; loserDelta: number } {
  const k = (comparisons: number) => {
    if (comparisons < 5)  return 32;
    if (comparisons < 15) return 24;
    if (comparisons < 30) return 18;
    return 12;
  };
  const expected = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  const winnerDelta = k(winnerComparisons) * (1 - expected);
  const loserDelta  = k(loserComparisons)  * (0 - expected);
  return { winnerDelta, loserDelta };
}

// Fallback date unlock — the grader also unlocks automatically when
// actual completed picks exist in the DB (checked in each API route).
export const PICK_GRADE_UNLOCK = new Date("2026-04-24T00:00:00Z");

// Ordinal suffix helper for pick display (1st, 2nd, 3rd …).
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
