import { cn } from "@/lib/utils";

export function DisagreementMeter({ delta, compact = false }: { delta: number; compact?: boolean }) {
  const magnitude = Math.min(Math.abs(delta), 50);
  const pct = (magnitude / 50) * 100;
  const direction = delta > 0 ? "lower" : "higher";
  const color = Math.abs(delta) < 5 ? "bg-emerald-500" :
                Math.abs(delta) < 15 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex min-w-[140px] items-center gap-2">
      {!compact && (
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          you have them {direction}
        </div>
      )}
      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="font-mono text-xs">
        {delta > 0 ? "+" : ""}{delta}
      </div>
    </div>
  );
}
