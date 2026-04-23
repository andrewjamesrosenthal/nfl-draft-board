"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import type { MockDraft, MockDraftPick, Player } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { PlayerHeadshot } from "./player-headshot";
import { POSITION_COLOR } from "@/lib/positions";
import { formatHeight, formatWeight } from "@/lib/format";
import { Swords, Flag, Trophy, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type MockWithPicks = MockDraft & {
  picks: (MockDraftPick & { player: Player | null })[];
};

type BoardEntry = { player: Player; rating: number; rankOverall: number };

export function MockDraftRunner({ mockId }: { mockId: string }) {
  const [mock, setMock] = useState<MockWithPicks | null>(null);
  const [available, setAvailable] = useState<BoardEntry[]>([]);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [grade, setGrade] = useState<any>(null);

  const load = async () => {
    const res = await fetch(`/api/mock/${mockId}`);
    const json = await res.json();
    setMock(json.mock);
    setGrade(json.grade);
  };

  useEffect(() => { void load(); }, [mockId]);

  // Fetch board for available players when mock loads.
  useEffect(() => {
    if (!mock) return;
    (async () => {
      const res = await fetch(
        mock.boardSource === "personal"
          ? `/api/rankings/personal?year=${mock.draftYear}`
          : `/api/rankings/community?year=${mock.draftYear}`,
      );
      const json = await res.json();
      const picked = new Set(mock.picks.filter((p) => p.player).map((p) => p.player!.id));
      const entries: BoardEntry[] = (json.items ?? [])
        .filter((i: any) => !picked.has(i.player.id))
        .map((i: any, idx: number) => ({
          player: i.player,
          rating: i.rating,
          rankOverall: i.rank ?? idx + 1,
        }));
      setAvailable(entries);
    })();
  }, [mock]);

  const currentSlot = useMemo(() => {
    if (!mock) return null;
    return mock.picks.find((p) => !p.player) ?? null;
  }, [mock]);

  const isUserSlot = useMemo(() => {
    if (!mock || !currentSlot) return false;
    if (mock.control === "ALL_TEAMS") return true;
    if (mock.control === "SINGLE_TEAM") return mock.userTeamAbbr === currentSlot.teamAbbr;
    return false;
  }, [mock, currentSlot]);

  const pick = async (playerId: number | null) => {
    if (!currentSlot || !mock) return;
    setLoading(true);
    await fetch(`/api/mock/${mock.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        overallPick: currentSlot.overallPick,
        playerId,
        autoAdvance: true,
      }),
    });
    setLoading(false);
    await load();
  };

  if (!mock) return <div className="text-muted-foreground">Loading mock...</div>;

  const completed = mock.picks.every((p) => p.player);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {mock.title ?? `${mock.draftYear} Mock Draft`}
                </CardTitle>
                <div className="text-xs text-muted-foreground">
                  {mock.mode.replace("_", " ")} · board: {mock.boardSource} · control: {mock.control.replace("_", " ").toLowerCase()}
                </div>
              </div>
              {grade && (
                <Badge variant="brand" className="text-sm">
                  <Trophy className="h-4 w-4 mr-1" /> {grade.letter} · {grade.grade.toFixed(1)}
                </Badge>
              )}
            </div>
          </CardHeader>
        </Card>

        {!completed && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-4 w-4" />
                On the clock: {currentSlot?.teamAbbr} · Pick {currentSlot?.overallPick}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {isUserSlot ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search players..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
                      <option value="">All positions</option>
                      {["QB","RB","WR","TE","OT","IOL","EDGE","DT","LB","CB","S"].map((p) =>
                        <option key={p} value={p}>{p}</option>)}
                    </Select>
                    <Button variant="ghost" onClick={() => pick(null)}>Skip pick</Button>
                  </div>
                  <div className="grid gap-2 max-h-[500px] overflow-auto">
                    {available
                      .filter((b) =>
                        (!search || b.player.fullName.toLowerCase().includes(search.toLowerCase())) &&
                        (!positionFilter || b.player.position === positionFilter))
                      .slice(0, 40)
                      .map((b) => (
                        <button
                          key={b.player.id}
                          onClick={() => pick(b.player.id)}
                          disabled={loading}
                          className="text-left hover-lift rounded-md border border-border bg-card/60 p-2 flex items-center gap-3"
                        >
                          <div className="w-8 text-center font-mono text-xs text-muted-foreground">#{b.rankOverall}</div>
                          <PlayerHeadshot url={b.player.headshotUrl} espnId={b.player.espnId} espnIdSource={b.player.espnIdSource} positionGroup={b.player.positionGroup} name={b.player.fullName} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-semibold">{b.player.fullName}</span>
                              <Badge variant="outline" className={POSITION_COLOR[b.player.position]}>{b.player.position}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {b.player.school} · {formatHeight(b.player.heightInches)} / {formatWeight(b.player.weightLbs)}
                            </div>
                          </div>
                          <div className="font-mono text-sm">{Math.round(b.rating)}</div>
                        </button>
                      ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button onClick={() => pick(null)} disabled={loading} className="flex-1">
                    <Swords className="h-4 w-4" /> Run CPU pick for {currentSlot?.teamAbbr}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Pick order</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1 max-h-[700px] overflow-auto">
            {mock.picks.map((p) => (
              <PickRow key={p.id} pick={p} highlight={p.id === currentSlot?.id} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        {completed && <ShareCard mock={mock} />}
        <Card>
          <CardHeader><CardTitle>Best available</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1">
            {available.slice(0, 12).map((b) => (
              <Link
                key={b.player.id}
                href={`/player/${b.player.slug}`}
                className="flex items-center gap-2 rounded-md border border-transparent p-2 hover:border-border hover:bg-muted/40"
              >
                <div className="w-8 text-center font-mono text-xs text-muted-foreground">#{b.rankOverall}</div>
                <PlayerHeadshot url={b.player.headshotUrl} espnId={b.player.espnId} espnIdSource={b.player.espnIdSource} positionGroup={b.player.positionGroup} name={b.player.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-sm">{b.player.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.player.position} · {b.player.school}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PickRow({ pick, highlight }: { pick: MockDraftPick & { player: Player | null }; highlight: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-transparent p-2 text-sm",
        highlight && "border-brand/60 bg-brand/5",
      )}
    >
      <div className="w-12 text-center font-mono text-xs text-muted-foreground">
        {pick.round}.{String(((pick.overallPick - 1) % 32) + 1).padStart(2, "0")}
      </div>
      <Badge variant="outline" className="w-12 justify-center">{pick.teamAbbr}</Badge>
      {pick.player ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <PlayerHeadshot url={pick.player.headshotUrl} espnId={pick.player.espnId} espnIdSource={pick.player.espnIdSource} positionGroup={pick.player.positionGroup} name={pick.player.fullName} size="sm" />
          <div className="min-w-0 flex-1 truncate">
            <Link href={`/player/${pick.player.slug}`} className="font-semibold hover:underline">
              {pick.player.fullName}
            </Link>{" "}
            <span className="text-muted-foreground">
              · {pick.player.position} · {pick.player.school}
            </span>
          </div>
          {pick.byUser ? <Badge variant="brand">you</Badge> : <Badge variant="outline">CPU</Badge>}
        </div>
      ) : (
        <span className="text-muted-foreground">On the clock...</span>
      )}
    </div>
  );
}

function ShareCard({ mock }: { mock: MockDraft }) {
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/mock/${mock.id}`
    : `/mock/${mock.id}`;
  return (
    <Card>
      <CardHeader><CardTitle>Share</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Input readOnly value={url} />
        <Button onClick={() => navigator.clipboard.writeText(url)}>Copy link</Button>
      </CardContent>
    </Card>
  );
}
