"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { ordinal } from "@/lib/pick-grade";

type GradedPick = {
  id: number;
  slug: string;
  fullName: string;
  position: string;
  school: string;
  espnId: string | null;
  espnIdSource: string | null;
  actualPick: number;
  actualRound: number;
  actualTeamAbbr: string;
  teamName: string;
  teamPrimaryHex: string | null;
  rating: number;
  percentile: number;
  grade: string;
  gradeHex: string;
};

function GradeBadge({ grade, hex }: { grade: string; hex: string }) {
  return (
    <span
      className="inline-flex items-center justify-center w-12 h-12 rounded-xl text-lg font-black shadow-md border border-white/10"
      style={{ background: hex, color: "#fff" }}
    >
      {grade}
    </span>
  );
}

export function PickGradeBoard({ year = 2026 }: { year?: number }) {
  const [picks, setPicks] = useState<GradedPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"personal" | "community">("personal");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pick-grade/rankings?year=${year}&scope=${scope}`)
      .then((r) => r.json())
      .then((d) => { setPicks(d.picks ?? []); setLoading(false); });
  }, [year, scope]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (picks.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground text-sm">
        No picks graded yet — head to the arena to start grading.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Scope toggle */}
      <div className="flex gap-2">
        {(["personal", "community"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              scope === s
                ? "bg-brand text-brand-foreground"
                : "border border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "personal" ? "My Grades" : "Community"}
          </button>
        ))}
      </div>

      {/* Pick rows */}
      <div className="flex flex-col gap-1.5">
        {picks.map((p, i) => {
          const headshotSrc = p.espnId
            ? p.espnIdSource === "nfl"
              ? `https://a.espncdn.com/i/headshots/nfl/players/full/${p.espnId}.png`
              : `https://a.espncdn.com/i/headshots/college-football/players/full/${p.espnId}.png`
            : null;

          return (
            <Link
              key={p.id}
              href={`/player/${p.slug}`}
              className="card-lux flex items-center gap-3 rounded-xl px-4 py-3 hover-lift transition-all"
            >
              {/* Rank */}
              <span className="w-6 text-center text-xs font-bold text-muted-foreground shrink-0">
                {i + 1}
              </span>

              {/* Grade badge */}
              <GradeBadge grade={p.grade} hex={p.gradeHex} />

              {/* Headshot */}
              <div className="relative h-10 w-10 shrink-0">
                {headshotSrc ? (
                  <Image
                    src={headshotSrc}
                    alt={p.fullName}
                    fill
                    className="rounded-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {p.fullName[0]}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{p.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.teamName} · {ordinal(p.actualRound)} round, Pick #{p.actualPick}
                </p>
              </div>

              {/* Position + rating */}
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs">{p.position}</Badge>
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {p.rating.toFixed(0)} Elo
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
