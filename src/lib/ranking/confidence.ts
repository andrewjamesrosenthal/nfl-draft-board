export type ConfidenceLevel = "volatile" | "forming" | "medium" | "high" | "locked";

export function confidenceLevel(sigma: number, comparisons: number): ConfidenceLevel {
  if (comparisons < 3)  return "volatile";
  if (comparisons < 8)  return "forming";
  if (sigma > 260)      return "forming";
  if (sigma > 200)      return "medium";
  if (sigma > 150)      return "high";
  return "locked";
}

export const CONFIDENCE_META: Record<ConfidenceLevel, { label: string; blurb: string; hex: string }> = {
  volatile: { label: "Volatile",       blurb: "Still gathering data",                   hex: "#fda4af" },
  forming:  { label: "Forming",        blurb: "Direction is emerging",                  hex: "#fcd34d" },
  medium:   { label: "Medium",         blurb: "A solid signal but still moving",        hex: "#86efac" },
  high:     { label: "High confidence", blurb: "Well calibrated by your votes",         hex: "#60a5fa" },
  locked:   { label: "Locked in",       blurb: "Tons of data agrees",                   hex: "#a78bfa" },
};
