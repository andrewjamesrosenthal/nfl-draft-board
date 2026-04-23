import Link from "next/link";
import db from "@/lib/db";
import { getCurrentUserId } from "@/lib/user-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountForm } from "./account-form";
import { Swords, ClipboardList, Eye, BarChart2, Star, ArrowRight } from "lucide-react";
import { POSITION_COLOR } from "@/lib/positions";
import { PlayerHeadshot } from "@/components/player-headshot";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const userId = await getCurrentUserId();

  // ── No session at all ──────────────────────────────────────────────────
  if (!userId) {
    return (
      <div className="flex flex-col items-center gap-8 max-w-md mx-auto py-12 text-center">
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center text-3xl font-black text-white shadow-glow">
          DB
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-black tracking-tight">Build your big board</h1>
          <p className="text-muted-foreground">
            No account needed to start. Make a few comparisons and your board saves automatically in this browser.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          <Link
            href="/compare"
            className="btn-brand inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold"
          >
            <Swords className="h-4 w-4" /> Start ranking prospects
          </Link>
          <Link
            href="/community"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-6 py-3.5 text-sm font-medium transition-colors hover:border-brand/40"
          >
            See the community board
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Come back here to create an account and save your board across devices.
        </p>
      </div>
    );
  }

  // ── Fetch user data ────────────────────────────────────────────────────
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      handle: true,
      displayName: true,
      email: true,
      isAnonymous: true,
      createdAt: true,
      _count: { select: { matchups: true, rankings: true, watchlist: true } },
    },
  });

  const [votes, topRankings] = await Promise.all([
    db.pairwiseMatchup.count({ where: { userId, skipped: false } }),
    db.userRanking.findMany({
      where: { userId, draftYear: 2026 },
      orderBy: { rating: "desc" },
      take: 10,
      include: {
        player: {
          select: {
            slug: true, fullName: true, position: true, school: true,
            espnId: true, espnIdSource: true, headshotUrl: true, positionGroup: true,
          },
        },
      },
    }),
  ]);

  const initials = user?.displayName
    ? user.displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.handle?.slice(0, 2).toUpperCase() ?? "?";

  const isAnonymous = user?.isAnonymous ?? true;

  // ── Anonymous — has data but no account ───────────────────────────────
  if (isAnonymous) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <header>
          <h1 className="font-display text-3xl font-black tracking-tight">Your profile</h1>
          <p className="text-muted-foreground mt-1">You've been building your board as a guest.</p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Swords}        label="Comparisons"    value={votes} />
          <StatCard icon={ClipboardList} label="Players ranked"  value={user?._count.rankings ?? 0} />
          <StatCard icon={Eye}           label="Watchlist"       value={user?._count.watchlist ?? 0} />
        </div>

        {/* Create account — primary CTA */}
        <Card className="relative overflow-hidden">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px] stripe" />
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Set a username to get a public profile, share your board, and keep your rankings
              accessible across devices. Everything you've compared so far stays attached.
            </p>
            <AccountForm
              initial={{ handle: "", displayName: "", email: "" }}
              isAnonymous={true}
            />
          </CardContent>
        </Card>

        {/* Board preview */}
        {topRankings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Your board so far · 2026
                <Link href="/board" className="text-xs font-normal text-brand hover:underline">
                  Full board →
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BoardPreview rankings={topRankings} />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── Has account ────────────────────────────────────────────────────────
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
              {user?.displayName ?? user?.handle}
            </h1>
            <p className="text-sm text-muted-foreground">
              @{user?.handle}
              {user?.handle && (
                <Link
                  href={`/u/${user.handle}`}
                  className="ml-3 inline-flex items-center gap-0.5 text-brand hover:underline underline-offset-2"
                >
                  Public profile <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={Swords}        label="Comparisons"    value={votes} />
        <StatCard icon={ClipboardList} label="Players ranked"  value={user?._count.rankings ?? 0} />
        <StatCard icon={Eye}           label="Watchlist"       value={user?._count.watchlist ?? 0} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Board preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Your board · 2026
              <Link href="/board" className="text-xs font-normal text-brand hover:underline">
                Full board →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topRankings.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">No rankings yet.</p>
                <Link
                  href="/compare"
                  className="btn-brand inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  <Swords className="h-3.5 w-3.5" /> Start ranking
                </Link>
              </div>
            ) : (
              <BoardPreview rankings={topRankings} />
            )}
          </CardContent>
        </Card>

        {/* Account settings */}
        <Card>
          <CardHeader>
            <CardTitle>Account settings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Update your display name, handle, or email.
            </p>
            <AccountForm
              initial={{
                handle: user?.handle ?? "",
                displayName: user?.displayName ?? "",
                email: user?.email ?? "",
              }}
              isAnonymous={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="card-lux rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="font-mono text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

function BoardPreview({
  rankings,
}: {
  rankings: Array<{
    id: number;
    rating: number;
    player: {
      slug: string;
      fullName: string;
      position: string;
      school: string;
      espnId: string | null;
      espnIdSource: string | null;
      headshotUrl: string | null;
      positionGroup: string;
    };
  }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      {rankings.map((r, i) => (
        <Link
          key={r.id}
          href={`/player/${r.player.slug}`}
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors"
        >
          <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">
            {i + 1}
          </span>
          <PlayerHeadshot
            url={r.player.headshotUrl}
            espnId={r.player.espnId}
            espnIdSource={r.player.espnIdSource}
            positionGroup={r.player.positionGroup}
            name={r.player.fullName}
            size="sm"
          />
          <span className="flex-1 text-sm font-medium truncate">{r.player.fullName}</span>
          <span
            className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${(POSITION_COLOR as any)[r.player.position] ?? ""}`}
          >
            {r.player.position}
          </span>
        </Link>
      ))}
    </div>
  );
}
