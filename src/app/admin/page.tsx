import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { POSITION_COLOR } from "@/lib/positions";
import { isAdminAuthorized } from "@/lib/admin";
import { AdminLogin } from "./admin-login";
import { Users, Swords, BarChart2, TrendingUp, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAdminAuthorized()) {
    return (
      <div className="flex flex-col gap-6 max-w-md">
        <header>
          <h1 className="text-3xl font-black tracking-tight">Admin</h1>
          <p className="text-muted-foreground">Enter your admin token to continue.</p>
        </header>
        <AdminLogin />
      </div>
    );
  }

  const now = new Date();
  const oneDayAgo  = new Date(now.getTime() - 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [
    totalUsers,
    namedUsers,
    activeToday,
    activeWeek,
    totalMatchups,
    matchupsToday,
    matchupsWeek,
    totalPlayers,
    totalRankings,
    classes,
    recentPlayers,

    // Per-user vote distribution buckets
    buckets,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isAnonymous: false } }),
    db.user.count({ where: { lastSeen: { gte: oneDayAgo } } }),
    db.user.count({ where: { lastSeen: { gte: sevenDaysAgo } } }),
    db.pairwiseMatchup.count({ where: { skipped: false } }),
    db.pairwiseMatchup.count({ where: { skipped: false, createdAt: { gte: oneDayAgo } } }),
    db.pairwiseMatchup.count({ where: { skipped: false, createdAt: { gte: sevenDaysAgo } } }),
    db.player.count(),
    db.userRanking.count(),
    db.draftClass.findMany({ orderBy: { year: "desc" } }),
    db.player.findMany({ orderBy: { updatedAt: "desc" }, take: 20 }),

    // Group matchup counts by user to calculate distribution
    db.pairwiseMatchup.groupBy({
      by: ["userId"],
      where: { skipped: false },
      _count: { _all: true },
    }),
  ]);

  // Distribution stats
  const voteCounts = buckets.map((b) => b._count._all);
  const totalVoters = voteCounts.length;
  const avgVotes = totalVoters > 0
    ? Math.round(voteCounts.reduce((a, b) => a + b, 0) / totalVoters)
    : 0;
  const medianVotes = totalVoters > 0
    ? voteCounts.sort((a, b) => a - b)[Math.floor(totalVoters / 2)]
    : 0;
  const power = voteCounts.filter((v) => v >= 50).length;
  const casual = voteCounts.filter((v) => v > 0 && v < 10).length;

  // Bracket distribution
  const brackets = [
    { label: "1–9",    count: voteCounts.filter((v) => v >= 1   && v < 10).length },
    { label: "10–49",  count: voteCounts.filter((v) => v >= 10  && v < 50).length },
    { label: "50–99",  count: voteCounts.filter((v) => v >= 50  && v < 100).length },
    { label: "100–499",count: voteCounts.filter((v) => v >= 100 && v < 500).length },
    { label: "500+",   count: voteCounts.filter((v) => v >= 500).length },
  ];
  const maxBracket = Math.max(...brackets.map((b) => b.count), 1);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Admin</h1>
          <p className="text-muted-foreground text-sm">
            Last refreshed {now.toLocaleTimeString()}
          </p>
        </div>
        <form action="/api/admin/logout" method="post">
          <button className="text-sm text-muted-foreground underline-offset-2 hover:underline">
            Sign out
          </button>
        </form>
      </header>

      {/* ── Users ──────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="h-4 w-4" /> Users
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Total sessions" value={totalUsers} />
          <Metric label="Named accounts" value={namedUsers} sub={`${Math.round(namedUsers / Math.max(totalUsers, 1) * 100)}% of sessions`} />
          <Metric label="Active today" value={activeToday} />
          <Metric label="Active this week" value={activeWeek} />
        </div>
      </section>

      {/* ── Votes ──────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Swords className="h-4 w-4" /> Votes
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Total votes" value={totalMatchups} />
          <Metric label="Votes today" value={matchupsToday} />
          <Metric label="Votes this week" value={matchupsWeek} />
          <Metric label="Users who voted" value={totalVoters} />
        </div>
      </section>

      {/* ── Engagement ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <BarChart2 className="h-4 w-4" /> Engagement
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Avg votes / user" value={avgVotes} />
          <Metric label="Median votes / user" value={medianVotes} />
          <Metric label="Power users (50+)" value={power} />
          <Metric label="Casual (1–9 votes)" value={casual} />
        </div>

        {/* Vote distribution bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Vote distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {brackets.map((b) => (
              <div key={b.label} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground">
                  {b.label}
                </span>
                <div className="flex-1 h-5 rounded bg-muted/30 overflow-hidden">
                  <div
                    className="h-full bg-brand/60 rounded transition-all"
                    style={{ width: `${Math.round((b.count / maxBracket) * 100)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 font-mono text-xs">
                  {b.count}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ── Database ───────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <TrendingUp className="h-4 w-4" /> Database
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Players" value={totalPlayers} />
          <Metric label="Draft classes" value={classes.length} />
          <Metric label="User rankings" value={totalRankings} />
        </div>

        {/* Classes */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Draft classes</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1">
            {classes.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm py-0.5">
                <span>{c.name}</span>
                <div className="flex items-center gap-2">
                  {c.draftDate && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.draftDate).toLocaleDateString()}
                    </span>
                  )}
                  {c.isCurrent && <Badge variant="brand">current</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ── Recent players ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Clock className="h-4 w-4" /> Recently updated players
        </h2>
        <Card>
          <CardContent className="pt-4 flex flex-col gap-1">
            {recentPlayers.map((p) => (
              <Link
                key={p.id}
                href={`/player/${p.slug}`}
                className="flex items-center gap-2 rounded-md p-1.5 hover:bg-muted/40 text-sm"
              >
                <span className="flex-1 font-medium truncate">{p.fullName}</span>
                <Badge variant="outline" className={POSITION_COLOR[p.position]}>
                  {p.position}
                </Badge>
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {p.draftYear}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-mono text-2xl font-semibold">{value.toLocaleString()}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
