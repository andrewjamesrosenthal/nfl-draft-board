import { notFound } from "next/navigation";
import Link from "next/link";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerHeadshot } from "@/components/player-headshot";
import { POSITION_COLOR } from "@/lib/positions";
import { Swords, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: { handle: string } }) {
  const handle = params.handle.toLowerCase();

  const user = await db.user.findUnique({
    where: { handle },
    select: {
      id: true,
      handle: true,
      displayName: true,
      isAnonymous: true,
      createdAt: true,
      _count: { select: { matchups: true, watchlist: true } },
    },
  });

  if (!user || user.isAnonymous) notFound();

  const currentClass = await db.draftClass.findFirst({ where: { isCurrent: true } });
  const currentYear = currentClass?.year ?? 2026;

  const topBoard = await db.userRanking.findMany({
    where: { userId: user.id, draftYear: currentYear },
    orderBy: { rating: "desc" },
    take: 25,
    include: {
      player: {
        select: {
          slug: true, fullName: true, position: true, school: true,
          espnId: true, espnIdSource: true, headshotUrl: true, positionGroup: true,
        },
      },
    },
  });

  const votes = await db.pairwiseMatchup.count({
    where: { userId: user.id, skipped: false },
  });

  const initials = user.displayName
    ? user.displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : user.handle?.slice(0, 2).toUpperCase() ?? "?";

  const joinedYear = new Date(user.createdAt).getFullYear();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Profile header */}
      <Card className="relative overflow-hidden">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px] stripe" />
        <CardContent className="p-6 flex items-center gap-5">
          <div className="h-16 w-16 shrink-0 rounded-full bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center text-xl font-black text-white shadow-glow">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight">
              {user.displayName ?? user.handle}
            </h1>
            <p className="text-sm text-muted-foreground">@{user.handle}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Swords className="h-3 w-3" /> {votes.toLocaleString()} comparisons
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" /> {user._count.watchlist} watching
              </span>
              <span>since {joinedYear}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Big board */}
      <Card>
        <CardHeader>
          <CardTitle>{currentYear} big board</CardTitle>
        </CardHeader>
        <CardContent>
          {topBoard.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No rankings yet.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {topBoard.map((r, idx) => (
                <Link
                  key={r.id}
                  href={`/player/${r.player.slug}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors"
                >
                  <span className="w-6 shrink-0 text-center font-mono text-sm text-muted-foreground">
                    {idx + 1}
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
                  <span className="text-xs text-muted-foreground truncate hidden sm:block">
                    {r.player.school}
                  </span>
                  <span
                    className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${(POSITION_COLOR as any)[r.player.position] ?? ""}`}
                  >
                    {r.player.position}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
