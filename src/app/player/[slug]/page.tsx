import { notFound } from "next/navigation";
import Link from "next/link";
import db from "@/lib/db";
import { getCurrentUserId } from "@/lib/user-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerHeadshot } from "@/components/player-headshot";
import { ScoutingReportCard } from "@/components/scouting-report";
import { ConfidencePill } from "@/components/confidence-pill";
import { DisagreementMeter } from "@/components/disagreement-meter";
import { WatchlistToggle } from "@/components/watchlist-toggle";
import { POSITION_COLOR, POSITION_LABELS } from "@/lib/positions";
import { confidenceLevel } from "@/lib/ranking/confidence";
import { formatHeight, formatWeight, formatFloat, formatInches, formatForty, formatPickNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: { slug: string } }) {
  const player = await db.player.findUnique({
    where: { slug: params.slug },
    include: {
      reports: { orderBy: { updatedAt: "desc" } },
      stats:   { orderBy: { season: "desc" } },
      communityRanking: true,
    },
  });
  if (!player) notFound();

  const userId = await getCurrentUserId();
  const personal = userId
    ? await db.userRanking.findUnique({
        where: { userId_playerId_draftYear: { userId, playerId: player.id, draftYear: player.draftYear } },
      })
    : null;

  const onWatchlist = userId
    ? !!(await db.watchlistEntry.findUnique({
        where: { userId_playerId: { userId, playerId: player.id } },
      }))
    : false;

  const similar = await db.player.findMany({
    where: {
      position: player.position,
      draftYear: player.draftYear,
      id: { not: player.id },
    },
    orderBy: { communityRanking: { rating: "desc" } },
    take: 5,
    include: { communityRanking: true },
  });

  const personalRank = personal ? await rankOf(personal.userId!, player.draftYear, personal.rating) : null;
  const confidence = personal ? confidenceLevel(personal.sigma, personal.comparisons) : null;

  const commRank = player.communityRanking?.rankOverall;
  const disagreement = personalRank != null && commRank != null ? personalRank - commRank : null;

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-brand/30 via-fuchsia-500/10 to-transparent" />
        <CardContent className="flex flex-col items-start gap-6 -mt-10 md:flex-row md:items-end">
          <PlayerHeadshot
            url={player.headshotUrl}
            espnId={player.espnId}
            espnIdSource={player.espnIdSource}
            positionGroup={player.positionGroup}
            name={player.fullName}
            size="xl"
            className="ring-4 ring-background"
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-black">{player.fullName}</h1>
              <Badge variant="outline" className={POSITION_COLOR[player.position]}>
                {POSITION_LABELS[player.position]}
              </Badge>
              <Badge variant="outline">{player.draftYear} class</Badge>
            </div>
            <div className="mt-1 text-muted-foreground">
              {player.school}
              {player.conference ? ` · ${player.conference}` : ""}
              {player.hometown ? ` · ${player.hometown}` : ""}
            </div>
            {player.actualPick && (
              <div className="mt-2 text-sm">
                Drafted {formatPickNumber(player.actualPick)} by {" "}
                <span className="font-semibold">{player.actualTeamAbbr}</span>
              </div>
            )}
            <div className="mt-3">
              <WatchlistToggle playerId={player.id} initiallyIn={onWatchlist} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 min-w-[280px]">
            <Stat label="Community"    value={commRank ? `#${commRank}` : "--"} />
            <Stat label="Your rank"    value={personalRank ? `#${personalRank}` : "--"} />
            <Stat label="Elo"          value={player.communityRanking ? Math.round(player.communityRanking.rating).toString() : "--"} />
            <Stat label="You vs comm." value={disagreement != null ? (disagreement > 0 ? `+${disagreement}` : String(disagreement)) : "--"} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 flex flex-col gap-6">
          {player.reports[0] && <ScoutingReportCard report={player.reports[0]} />}

          {(() => {
            // Only render measurements that actually have a value — don't
            // show "--" for drills a prospect didn't do.
            const measurements = [
              player.heightInches   != null && { label: "Height",   value: formatHeight(player.heightInches) },
              player.weightLbs      != null && { label: "Weight",   value: formatWeight(player.weightLbs) },
              player.armInches      != null && { label: "Arm",      value: formatInches(player.armInches) },
              player.handInches     != null && { label: "Hand",     value: formatInches(player.handInches) },
              player.wingspanInches != null && { label: "Wingspan", value: formatInches(player.wingspanInches) },
              player.fortyYard      != null && { label: "40 yard",  value: formatForty(player.fortyYard) },
              player.tenYardSplit   != null && { label: "10 split", value: formatFloat(player.tenYardSplit, 2) },
              player.verticalIn     != null && { label: "Vertical", value: formatFloat(player.verticalIn, 1) },
              player.broadJumpIn    != null && { label: "Broad",    value: `${player.broadJumpIn}"` },
              player.threeConeSec   != null && { label: "3 cone",   value: formatFloat(player.threeConeSec, 2) },
              player.shuttleSec     != null && { label: "Shuttle",  value: formatFloat(player.shuttleSec, 2) },
              player.benchReps      != null && { label: "Bench",    value: `${player.benchReps} reps` },
            ].filter(Boolean) as { label: string; value: string }[];

            if (measurements.length === 0) return null;
            return (
              <Card>
                <CardHeader><CardTitle>Measurements & testing</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
                  {measurements.map((m) => (
                    <Measurement key={m.label} label={m.label} value={m.value} />
                  ))}
                </CardContent>
              </Card>
            );
          })()}

          {player.stats.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Stats</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                {player.stats.map((s) => (
                  <div key={s.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                    <span className="text-muted-foreground">{s.season} · {s.label}</span>
                    <span className="font-mono">{s.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Your data</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {personal ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Your rank</span>
                    <span className="font-semibold">#{personalRank ?? "--"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rating</span>
                    <span className="font-mono">{Math.round(personal.rating)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Votes</span>
                    <span>{personal.comparisons}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Record</span>
                    <span>{personal.wins} W / {personal.losses} L</span>
                  </div>
                  {confidence && <ConfidencePill level={confidence} />}
                  {disagreement != null && (
                    <>
                      <div className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Disagreement with community</div>
                      <DisagreementMeter delta={disagreement} />
                    </>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground">
                  No personal rating yet. Visit the <Link className="underline text-brand" href="/compare">arena</Link> to start ranking.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Similar prospects</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {similar.map((p) => (
                <Link
                  key={p.id}
                  href={`/player/${p.slug}`}
                  className="flex items-center gap-2 rounded-md border border-transparent p-1 hover:border-border hover:bg-muted/40"
                >
                  <PlayerHeadshot url={p.headshotUrl} espnId={p.espnId} espnIdSource={p.espnIdSource} positionGroup={p.positionGroup} name={p.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">{p.fullName}</div>
                    <div className="text-xs text-muted-foreground">{p.position} · {p.school}</div>
                  </div>
                  {p.communityRanking && (
                    <div className="font-mono text-xs">#{p.communityRanking.rankOverall}</div>
                  )}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 text-center">
      <div className="font-mono text-lg font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function Measurement({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-muted/20 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

async function rankOf(userId: string, draftYear: number, rating: number): Promise<number> {
  const count = await db.userRanking.count({
    where: { userId, draftYear, rating: { gt: rating } },
  });
  return count + 1;
}
