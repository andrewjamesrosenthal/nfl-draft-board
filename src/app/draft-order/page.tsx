import Link from "next/link";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerHeadshot } from "@/components/player-headshot";
import { refreshFromEspn } from "@/lib/espn/draft-order";
import { Radio, Clock, CloudDownload } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Live NFL Draft order, sourced from ESPN's undocumented site.web.api endpoint
// (no auth) and cached in DraftOrderPick. A daily cron warms this cache; a
// page visit top-ups the cache if it's empty or has never been fetched.
export default async function DraftOrderPage({
  searchParams,
}: {
  searchParams: { year?: string; round?: string };
}) {
  const currentClass = await db.draftClass.findFirst({ where: { isCurrent: true } });
  const year = Number(searchParams.year ?? currentClass?.year ?? new Date().getFullYear());
  const filterRound = searchParams.round ? Number(searchParams.round) : 1;

  // Warm the cache on first load. If ESPN fails we'll just have an empty view
  // and surface that to the user instead of breaking the whole page.
  let warmError: string | null = null;
  const existing = await db.draftOrderPick.count({ where: { draftYear: year } });
  if (existing === 0) {
    try {
      await refreshFromEspn(year);
    } catch (e) {
      warmError = (e as Error).message;
    }
  }

  const picks = await db.draftOrderPick.findMany({
    where: { draftYear: year, round: filterRound },
    orderBy: { overallPick: "asc" },
  });

  // Pull linked players so we can render the headshot cascade demo.
  const linkedIds = picks.map((p) => p.playerId).filter((x): x is number => !!x);
  const linked = linkedIds.length
    ? await db.player.findMany({
        where: { id: { in: linkedIds } },
        select: {
          id: true, fullName: true, slug: true, position: true, positionGroup: true,
          school: true, espnId: true, espnIdSource: true, headshotUrl: true,
        },
      })
    : [];
  const linkedById = new Map(linked.map((p) => [p.id, p]));

  const roundsAvailable = await db.draftOrderPick.findMany({
    where: { draftYear: year },
    distinct: ["round"],
    orderBy: { round: "asc" },
    select: { round: true },
  });

  const fetchedAt = picks[0]?.fetchedAt ?? null;

  // ESPN marks every future pick as ON_THE_CLOCK. Narrow that to the single
  // lowest-numbered incomplete pick across the whole draft so only ONE row
  // shows the live badge.
  const earliestIncomplete = await db.draftOrderPick.findFirst({
    where: { draftYear: year, isCompleted: false },
    orderBy: { overallPick: "asc" },
    select: { overallPick: true },
  });
  const onClockPick = earliestIncomplete?.overallPick ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-emerald-500/30 via-cyan-500/10 to-transparent" />
        <CardContent className="-mt-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="brand" className="w-fit"><Radio className="h-3 w-3 mr-1" /> Live from ESPN</Badge>
            <h1 className="mt-2 text-3xl font-black">{year} NFL Draft order</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {fetchedAt && (
              <span className="inline-flex items-center gap-1 rounded border border-border px-2 py-1">
                <Clock className="h-3 w-3" /> cached {new Date(fetchedAt).toLocaleString()}
              </span>
            )}
            <a
              href={`/api/draft/order?year=${year}&refresh=1`}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:border-brand/60 hover:text-foreground"
            >
              <CloudDownload className="h-3 w-3" /> refresh
            </a>
          </div>
        </CardContent>
      </Card>

      {warmError && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          ESPN fetch failed: {warmError}. Showing whatever is cached. Daily cron will retry.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Round:</span>
        {(roundsAvailable.length ? roundsAvailable.map((r) => r.round) : [1]).map((r) => {
          const active = r === filterRound;
          return (
            <Link
              key={r}
              href={`/draft-order?year=${year}&round=${r}`}
              className={
                "rounded-md border px-2.5 py-1 text-xs " +
                (active
                  ? "border-brand/60 bg-brand/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              Rd {r}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-2">
        {picks.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No picks cached for {year} round {filterRound}. Hit refresh or wait for the daily cron.
          </div>
        )}
        {picks.map((pick) => {
          const player = pick.playerId ? linkedById.get(pick.playerId) : null;
          // "On the clock" applies only to the single earliest incomplete
          // pick across the entire draft — ESPN flags every future pick,
          // which we ignore here.
          const isOnClockNow = onClockPick != null && pick.overallPick === onClockPick;
          return (
            <Card key={pick.id} className="transition-colors hover:border-brand/40">
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex w-16 flex-col items-center justify-center">
                  <div className="text-xs text-muted-foreground">Pick</div>
                  <div className="font-black text-2xl leading-none">{pick.overallPick}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    R{pick.round} · #{pick.pickInRound}
                  </div>
                </div>
                <TeamBadge
                  abbr={pick.teamAbbr}
                  name={pick.teamName ?? pick.teamAbbr}
                  logo={pick.teamLogoUrl}
                  traded={pick.tradedFromAbbr}
                />
                <div className="flex flex-1 items-center gap-3">
                  {player ? (
                    <Link
                      href={`/player/${player.slug}`}
                      className="flex items-center gap-3 hover:text-brand"
                    >
                      <PlayerHeadshot
                        url={player.headshotUrl}
                        espnId={player.espnId}
                        espnIdSource={player.espnIdSource}
                        positionGroup={player.positionGroup}
                        name={player.fullName}
                        size="md"
                      />
                      <div>
                        <div className="font-semibold">{player.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {player.position} · {player.school}
                        </div>
                      </div>
                    </Link>
                  ) : pick.selectedAthlete ? (
                    <div className="flex items-center gap-3">
                      <PlayerHeadshot
                        espnId={pick.espnAthleteId}
                        espnIdSource="nfl"
                        name={pick.selectedAthlete}
                        size="md"
                      />
                      <div>
                        <div className="font-semibold">{pick.selectedAthlete}</div>
                        <div className="text-xs text-muted-foreground">ESPN athlete · not in local DB</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm italic text-muted-foreground/70">
                      {isOnClockNow ? "⏱ On the clock" : "—"}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isOnClockNow && <Badge variant="brand">On the clock</Badge>}
                  {pick.isCompleted && <Badge variant="outline">Completed</Badge>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TeamBadge({
  abbr, name, logo, traded,
}: { abbr: string; name: string; logo?: string | null; traded?: string | null }) {
  return (
    <div className="flex items-center gap-2 min-w-[9rem]">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} className="h-9 w-9 object-contain" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded bg-muted text-xs font-bold">
          {abbr}
        </div>
      )}
      <div className="text-sm leading-tight">
        <div className="font-semibold">{abbr}</div>
        {traded ? (
          <div className="text-[10px] text-muted-foreground">
            via {traded}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground truncate max-w-[6rem]">{name}</div>
        )}
      </div>
    </div>
  );
}
