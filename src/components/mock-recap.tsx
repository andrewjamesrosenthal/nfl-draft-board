import type { MockDraft, MockDraftPick, Player } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { PlayerHeadshot } from "./player-headshot";
import { POSITION_COLOR } from "@/lib/positions";
import { TrendingUp, TrendingDown, Target, Trophy, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

type GradedPick = {
  pick: MockDraftPick;
  player: Player;
  boardRank: number;
  delta: number;
  verdict: "steal" | "value" | "fair" | "reach" | "major-reach";
};

const verdictStyles: Record<GradedPick["verdict"], string> = {
  "steal":       "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "value":       "bg-green-500/10 text-green-300 border-green-500/30",
  "fair":        "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
  "reach":       "bg-orange-500/15 text-orange-200 border-orange-500/30",
  "major-reach": "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function MockRecap({
  mock,
  graded,
  grade,
}: {
  mock: MockDraft & { picks: (MockDraftPick & { player: Player | null })[] };
  graded: GradedPick[];
  grade: { grade: number; letter: string };
}) {
  const steals = graded.filter((g) => g.verdict === "steal").sort((a, b) => b.delta - a.delta).slice(0, 5);
  const reaches = graded.filter((g) => g.verdict === "reach" || g.verdict === "major-reach")
    .sort((a, b) => a.delta - b.delta).slice(0, 5);
  const valuePicks = graded.filter((g) => g.verdict === "value").slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Draft recap · {mock.draftYear}</CardTitle>
            <div className="text-sm text-muted-foreground">
              {mock.mode.replace("_", " ")} · {mock.boardSource} board
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-4xl font-black gradient-text">{grade.letter}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">grade</div>
            </div>
            <Trophy className="h-10 w-10 text-brand" />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <HighlightList title="Biggest steals"   icon={TrendingUp}   items={steals}      empty="No steals this time."      accent="emerald" />
        <HighlightList title="Best value"       icon={Medal}        items={valuePicks}  empty="No value picks flagged."   accent="sky" />
        <HighlightList title="Biggest reaches"  icon={TrendingDown} items={reaches}     empty="No reaches flagged."       accent="rose" />
      </div>

      <Card>
        <CardHeader><CardTitle>Full recap</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1">
          {graded.map((g) => (
            <div key={g.pick.id} className="flex items-center gap-2 p-2 border-b border-border/50 last:border-0">
              <div className="w-12 font-mono text-xs text-muted-foreground">#{g.pick.overallPick}</div>
              <Badge variant="outline" className="w-12 justify-center">{g.pick.teamAbbr}</Badge>
              <PlayerHeadshot url={g.player.headshotUrl} espnId={g.player.espnId} espnIdSource={g.player.espnIdSource} positionGroup={g.player.positionGroup} name={g.player.fullName} size="sm" />
              <div className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{g.player.fullName}</span>
                <span className="text-muted-foreground"> · {g.player.position} · {g.player.school}</span>
              </div>
              <Badge className={cn("border", verdictStyles[g.verdict])}>
                {g.verdict === "major-reach" ? "major reach" : g.verdict} ({formatDelta(g.delta)})
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function HighlightList({
  title, icon: Icon, items, empty,
}: {
  title: string;
  icon: any;
  items: GradedPick[];
  empty: string;
  accent: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">{empty}</div>
        ) : items.map((g) => (
          <div key={g.pick.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 p-2">
            <PlayerHeadshot url={g.player.headshotUrl} espnId={g.player.espnId} espnIdSource={g.player.espnIdSource} positionGroup={g.player.positionGroup} name={g.player.fullName} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-sm">{g.player.fullName}</div>
              <div className="text-xs text-muted-foreground">
                Pick #{g.pick.overallPick} · Board #{g.boardRank}
              </div>
            </div>
            <Badge variant="outline" className={verdictStyles[g.verdict]}>
              {formatDelta(g.delta)}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}
