"use client";
import { useEffect, useMemo, useState } from "react";
import type { Player } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Select } from "./ui/select";
import { Button } from "./ui/button";
import { PlayerHeadshot } from "./player-headshot";
import { ConfidencePill } from "./confidence-pill";
import Link from "next/link";
import { POSITIONS, POSITION_COLOR, POSITION_LABELS } from "@/lib/positions";
import { formatHeight, formatWeight, formatForty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GripVertical, RotateCcw, Users, ClipboardList, Download, Star } from "lucide-react";

type Mode = "personal" | "community";

type BoardItem = {
  rank: number;
  rating: number;
  sigma: number;
  comparisons: number;
  wins: number;
  losses: number;
  confidence: any;
  manualRank: number | null;
  onNeed?: boolean;
  source?: "personal" | "default";
  player: Player & { reports?: any[] };
};

const DRAFT_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

export function BoardList({
  mode: initialMode,
  title,
  description,
}: {
  mode: Mode;
  title: string;
  description?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [year, setYear] = useState(2026);
  const [position, setPosition] = useState<string>("");
  const [team, setTeam] = useState<string>("");
  const [items, setItems] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<string[]>([]);
  const [watchIds, setWatchIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const url = mode === "personal" ? "/api/rankings/personal" : "/api/rankings/community";
      const params = new URLSearchParams({ year: String(year) });
      if (position) params.set("position", position);
      if (team) params.set("team", team);
      const res = await fetch(`${url}?${params.toString()}`);
      const json = await res.json();
      setItems(json.items ?? []);
      setLoading(false);
    })();
  }, [mode, year, position, team]);

  useEffect(() => {
    // Load the watchlist once on mount so each row can show its star filled or
    // empty without needing a per-row fetch.
    (async () => {
      const res = await fetch("/api/user/watchlist");
      if (!res.ok) return;
      const json = await res.json();
      setWatchIds(new Set((json.items ?? []).map((w: { playerId: number }) => w.playerId)));
    })();
  }, []);

  const toggleWatch = async (playerId: number) => {
    const inList = watchIds.has(playerId);
    // Optimistic update — flip local state immediately, then sync. On failure,
    // revert.
    const next = new Set(watchIds);
    if (inList) next.delete(playerId); else next.add(playerId);
    setWatchIds(next);
    try {
      const res = inList
        ? await fetch(`/api/user/watchlist?playerId=${playerId}`, { method: "DELETE" })
        : await fetch(`/api/user/watchlist`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId }),
          });
      if (!res.ok) throw new Error("watchlist failed");
    } catch {
      setWatchIds(watchIds);
    }
  };

  useEffect(() => {
    // fetch team abbreviations from teams API (via community rankings endpoint is overkill; use static)
    setTeams([
      "ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB",
      "HOU","IND","JAX","KC","LAC","LAR","LV","MIA","MIN","NE","NO","NYG","NYJ",
      "PHI","PIT","SEA","SF","TB","TEN","WAS",
    ]);
  }, []);

  const tiers = useMemo(() => {
    if (items.length === 0) return [] as BoardItem[][];
    const sorted = items.slice().sort((a, b) => a.rank - b.rank);
    const buckets: BoardItem[][] = [];
    let current: BoardItem[] = [];
    let prev: number | null = null;
    for (const item of sorted) {
      if (prev == null || Math.abs(item.rating - prev) < 30) {
        current.push(item);
      } else {
        if (current.length) buckets.push(current);
        current = [item];
      }
      prev = item.rating;
    }
    if (current.length) buckets.push(current);
    return buckets;
  }, [items]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col">
              <CardTitle>{mode === "personal" ? "My board" : "Community consensus"}</CardTitle>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <BoardTabs mode={mode} onChange={setMode} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <FilterSelect label="Class" value={String(year)} onChange={(v) => setYear(Number(v))}
            options={DRAFT_YEARS.map((y) => ({ value: String(y), label: String(y) }))} />
          <FilterSelect label="Position" value={position} onChange={setPosition}
            options={[{ value: "", label: "All positions" }, ...POSITIONS.map((p) => ({ value: p, label: POSITION_LABELS[p] }))]} />
          <FilterSelect label="Team needs" value={team} onChange={setTeam}
            options={[{ value: "", label: "No filter" }, ...teams.map((t) => ({ value: t, label: t }))]} />
          <ExportCsvButton mode={mode} year={year} position={position} />
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground animate-pulse">Loading board...</CardContent></Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {mode === "personal" ? (
              <>No rankings yet. <Link className="text-brand underline" href="/compare">Start comparing</Link> to build your board.</>
            ) : (
              <>No community rankings for this view yet.</>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {tiers.map((tier, tIdx) => (
            <div key={tIdx} className="flex flex-col gap-2">
              <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="rounded-md bg-muted/50 px-2 py-0.5 font-semibold">Tier {tIdx + 1}</span>
                <span>Ratings ~{Math.round(tier[tier.length - 1]!.rating)} to {Math.round(tier[0]!.rating)}</span>
                <span className="opacity-60">{tier.length} players</span>
              </div>
              {tier.map((item) => (
                <BoardRow
                  key={item.player.id}
                  item={item}
                  mode={mode}
                  year={year}
                  watching={watchIds.has(item.player.id)}
                  onToggleWatch={() => toggleWatch(item.player.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportCsvButton({
  mode, year, position,
}: { mode: Mode; year: number; position: string }) {
  const href = (() => {
    const params = new URLSearchParams({ scope: mode, year: String(year) });
    if (position) params.set("position", position);
    return `/api/rankings/export?${params.toString()}`;
  })();
  return (
    <a
      href={href}
      download
      className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 text-sm text-foreground/90 transition-colors hover:border-brand/40 hover:text-foreground"
      title={`Download ${mode} board as CSV`}
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Export CSV</span>
    </a>
  );
}

function BoardTabs({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  const tabs: { id: Mode; label: string; icon: typeof ClipboardList }[] = [
    { id: "personal",  label: "My board",  icon: ClipboardList },
    { id: "community", label: "Community", icon: Users },
  ];
  return (
    <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors",
            mode === id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col">
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </div>
  );
}

function BoardRow({
  item, mode, year, watching, onToggleWatch,
}: {
  item: BoardItem;
  mode: "personal" | "community";
  year: number;
  watching: boolean;
  onToggleWatch: () => void;
}) {
  const pos = item.player.position;
  const isTopTen = item.rank <= 10;
  return (
    <Card className="hover-lift group relative overflow-hidden">
      {/* Accent stripe on the left edge. Fades in on hover. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-0 w-[3px] rounded-full opacity-0 transition-opacity group-hover:opacity-100",
          "bg-gradient-to-b from-brand to-brand-2",
        )}
      />
      <CardContent className="flex items-center gap-4 p-3.5">
        <button
          type="button"
          onClick={onToggleWatch}
          aria-label={watching ? "Remove from watchlist" : "Add to watchlist"}
          title={watching ? "Remove from watchlist" : "Add to watchlist"}
          className={cn(
            "group/star inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
            watching
              ? "border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25"
              : "border-border/60 bg-muted/20 text-muted-foreground hover:border-amber-400/40 hover:text-amber-300",
          )}
        >
          <Star
            className={cn("h-4 w-4 transition-transform group-hover/star:scale-110", watching && "fill-current")}
          />
        </button>
        <div
          className={cn(
            "w-12 shrink-0 text-center font-display text-2xl leading-none num",
            isTopTen ? "text-foreground font-black" : "text-muted-foreground/70 font-semibold",
          )}
        >
          {item.rank}
        </div>
        <PlayerHeadshot url={item.player.headshotUrl} espnId={item.player.espnId} espnIdSource={item.player.espnIdSource} positionGroup={item.player.positionGroup} name={item.player.fullName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={`/player/${item.player.slug}`}
              className="truncate font-semibold tracking-tight hover:text-brand"
            >
              {item.player.fullName}
            </Link>
            <Badge variant="outline" className={cn(POSITION_COLOR[pos], "font-semibold")}>{pos}</Badge>
            {item.onNeed && <Badge variant="brand">team need</Badge>}
            {item.manualRank != null && (
              <Badge variant="warning" className="flex items-center gap-1">
                <GripVertical className="h-3 w-3" /> manual
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="truncate">{item.player.school}</span>
            {item.player.conference && <span className="opacity-60">· {item.player.conference}</span>}
            <span className="opacity-40">·</span>
            <span className="num">{formatHeight(item.player.heightInches)} / {formatWeight(item.player.weightLbs)}</span>
            {item.player.fortyYard != null && <><span className="opacity-40">·</span><span className="num">{formatForty(item.player.fortyYard)} 40</span></>}
          </div>
          {mode === "personal" && (
            <div className="mt-1.5"><ConfidencePill level={item.confidence} compact /></div>
          )}
        </div>

        <div className="flex flex-col items-end gap-0.5 text-right">
          <div className="font-mono text-xl font-bold num tracking-tight">{Math.round(item.rating)}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
            {mode === "personal"
              ? item.source === "default"
                ? "default"
                : `${item.comparisons} votes`
              : "elo"}
          </div>
        </div>

        {mode === "personal" && (
          <OverrideControls item={item} year={year} />
        )}
      </CardContent>
    </Card>
  );
}

function OverrideControls({ item, year }: { item: BoardItem; year: number }) {
  async function setManual(rank: number) {
    await fetch("/api/rankings/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: item.player.id, manualRank: rank, draftYear: year }),
    });
    window.location.reload();
  }
  async function clear() {
    await fetch(`/api/rankings/override?playerId=${item.player.id}&year=${year}`, { method: "DELETE" });
    window.location.reload();
  }
  return (
    <div className="flex flex-col gap-1">
      {item.manualRank != null ? (
        <Button size="sm" variant="ghost" onClick={clear} className="h-7 px-2 text-xs">
          <RotateCcw className="h-3 w-3" /> clear
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const val = prompt(`Set manual rank for ${item.player.fullName}`, String(item.rank));
            if (!val) return;
            const n = Number(val);
            if (!Number.isFinite(n) || n < 1) return;
            setManual(n);
          }}
          className={cn("h-7 px-2 text-xs")}
        >
          <GripVertical className="h-3 w-3" /> pin rank
        </Button>
      )}
    </div>
  );
}
