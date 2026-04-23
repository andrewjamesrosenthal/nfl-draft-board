import { notFound } from "next/navigation";
import Link from "next/link";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerHeadshot } from "@/components/player-headshot";
import { POSITION_COLOR } from "@/lib/positions";
import { BADGES } from "@/lib/badges";
import { UserCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: { handle: string } }) {
  const handle = params.handle.toLowerCase();
  const user = await db.user.findUnique({
    where: { handle },
    include: {
      badges: true,
      _count: { select: { matchups: true, mocks: true, watchlist: true } },
    },
  });
  if (!user || user.isAnonymous) notFound();

  const topBoard = await db.userRanking.findMany({
    where: { userId: user.id, draftYear: (await currentYear()) },
    include: { player: true },
    orderBy: { rating: "desc" },
    take: 10,
  });

  const recentMocks = await db.mockDraft.findMany({
    where: { userId: user.id, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    take: 5,
    include: { _count: { select: { picks: true } } },
  });

  const earnedKeys = new Set(user.badges.map((b) => b.key));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand/40 to-fuchsia-500/40 flex items-center justify-center">
            <UserCircle2 className="h-10 w-10 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight">{user.displayName ?? user.handle}</h1>
            <div className="text-sm text-muted-foreground">@{user.handle}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{user._count.matchups} matchups</Badge>
              <Badge variant="outline">{user._count.mocks} mocks</Badge>
              <Badge variant="outline">{user._count.watchlist} watching</Badge>
              <Badge variant="outline">joined {new Date(user.createdAt).toLocaleDateString()}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Current class top 10</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1">
            {topBoard.length === 0 ? (
              <div className="text-sm text-muted-foreground">This user has not ranked anyone yet.</div>
            ) : topBoard.map((r, idx) => (
              <Link
                key={r.id}
                href={`/player/${r.player.slug}`}
                className="flex items-center gap-2 rounded-md p-1 hover:bg-muted/40"
              >
                <div className="w-6 text-center font-mono text-xs text-muted-foreground">{idx + 1}</div>
                <PlayerHeadshot url={r.player.headshotUrl} espnId={r.player.espnId} espnIdSource={r.player.espnIdSource} positionGroup={r.player.positionGroup} name={r.player.fullName} size="sm" />
                <div className="min-w-0 flex-1 truncate text-sm">{r.player.fullName}</div>
                <Badge variant="outline" className={POSITION_COLOR[r.player.position]}>{r.player.position}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Badges</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {BADGES.map((b) => (
              <div
                key={b.key}
                className={`rounded-md border px-2 py-2 text-xs ${earnedKeys.has(b.key) ? "border-brand/40 bg-brand/5" : "border-border bg-muted/20 opacity-50"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{b.emoji}</span>
                  <span className="font-semibold">{b.label}</span>
                </div>
                <div className="text-muted-foreground mt-0.5">{b.blurb}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Recent mock drafts</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1">
            {recentMocks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No completed mocks yet.</div>
            ) : recentMocks.map((m) => (
              <Link key={m.id} href={`/mock/${m.id}`} className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/40">
                <div className="flex-1 truncate text-sm font-medium">
                  {m.title ?? `${m.draftYear} mock draft`}
                </div>
                <div className="text-xs text-muted-foreground">{m.mode.replace("_", " ")}</div>
                <Badge variant="outline">{m._count.picks} picks</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function currentYear(): Promise<number> {
  const cls = await db.draftClass.findFirst({ where: { isCurrent: true } });
  return cls?.year ?? 2026;
}
