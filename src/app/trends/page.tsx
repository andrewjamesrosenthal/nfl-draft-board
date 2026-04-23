"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerHeadshot } from "@/components/player-headshot";
import { DisagreementMeter } from "@/components/disagreement-meter";
import { Select } from "@/components/ui/select";
import { POSITION_COLOR } from "@/lib/positions";
import { TrendingUp, TrendingDown, Flame, MessageCircle } from "lucide-react";

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

export default function TrendsPage() {
  const [year, setYear] = useState(2026);
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/trends?year=${year}`);
      setData(await res.json());
    })();
  }, [year]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Trends & hot takes</h1>
          <p className="text-muted-foreground">Who is heating up, who is falling, and where you disagree with the community.</p>
        </div>
        <div className="flex flex-col">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Class</label>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
      </header>

      {!data ? (
        <Card><CardContent className="p-8 animate-pulse text-muted-foreground">Loading trends...</CardContent></Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <TrendList
            title="Rising this week"
            icon={TrendingUp}
            items={data.rising}
            emptyText="Not enough data yet."
            valueKey="trend7d"
          />
          <TrendList
            title="Falling this week"
            icon={TrendingDown}
            items={data.falling}
            emptyText="Not enough data yet."
            valueKey="trend7d"
          />
          <TrendList
            title="Most controversial"
            icon={Flame}
            items={data.controversial}
            emptyText="No controversial players yet."
            valueKey="sigma"
            valueFormat={(v: number) => `σ ${Math.round(v)}`}
          />
          <TrendList
            title="Most compared"
            icon={MessageCircle}
            items={data.mostCompared.map((m: any) => ({ ...m.ranking, appearances: m.appearances }))}
            emptyText="No matchups yet."
            valueKey="appearances"
            valueFormat={(v: number) => `${v} votes`}
          />

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Biggest disagreement: you vs community</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.disagreements.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Vote a bit more to unlock your disagreements with the community.
                </div>
              ) : data.disagreements.map((d: any) => (
                <div key={d.player.id} className="flex items-center gap-3 border-b border-border/40 py-2 last:border-0">
                  <PlayerHeadshot url={d.player.headshotUrl} espnId={d.player.espnId} espnIdSource={d.player.espnIdSource} positionGroup={d.player.positionGroup} name={d.player.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/player/${d.player.slug}`} className="font-semibold truncate hover:underline">{d.player.fullName}</Link>
                    <div className="text-xs text-muted-foreground">
                      Community #{d.communityRank} · You #{d.personalRank}
                    </div>
                  </div>
                  <DisagreementMeter delta={d.delta} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Engagement</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {data.totalMatchups.toLocaleString()} total matchups logged for the {year} class.
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function TrendList({
  title, icon: Icon, items, emptyText, valueKey, valueFormat,
}: {
  title: string;
  icon: any;
  items: any[];
  emptyText: string;
  valueKey: string;
  valueFormat?: (v: number) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">{emptyText}</div>
        ) : items.map((r: any) => {
          const player = r.player ?? r;
          const value = r[valueKey];
          return (
            <Link
              key={player.id}
              href={`/player/${player.slug}`}
              className="flex items-center gap-2 rounded-md border border-transparent p-2 hover:border-border hover:bg-muted/40"
            >
              <PlayerHeadshot url={player.headshotUrl} espnId={player.espnId} espnIdSource={player.espnIdSource} positionGroup={player.positionGroup} name={player.fullName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-sm">{player.fullName}</span>
                  <Badge variant="outline" className={POSITION_COLOR[player.position]}>{player.position}</Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">{player.school}</div>
              </div>
              <div className="font-mono text-sm">
                {valueFormat ? valueFormat(value) : String(Math.round(value ?? 0))}
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
