"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { Player } from "@prisma/client";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Select } from "./ui/select";
import { PlayerHeadshot } from "./player-headshot";
import { POSITIONS, POSITION_COLOR, POSITION_LABELS } from "@/lib/positions";
import { formatHeight, formatWeight, formatForty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Swords, SkipForward, ArrowLeft, ArrowRight, Zap, Pin, PinOff, Target, X, Undo2 } from "lucide-react";

// How many extra matchups a just-voted player sticks around for.
const STICKY_FOLLOWUPS = 2;
// How many previous matchups we keep in the Back history.
const HISTORY_LIMIT = 10;

type AutoStage = "top-position" | "full-position" | "cross-pos" | "historical";
type Matchup = {
  left: Player;
  right: Player;
  context: string;
  reason: string;
  stage?: AutoStage;
  communityVotes?: number;
};
type Mode = "AUTO" | "OVERALL" | "POSITION" | "HISTORICAL";

const STAGE_LABEL: Record<AutoStage, { label: string; tip: string }> = {
  "top-position":  { label: "Stage 1 · Top of each position", tip: "Stacking the best QBs, WRs, CBs... first." },
  "full-position": { label: "Stage 2 · Full position boards", tip: "Filling out the rankings inside each position." },
  "cross-pos":     { label: "Stage 3 · Cross-position",        tip: "Now deciding which positions you value more." },
  "historical":    { label: "Stage 4 · Vs historical drafts",  tip: "Pitting current prospects against drafted players." },
};

const DRAFT_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
const HISTORICAL_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

export function PairwiseArena() {
  const [year, setYear] = useState(2026);
  const [mode, setMode] = useState<Mode>("AUTO");
  const [position, setPosition] = useState<string>("WR");
  const [matchup, setMatchup] = useState<Matchup | null>(null);
  const [loading, setLoading] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastChoice, setLastChoice] = useState<"LEFT" | "RIGHT" | "SKIP" | null>(null);

  // "Sticky": keep the just-voted player in the next few matchups so you can
  // see how they fare against several neighbors before moving on.
  const [stickyId, setStickyId] = useState<number | null>(null);
  const [stickyRemaining, setStickyRemaining] = useState(0);
  // "Lock": pin a player indefinitely until the user unlocks. Rotates opponents
  // near that player's rating — useful for drilling a single player's spot.
  const [lockedPlayer, setLockedPlayer] = useState<Player | null>(null);
  // History stack of previously-shown matchups so the user can go Back.
  // Newest at the top; capped at HISTORY_LIMIT entries.
  const [history, setHistory] = useState<Matchup[]>([]);

  const fetchNext = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      mode,
      year: String(year),
    });
    if (mode === "POSITION") params.set("position", position);
    if (mode === "HISTORICAL") {
      params.set("historicalYears", HISTORICAL_YEARS.filter((y) => y !== year).join(","));
      if (position) params.set("position", position);
    }
    // Locked player wins over sticky. Only one pin is sent at a time.
    if (lockedPlayer) {
      params.set("lockedId", String(lockedPlayer.id));
    } else if (stickyId != null && stickyRemaining > 0) {
      params.set("stickyId", String(stickyId));
    }
    const res = await fetch(`/api/pairwise/next?${params.toString()}`);
    const json = await res.json();
    setMatchup(json.matchup ?? null);
    if (json.stats) {
      setVoteCount(json.stats.votes ?? 0);
      setStreak(json.stats.streak ?? 0);
    }
    setLoading(false);
  }, [mode, position, year, lockedPlayer, stickyId, stickyRemaining]);

  useEffect(() => {
    void fetchNext();
  }, [fetchNext]);

  const submit = useCallback(
    async (outcome: "LEFT" | "RIGHT" | "SKIP") => {
      if (!matchup || loading) return;
      setLastChoice(outcome);
      // Push the current matchup onto history so "Back" can restore it.
      setHistory((h) => [matchup, ...h].slice(0, HISTORY_LIMIT));
      const winnerId =
        outcome === "LEFT"  ? matchup.left.id  :
        outcome === "RIGHT" ? matchup.right.id : undefined;
      setLoading(true);
      const res = await fetch("/api/pairwise/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftId: matchup.left.id,
          rightId: matchup.right.id,
          winnerId,
          outcome,
          draftYear: year,
          context: matchup.context,
        }),
      });
      if (res.ok) {
        // Sticky: on a real vote (not skip), keep the chosen player in the
        // next few matchups. Lock mode ignores sticky — it has its own pin.
        if (outcome !== "SKIP" && !lockedPlayer) {
          const pickedId = outcome === "LEFT" ? matchup.left.id : matchup.right.id;
          setStickyId(pickedId);
          setStickyRemaining(STICKY_FOLLOWUPS);
        } else if (outcome === "SKIP") {
          setStickyRemaining(0);
          setStickyId(null);
        } else {
          // Locked mode: consume nothing; the lock persists.
        }
      }
      // Decrement sticky counter for the request we're about to fire.
      if (stickyRemaining > 0) setStickyRemaining((n) => Math.max(0, n - 1));
      await fetchNext();
    },
    [matchup, loading, year, fetchNext, lockedPlayer, stickyRemaining],
  );

  const lockPlayer = (p: Player) => {
    setLockedPlayer(p);
    setStickyId(null);
    setStickyRemaining(0);
  };
  const unlockPlayer = () => setLockedPlayer(null);

  // Pop the most recent matchup back into view. Doesn't undo the vote — the
  // Elo update already happened — but lets the user reconsider or revote.
  const goBack = () => {
    setHistory((h) => {
      const [prev, ...rest] = h;
      if (prev) {
        setMatchup(prev);
        setLastChoice(null);
      }
      return rest;
    });
  };

  // Keyboard shortcuts on desktop.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft"  || e.key.toLowerCase() === "a") submit("LEFT");
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") submit("RIGHT");
      if (e.key === " " || e.key.toLowerCase() === "s") { e.preventDefault(); submit("SKIP"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [submit]);

  const legend = useMemo(() => {
    if (mode === "AUTO") {
      const stage = matchup?.stage;
      if (stage && STAGE_LABEL[stage]) return STAGE_LABEL[stage].tip;
      return "Auto mode. We'll start by ranking the top of each position, then expand.";
    }
    if (mode === "OVERALL") return "Overall mode. Position groups may cross. Press A / D or tap to pick.";
    if (mode === "HISTORICAL") return `Historical mode. ${year} prospect vs a drafted player from ${HISTORICAL_YEARS[0]}–${HISTORICAL_YEARS[HISTORICAL_YEARS.length - 1]}.`;
    return `Position mode. Comparing ${POSITION_LABELS[position as any]}s.`;
  }, [mode, matchup, position, year]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Class</label>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {DRAFT_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Mode</label>
          <Select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="AUTO">Auto (recommended)</option>
            <option value="OVERALL">Overall (all positions)</option>
            <option value="POSITION">Position only</option>
            <option value="HISTORICAL">Historical vs current</option>
          </Select>
        </div>
        {(mode === "POSITION" || mode === "HISTORICAL") && (
          <div className="flex flex-col">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Position</label>
            <Select value={position} onChange={(e) => setPosition(e.target.value)}>
              {mode === "HISTORICAL" && <option value="">Any position</option>}
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{POSITION_LABELS[p]}</option>
              ))}
            </Select>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={goBack}
            disabled={history.length === 0 || loading}
            title={history.length ? "Revisit the previous matchup" : "Nothing to go back to yet"}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2.5 text-xs transition-colors",
              history.length === 0 || loading
                ? "opacity-40 cursor-not-allowed"
                : "hover:border-brand/40 hover:text-foreground",
            )}
          >
            <Undo2 className="h-3.5 w-3.5" /> Back
          </button>
          <Badge variant="brand" className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {matchup?.communityVotes ?? 0} vote{matchup?.communityVotes === 1 ? "" : "s"} on this pair
          </Badge>
          <Badge variant="outline">streak: {streak}</Badge>
        </div>
      </div>

      {mode === "AUTO" && matchup?.stage && !lockedPlayer && (
        <div className="flex justify-center">
          <span className="chip border-brand/40 bg-brand/10 text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-slow-pulse" />
            {STAGE_LABEL[matchup.stage].label}
          </span>
        </div>
      )}

      {lockedPlayer && (
        <div className="flex items-center justify-center gap-2">
          <span className="chip border-amber-400/40 bg-amber-400/10 text-amber-200">
            <Target className="h-3 w-3" /> Locked on <span className="font-semibold">{lockedPlayer.fullName}</span>
          </span>
          <button
            type="button"
            onClick={unlockPlayer}
            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
          >
            <X className="h-3 w-3" /> Unlock
          </button>
        </div>
      )}
      {!lockedPlayer && stickyRemaining > 0 && stickyId != null && (
        <div className="flex justify-center">
          <span className="chip border-brand/40 bg-brand/10 text-foreground">
            <Pin className="h-3 w-3 text-brand" />
            {stickyRemaining} more matchup{stickyRemaining === 1 ? "" : "s"} with your last pick
          </span>
        </div>
      )}

      <div className="text-center text-xs text-muted-foreground">{legend}</div>

      <AnimatePresence mode="wait">
        {matchup && (
          <motion.div
            key={matchup.left.id + ":" + matchup.right.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="grid gap-4 md:grid-cols-2"
          >
            <ProspectButton
              player={matchup.left}
              side="LEFT"
              dimmed={lastChoice === "RIGHT"}
              onClick={() => submit("LEFT")}
              locked={lockedPlayer?.id === matchup.left.id}
              onLock={() => lockPlayer(matchup.left)}
              onUnlock={unlockPlayer}
            />
            <ProspectButton
              player={matchup.right}
              side="RIGHT"
              dimmed={lastChoice === "LEFT"}
              onClick={() => submit("RIGHT")}
              locked={lockedPlayer?.id === matchup.right.id}
              onLock={() => lockPlayer(matchup.right)}
              onUnlock={unlockPlayer}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={() => submit("LEFT")}
          disabled={!matchup || loading}
          className="min-w-[10rem]"
        >
          <ArrowLeft className="h-4 w-4" /> I like left
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => submit("SKIP")}
          disabled={!matchup || loading}
          className="min-w-[6rem]"
        >
          <SkipForward className="h-4 w-4" /> Skip
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => submit("RIGHT")}
          disabled={!matchup || loading}
          className="min-w-[10rem]"
        >
          I like right <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {matchup && (
        <p className="text-center text-xs text-muted-foreground">
          <Swords className="inline h-3 w-3 mr-1" />
          {matchup.reason} <span className="mx-1">·</span> shortcuts A / D / Space
        </p>
      )}
    </div>
  );
}

function ProspectButton({
  player, side, dimmed, onClick, locked, onLock, onUnlock,
}: {
  player: Player;
  side: "LEFT" | "RIGHT";
  dimmed: boolean;
  onClick: () => void;
  locked?: boolean;
  onLock?: () => void;
  onUnlock?: () => void;
}) {
  return (
    <button
      className={cn(
        "group text-left transition-all outline-none",
        dimmed && "opacity-40",
      )}
      onClick={onClick}
    >
      <Card
        className={cn(
          "relative overflow-hidden hover-lift group-focus-visible:ring-2 group-focus-visible:ring-brand",
          locked && "ring-2 ring-amber-400/50",
        )}
      >
        <div className="h-2 stripe" />
        {/* Lock / unlock toggle in the top-right. Stops propagation so it
            doesn't count as picking this prospect. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            locked ? onUnlock?.() : onLock?.();
          }}
          title={locked ? `Unlock ${player.fullName}` : `Lock on ${player.fullName} — rank until their spot settles`}
          aria-label={locked ? "Unlock this player" : "Lock this player"}
          className={cn(
            "absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
            locked
              ? "border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25"
              : "border-border/60 bg-muted/30 text-muted-foreground hover:border-amber-400/40 hover:text-amber-300",
          )}
        >
          {locked ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
        <CardContent className="flex flex-col items-center gap-4 p-6">
          <PlayerHeadshot url={player.headshotUrl} espnId={player.espnId} espnIdSource={player.espnIdSource} positionGroup={player.positionGroup} name={player.fullName} size="xl" />
          <div className="text-center">
            <div className="text-xl font-bold tracking-tight">{player.fullName}</div>
            <div className="text-sm text-muted-foreground">
              {player.school} · {player.conference ?? "--"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={POSITION_COLOR[player.position]}>
              {player.position}
            </Badge>
            <Badge variant="outline">{player.draftYear}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="HT" value={formatHeight(player.heightInches)} />
            <Stat label="WT" value={formatWeight(player.weightLbs)} />
            <Stat label="40" value={formatForty(player.fortyYard)} />
          </div>
          <Link
            href={`/player/${player.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            View full profile
          </Link>
        </CardContent>
      </Card>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2 py-1">
      <div className="font-mono text-sm">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
