"use client";
import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Headshot cascade (per CLAUDE.md data-sourcing rules):
//   1) ESPN NFL bucket:      /i/headshots/nfl/players/full/{espn_id}.png
//   2) ESPN college bucket:  /i/headshots/college-football/players/full/{espn_id}.png
//   3) Position-group SVG silhouette
// If a specific `url` is provided we trust it as the primary source, then fall
// back to the ESPN cascade if it 404s.

type Props = {
  url?: string | null;
  espnId?: string | null;
  espnIdSource?: string | null; // "nfl" | "college-football" — which bucket to try first
  positionGroup?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizes: Record<NonNullable<Props["size"]>, { h: number; w: number; cls: string }> = {
  sm: { h: 40,  w: 40,  cls: "h-10 w-10 text-sm" },
  md: { h: 64,  w: 64,  cls: "h-16 w-16 text-lg" },
  lg: { h: 120, w: 120, cls: "h-28 w-28 text-2xl" },
  xl: { h: 200, w: 200, cls: "h-44 w-44 text-4xl" },
};

function buildCascade(
  url?: string | null,
  espnId?: string | null,
  espnIdSource?: string | null,
): string[] {
  const urls: string[] = [];
  if (url) urls.push(url);
  if (espnId) {
    const nfl = `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`;
    const college = `https://a.espncdn.com/i/headshots/college-football/players/full/${espnId}.png`;
    if (espnIdSource === "college-football") {
      urls.push(college, nfl);
    } else {
      urls.push(nfl, college);
    }
  }
  return urls;
}

function silhouetteFor(positionGroup?: string | null): string {
  const known = new Set([
    "OFFENSE_SKILL",
    "OFFENSIVE_LINE",
    "DEFENSIVE_LINE",
    "LINEBACKER",
    "SECONDARY",
    "SPECIAL_TEAMS",
  ]);
  if (positionGroup && known.has(positionGroup)) {
    return `/position-silhouettes/${positionGroup}.svg`;
  }
  return "/position-silhouettes/DEFAULT.svg";
}

export function PlayerHeadshot({
  url,
  espnId,
  espnIdSource,
  positionGroup,
  name,
  size = "md",
  className,
}: Props) {
  const cfg = sizes[size];
  const cascade = buildCascade(url, espnId, espnIdSource);
  const silhouette = silhouetteFor(positionGroup);
  const [idx, setIdx] = useState(0);

  // If we have nothing to fetch (no URL + no ESPN ID), render initials — looks
  // better than a generic silhouette and preserves the pre-cascade behavior
  // for pages that don't pass ESPN fields yet.
  if (cascade.length === 0) {
    const initials = name
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    return (
      <div
        className={cn(
          "relative flex-shrink-0 rounded-full border border-border bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center font-bold text-muted-foreground",
          cfg.cls,
          className,
        )}
        aria-label={name}
      >
        {initials}
      </div>
    );
  }

  const current = cascade[idx] ?? silhouette;
  const isSilhouette = idx >= cascade.length;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full border border-border bg-muted flex-shrink-0",
        cfg.cls,
        className,
      )}
      aria-label={name}
      title={name}
    >
      <Image
        key={current}
        src={current}
        alt={name}
        fill
        sizes={`${cfg.w}px`}
        className={cn("object-cover", isSilhouette && "object-contain p-1")}
        onError={() => {
          if (idx < cascade.length) setIdx(idx + 1);
        }}
        unoptimized={isSilhouette}
      />
    </div>
  );
}
