import { CONFIDENCE_META, type ConfidenceLevel } from "@/lib/ranking/confidence";
import { Badge } from "./ui/badge";

// Fall back to "volatile" styling if we ever get an unknown level (e.g. a
// stale API response or a null value slipping through). Cheaper than throwing
// when the only thing at stake is a tiny confidence pill.
const FALLBACK = { label: "Unrated", blurb: "Not enough data yet", hex: "#64748b" };

export function ConfidencePill({
  level,
  compact = false,
}: {
  level: ConfidenceLevel | null | undefined;
  compact?: boolean;
}) {
  const meta = (level && CONFIDENCE_META[level]) ?? FALLBACK;
  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.hex }}
      />
      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
        {meta.label}
      </Badge>
      {!compact && (
        <span className="text-xs text-muted-foreground">{meta.blurb}</span>
      )}
    </div>
  );
}
