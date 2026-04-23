"use client";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { SkipForward, Trophy, BarChart3, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GradePick } from "@/app/api/pick-grade/next/route";
import { ordinal } from "@/lib/pick-grade";
import Image from "next/image";
import Link from "next/link";

type Matchup = { left: GradePick; right: GradePick };
type Stats = { votes: number; skips: number; totalPicks: number };

const HISTORY_LIMIT = 10;

function PickCard({
  pick,
  onClick,
  disabled,
  chosen,
}: {
  pick: GradePick;
  onClick: () => void;
  disabled: boolean;
  chosen?: boolean;
}) {
  const bg = pick.teamPrimaryHex ?? "#1e293b";
  const fg = pick.teamSecondaryHex ?? "#ffffff";

  const headshotSrc = pick.espnId
    ? pick.espnIdSource === "nfl"
      ? `https://a.espncdn.com/i/headshots/nfl/players/full/${pick.espnId}.png`
      : `https://a.espncdn.com/i/headshots/college-football/players/full/${pick.espnId}.png`
    : null;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all duration-200",
        "hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]",
        chosen
          ? "border-brand ring-2 ring-brand/40 shadow-glow scale-[1.01]"
          : "border-border/60 hover:border-brand/50",
        disabled && !chosen && "opacity-50 cursor-not-allowed",
      )}
      style={{ background: bg }}
    >
      {/* Team color accent bar at top */}
      <div className="h-1 w-full" style={{ background: fg, opacity: 0.6 }} />

      {/* Pick badge */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: fg, opacity: 0.9 }}
        >
          {ordinal(pick.actualRound)} round · Pick #{pick.actualPick}
        </span>
      </div>

      {/* Team name */}
      <div className="px-4 pb-2">
        <p className="text-sm font-semibold truncate" style={{ color: fg }}>
          {pick.teamName ?? pick.actualTeamAbbr}
        </p>
      </div>

      {/* Headshot */}
      <div className="relative mx-auto h-36 w-36">
        {headshotSrc ? (
          <Image
            src={headshotSrc}
            alt={pick.fullName}
            fill
            className="object-contain drop-shadow-lg"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-black opacity-30" style={{ color: fg }}>
            {pick.firstName[0]}{pick.lastName[0]}
          </div>
        )}
      </div>

      {/* Player info */}
      <div className="flex flex-col items-center px-4 pb-5 pt-2 text-center">
        <p className="text-xl font-black leading-tight" style={{ color: fg }}>
          {pick.fullName}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className="rounded px-1.5 py-0.5 text-xs font-bold"
            style={{ background: fg, color: bg }}
          >
            {pick.position}
          </span>
          <span className="text-xs opacity-70" style={{ color: fg }}>
            {pick.school}
          </span>
        </div>
        <p className="mt-1.5 text-xs opacity-50" style={{ color: fg }}>
          {pick.myComparisons} comparison{pick.myComparisons === 1 ? "" : "s"}
        </p>
      </div>

      {/* Chosen checkmark */}
      {chosen && (
        <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-brand shadow-glow">
          <Trophy className="h-3.5 w-3.5 text-brand-foreground" />
        </div>
      )}
    </button>
  );
}

export function PickGradeArena({ year = 2026 }: { year?: number }) {
  const [matchup, setMatchup] = useState<Matchup | null>(null);
  const [stats, setStats] = useState<Stats>({ votes: 0, skips: 0, totalPicks: 0 });
  const [loading, setLoading] = useState(true);
  const [lastChoice, setLastChoice] = useState<number | null>(null);
  const [history, setHistory] = useState<Matchup[]>([]);
  const [notEnoughPicks, setNotEnoughPicks] = useState(false);

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setLastChoice(null);
    try {
      const res = await fetch(`/api/pick-grade/next?year=${year}`);
      const json = await res.json();
      if (json.locked) { setLoading(false); return; }
      if (!json.matchup) {
        setNotEnoughPicks(true);
        setLoading(false);
        return;
      }
      setMatchup(json.matchup);
      setStats(json.stats ?? stats);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchNext(); }, [fetchNext]);

  const vote = useCallback(async (winnerId: number, loserId: number) => {
    if (!matchup || loading) return;
    setLastChoice(winnerId);
    if (matchup) setHistory((h) => [matchup, ...h].slice(0, HISTORY_LIMIT));

    await fetch("/api/pick-grade/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        winnerId, loserId,
        leftId: matchup.left.id, rightId: matchup.right.id,
        skipped: false, draftYear: year,
      }),
    });

    setTimeout(fetchNext, 350);
    setStats((s) => ({ ...s, votes: s.votes + 1 }));
  }, [matchup, loading, year, fetchNext]);

  const skip = useCallback(async () => {
    if (!matchup || loading) return;
    if (matchup) setHistory((h) => [matchup, ...h].slice(0, HISTORY_LIMIT));
    await fetch("/api/pick-grade/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leftId: matchup.left.id, rightId: matchup.right.id,
        skipped: true, draftYear: year,
      }),
    });
    fetchNext();
    setStats((s) => ({ ...s, skips: s.skips + 1 }));
  }, [matchup, loading, year, fetchNext]);

  const goBack = () => {
    setHistory((h) => {
      const [prev, ...rest] = h;
      if (prev) { setMatchup(prev); setLastChoice(null); }
      return rest;
    });
  };

  if (notEnoughPicks) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground" />
        <h2 className="font-display text-2xl font-bold">No picks yet</h2>
        <p className="text-muted-foreground max-w-sm">
          Draft picks will appear here once Round 1 is complete and results
          are imported. Check back after the draft.
        </p>
        <Link href="/draft-order" className="btn-brand rounded-lg px-5 py-2 text-sm font-semibold">
          View Draft Order
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={goBack}
          disabled={history.length === 0 || loading}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-sm transition-colors",
            history.length === 0 || loading
              ? "opacity-40 cursor-not-allowed text-muted-foreground"
              : "hover:border-brand/40 hover:text-foreground text-muted-foreground",
          )}
        >
          <Undo2 className="h-3.5 w-3.5" /> Back
        </button>
        <Badge variant="default" className="gap-1">
          <Trophy className="h-3 w-3" /> {stats.votes} graded
        </Badge>
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          {stats.skips} skipped
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {stats.totalPicks} picks in class
        </span>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          Which was the better draft pick?
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Consider both player talent and pick value — a late-round steal beats an overdraft.
        </p>
      </div>

      {/* Pick cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {matchup ? (
          <>
            <PickCard
              pick={matchup.left}
              onClick={() => vote(matchup.left.id, matchup.right.id)}
              disabled={loading || lastChoice !== null}
              chosen={lastChoice === matchup.left.id}
            />
            <PickCard
              pick={matchup.right}
              onClick={() => vote(matchup.right.id, matchup.left.id)}
              disabled={loading || lastChoice !== null}
              chosen={lastChoice === matchup.right.id}
            />
          </>
        ) : (
          <>
            <div className="h-80 animate-pulse rounded-2xl bg-muted" />
            <div className="h-80 animate-pulse rounded-2xl bg-muted" />
          </>
        )}
      </div>

      {/* Skip */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={skip}
          disabled={loading || !matchup || lastChoice !== null}
          className="text-muted-foreground gap-1.5"
        >
          <SkipForward className="h-3.5 w-3.5" /> Skip this matchup
        </Button>
      </div>
    </div>
  );
}
