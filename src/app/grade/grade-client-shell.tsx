"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Swords, BarChart3 } from "lucide-react";
import { PickGradeArena } from "@/components/pick-grade-arena";
import { PickGradeBoard } from "@/components/pick-grade-board";

type Tab = "arena" | "board";

export function GradeClientShell({ year = 2026 }: { year?: number }) {
  const [tab, setTab] = useState<Tab>("arena");

  return (
    <div className="flex flex-col gap-6">
      {/* Tab bar */}
      <div className="flex gap-2">
        {([
          { id: "arena" as Tab, label: "Grade Picks", icon: Swords },
          { id: "board" as Tab, label: "Grades Board", icon: BarChart3 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              tab === id
                ? "bg-brand text-brand-foreground"
                : "border border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "arena" ? (
        <PickGradeArena year={year} />
      ) : (
        <PickGradeBoard year={year} />
      )}
    </div>
  );
}
