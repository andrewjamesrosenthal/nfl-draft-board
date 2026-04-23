import Link from "next/link";
import type { Player } from "@prisma/client";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { PlayerHeadshot } from "./player-headshot";
import { POSITION_COLOR } from "@/lib/positions";
import { formatHeight, formatWeight, formatForty } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PlayerCard({
  player,
  rank,
  rating,
  subtitle,
  highlight,
  className,
}: {
  player: Player;
  rank?: number;
  rating?: number;
  subtitle?: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <Link href={`/player/${player.slug}`} className="block">
      <Card className={cn("hover-lift", highlight && "ring-1 ring-brand/40", className)}>
        <CardContent className="flex items-center gap-3 p-3">
          {rank !== undefined && (
            <div className="font-mono text-2xl w-10 text-center text-muted-foreground">
              {rank}
            </div>
          )}
          <PlayerHeadshot url={player.headshotUrl} espnId={player.espnId} espnIdSource={player.espnIdSource} positionGroup={player.positionGroup} name={player.fullName} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate font-semibold">{player.fullName}</span>
              <Badge variant="outline" className={cn("border", POSITION_COLOR[player.position])}>
                {player.position}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {player.school}
              {player.conference ? ` · ${player.conference}` : ""}
              {subtitle ? ` · ${subtitle}` : ""}
            </div>
            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
              <span>{formatHeight(player.heightInches)}</span>
              <span>{formatWeight(player.weightLbs)}</span>
              {player.fortyYard != null && <span>{formatForty(player.fortyYard)} 40</span>}
            </div>
          </div>
          {rating !== undefined && (
            <div className="text-right">
              <div className="font-mono text-lg font-semibold">{Math.round(rating)}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">rating</div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
