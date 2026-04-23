"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Player } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PlayerHeadshot } from "@/components/player-headshot";
import { POSITION_COLOR } from "@/lib/positions";
import { formatHeight, formatWeight, formatInches, formatForty, formatFloat } from "@/lib/format";

export default function SideBySideComparePage() {
  const [leftQuery, setLeftQuery]   = useState("");
  const [rightQuery, setRightQuery] = useState("");
  const [leftOptions, setLeftOptions]   = useState<Player[]>([]);
  const [rightOptions, setRightOptions] = useState<Player[]>([]);
  const [left, setLeft]   = useState<Player | null>(null);
  const [right, setRight] = useState<Player | null>(null);

  useEffect(() => { void search(leftQuery, setLeftOptions); }, [leftQuery]);
  useEffect(() => { void search(rightQuery, setRightOptions); }, [rightQuery]);

  const rows = useMemo(() => makeRows(left, right), [left, right]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Side-by-side compare</h1>
        <p className="text-muted-foreground">Pick any two prospects to see their measurements, testing, and scouting side by side.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {[{ q: leftQuery, setQ: setLeftQuery, opts: leftOptions, selected: left, setSelected: setLeft, label: "Left" },
          { q: rightQuery, setQ: setRightQuery, opts: rightOptions, selected: right, setSelected: setRight, label: "Right" }]
        .map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardTitle className="text-base">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Input placeholder="Search prospects..." value={s.q} onChange={(e) => s.setQ(e.target.value)} />
              {!s.selected && s.opts.map((p) => (
                <button key={p.id} onClick={() => { s.setSelected(p); s.setQ(""); }}
                  className="flex items-center gap-2 rounded-md border border-border bg-card/60 p-2 hover:border-brand text-left">
                  <PlayerHeadshot url={p.headshotUrl} espnId={p.espnId} espnIdSource={p.espnIdSource} positionGroup={p.positionGroup} name={p.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.fullName}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.position} · {p.school} · {p.draftYear}</div>
                  </div>
                </button>
              ))}
              {s.selected && (
                <div className="flex items-center gap-3 rounded-md border border-border bg-card/60 p-3">
                  <PlayerHeadshot url={s.selected.headshotUrl} espnId={s.selected.espnId} espnIdSource={s.selected.espnIdSource} positionGroup={s.selected.positionGroup} name={s.selected.fullName} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/player/${s.selected.slug}`} className="font-semibold truncate hover:underline">{s.selected.fullName}</Link>
                      <Badge variant="outline" className={POSITION_COLOR[s.selected.position]}>{s.selected.position}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{s.selected.school}</div>
                  </div>
                  <button onClick={() => s.setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">change</button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {left && right && (
        <Card>
          <CardHeader><CardTitle>Attribute-by-attribute</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1">
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-border/40 py-1.5 last:border-0 text-sm">
                <div className="text-right font-mono">{row.left}</div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground text-center w-32">{row.label}</div>
                <div className="font-mono">{row.right}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function search(q: string, setter: (arr: Player[]) => void) {
  if (!q.trim()) return setter([]);
  const res = await fetch(`/api/players?q=${encodeURIComponent(q)}`);
  const json = await res.json();
  setter(json.items ?? []);
}

function makeRows(l: Player | null, r: Player | null) {
  if (!l || !r) return [];
  // Measurement rows are only included when at least one of the two players
  // has a value — no point comparing "--" vs "--".
  const mRows: { label: string; left: string | number; right: string | number }[] = [];
  const add = (
    label: string,
    lVal: number | null | undefined,
    rVal: number | null | undefined,
    fmt: (n: number) => string,
  ) => {
    if (lVal == null && rVal == null) return;
    mRows.push({ label, left: lVal != null ? fmt(lVal) : "--", right: rVal != null ? fmt(rVal) : "--" });
  };

  add("Height",   l.heightInches, r.heightInches, formatHeight);
  add("Weight",   l.weightLbs,    r.weightLbs,    formatWeight);
  add("Arm",      l.armInches,    r.armInches,    (n) => formatInches(n));
  add("Hand",     l.handInches,   r.handInches,   (n) => formatInches(n));
  add("40 yard",  l.fortyYard,    r.fortyYard,    formatForty);
  add("10 split", l.tenYardSplit, r.tenYardSplit, (n) => formatFloat(n));
  add("Vertical", l.verticalIn,   r.verticalIn,   (n) => formatFloat(n, 1));
  add("Broad",    l.broadJumpIn,  r.broadJumpIn,  (n) => `${n}"`);
  add("3 cone",   l.threeConeSec, r.threeConeSec, (n) => formatFloat(n));
  add("Shuttle",  l.shuttleSec,   r.shuttleSec,   (n) => formatFloat(n));
  add("Bench",    l.benchReps,    r.benchReps,    (n) => `${n}`);

  return [
    { label: "Position",    left: l.position,   right: r.position },
    { label: "Class",       left: l.draftYear,  right: r.draftYear },
    { label: "School",      left: l.school,     right: r.school },
    ...mRows,
  ];
}
