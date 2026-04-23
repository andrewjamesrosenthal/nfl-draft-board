import Link from "next/link";
import db from "@/lib/db";
import { getCurrentUserId } from "@/lib/user-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerHeadshot } from "@/components/player-headshot";
import { POSITION_COLOR } from "@/lib/positions";
import { formatHeight, formatWeight, formatForty } from "@/lib/format";
import { WatchlistToggle } from "@/components/watchlist-toggle";
import { Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const userId = await getCurrentUserId();
  const items = userId
    ? await db.watchlistEntry.findMany({
        where: { userId },
        include: {
          player: {
            include: { communityRanking: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-2">
          <Eye className="h-7 w-7" /> Watchlist
        </h1>
        <p className="text-muted-foreground">
          Prospects you want to keep an eye on. Add from any player profile or from a board row.
        </p>
      </header>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No prospects saved yet. Visit any player profile and tap the watchlist button.
            <div className="mt-2"><Link href="/community" className="text-brand underline">Browse the community board</Link></div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>{items.length} prospects</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1">
            {items.map(({ player }) => (
              <div key={player.id} className="flex items-center gap-3 rounded-md border border-transparent p-2 hover:border-border hover:bg-muted/40">
                <PlayerHeadshot url={player.headshotUrl} espnId={player.espnId} espnIdSource={player.espnIdSource} positionGroup={player.positionGroup} name={player.fullName} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/player/${player.slug}`} className="font-semibold truncate hover:underline">{player.fullName}</Link>
                    <Badge variant="outline" className={POSITION_COLOR[player.position]}>{player.position}</Badge>
                    <Badge variant="outline">{player.draftYear}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {player.school} · {formatHeight(player.heightInches)} / {formatWeight(player.weightLbs)}
                    {player.fortyYard != null && <span> · {formatForty(player.fortyYard)} 40</span>}
                  </div>
                </div>
                {player.communityRanking?.rankOverall && (
                  <Badge variant="brand">#{player.communityRanking.rankOverall} community</Badge>
                )}
                <WatchlistToggle playerId={player.id} initiallyIn={true} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
