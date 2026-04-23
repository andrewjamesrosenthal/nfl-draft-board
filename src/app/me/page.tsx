import Link from "next/link";
import db from "@/lib/db";
import { getCurrentUserId } from "@/lib/user-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BADGES, computeProgress } from "@/lib/badges";
import { AccountForm } from "./account-form";
import { Swords, ClipboardList, Eye, TrendingUp, Star } from "lucide-react";
import { POSITION_COLOR } from "@/lib/positions";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return (
      <div className="flex flex-col gap-8 max-w-lg">
        <header>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight">Your profile</h1>
          <p className="text-muted-foreground mt-1">
            Start comparing prospects to build your board. Your session saves automatically in this browser.
          </p>
        </header>
        <Card className="relative overflow-hidden">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px] stripe" />
          <CardContent className="p-8 flex flex-col gap-4 items-center text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center text-2xl font-black text-white shadow-glow">
              ?
            </div>
            <div>
              <p className="font-semibold text-lg">No session yet</p>
              <p className="text-sm text-muted-foreground">Make your first comparison to get started — no sign-up required.</p>
            </div>
            <Link href="/compare" className="btn-brand inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold">
              <Swords className="h-4 w-4" /> Start comparing
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      badges: true,
      _count: { select: { matchups: true, rankings: true, watchlist: true } },
    },
  });

  const progress = await computeProgress(userId);
  const earnedKeys = new Set(user?.badges.map((b) => b.key) ?? []);

  // Top 5 personal rankings for the current class
  const topRankings = await db.userRanking.findMany({
    where: { userId, draftYear: 2026 },
    orderBy: { rating: "desc" },
    take: 5,
    include: { player: true },
  });

  const votes = await db.pairwiseMatchup.count({ where: { userId, skipped: false } });
  const initials = user?.displayName
    ? user.displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.handle?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="flex flex-col gap-6 max-w-4xl">

      {/* Profile hero */}
      <Card className="relative overflow-hidden">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px] stripe" />
        <CardContent className="p-6 flex items-center gap-5">
          <div className="h-16 w-16 shrink-0 rounded-full bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center text-xl font-black text-white shadow-glow">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight truncate">
              {user?.displayName ?? user?.handle ?? "Anonymous Scout"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.handle ? `@${user.handle}` : "No handle yet — set one below"}
              {user?.handle && !user?.isAnonymous && (
                <Link href={`/u/${user.handle}`} className="ml-2 text-brand hover:underline underline-offset-2">
                  View public profile →
                </Link>
              )}
            </p>
          </div>
          {!user?.isAnonymous && (
            <Badge variant="brand" className="shrink-0">Verified</Badge>
          )}
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Swords,        label: "Comparisons",   value: votes },
          { icon: ClipboardList, label: "Players ranked", value: user?._count.rankings ?? 0 },
          { icon: Eye,           label: "Watchlist",      value: user?._count.watchlist ?? 0 },
          { icon: TrendingUp,    label: "Positions voted", value: progress.distinctPositions },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="card-lux rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs uppercase tracking-wide">{label}</span>
            </div>
            <div className="font-mono text-2xl font-bold">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account settings */}
        <Card>
          <CardHeader>
            <CardTitle>{user?.isAnonymous ? "Create your account" : "Account settings"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            {user?.isAnonymous ? (
              <p>
                Set a handle to get a public profile and share your board. Your existing
                comparisons and rankings stay attached — nothing resets.
              </p>
            ) : (
              <p>Update your display name or handle. Your handle is how others find your public board.</p>
            )}
            <AccountForm initial={{
              handle: user?.handle ?? "",
              displayName: user?.displayName ?? "",
              email: user?.email ?? "",
            }} isAnonymous={user?.isAnonymous ?? true} />
          </CardContent>
        </Card>

        {/* Top board preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your top picks · 2026</span>
              <Link href="/board" className="text-xs font-normal text-brand hover:underline">Full board →</Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topRankings.length === 0 ? (
              <div className="flex flex-col gap-3 items-center py-4 text-center">
                <p className="text-sm text-muted-foreground">No rankings yet.</p>
                <Link href="/compare" className="btn-brand inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold">
                  <Swords className="h-3.5 w-3.5" /> Start ranking
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {topRankings.map((r, i) => (
                  <Link
                    key={r.id}
                    href={`/player/${r.player.slug}`}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors"
                  >
                    <span className="w-5 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <Star className="h-3 w-3 text-brand shrink-0" />
                    <span className="flex-1 text-sm font-medium truncate">{r.player.fullName}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${(POSITION_COLOR as any)[r.player.position] ?? ""}`}>
                      {r.player.position}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Badges
            <span className="text-sm font-normal text-muted-foreground">
              {earnedKeys.size} / {BADGES.length} earned
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {BADGES.map((b) => {
              const earned = earnedKeys.has(b.key);
              return (
                <div
                  key={b.key}
                  className={`rounded-xl border px-3 py-2.5 transition-colors ${
                    earned
                      ? "border-brand/30 bg-brand/5"
                      : "border-border/40 bg-muted/20 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xl">{b.emoji}</span>
                    <span className="font-semibold text-sm">{b.label}</span>
                    {earned && <Badge variant="brand" className="ml-auto text-[10px] px-1.5 py-0">earned</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{b.blurb}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
