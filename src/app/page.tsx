import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerHeadshot } from "@/components/player-headshot";
import { PlayerSearch } from "@/components/player-search";
import { POSITION_COLOR } from "@/lib/positions";
import db from "@/lib/db";
import { Swords, ClipboardList, LineChart, Users, Radio, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const currentClass = await db.draftClass.findFirst({ where: { isCurrent: true } });
  const currentYear = currentClass?.year ?? 2026;

  const [topCommunity, totalMatchups, totalPlayers] = await Promise.all([
    db.communityRanking.findMany({
      where: { draftYear: currentYear },
      include: { player: true },
      orderBy: { rating: "desc" },
      take: 10,
    }),
    db.pairwiseMatchup.count(),
    db.player.count(),
  ]);

  const daysToDraft = currentClass?.draftDate
    ? Math.ceil((new Date(currentClass.draftDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="flex flex-col gap-14">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 card-lux p-8 md:p-16">
        {/* Layered color washes for depth. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-16 h-[420px] w-[420px] rounded-full bg-brand/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-10 h-[360px] w-[360px] rounded-full bg-brand-2/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,hsl(220_80%_40%/0.12),transparent_50%)]" />
        </div>
        {/* Subtle top stripe mirrors the prospect cards in the arena. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px] stripe opacity-70" />
        <div className="relative flex flex-col gap-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-brand/40 bg-brand/10 text-foreground">
              <Sparkles className="h-3 w-3 text-brand" />
              {currentClass?.name ?? "Current class"}
            </span>
            {daysToDraft != null && daysToDraft > 0 && (
              <span className="chip">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-slow-pulse" />
                {daysToDraft} day{daysToDraft === 1 ? "" : "s"} to draft
              </span>
            )}
            {daysToDraft != null && daysToDraft <= 0 && (
              <span className="chip border-emerald-500/40 text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-slow-pulse" />
                Draft is live
              </span>
            )}
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-black tracking-tighter max-w-3xl leading-[1.02]">
            The NFL Draft board<br className="hidden md:inline" />
            <span className="gradient-text"> only you</span> could build.
          </h1>
          <p className="text-muted-foreground md:text-lg max-w-2xl leading-relaxed">
            Compare prospects head to head, watch your rankings take shape in real time,
            and stack them against the community consensus.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/compare" className="btn-brand inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold">
              <Swords className="h-4 w-4" /> Start comparing
            </Link>
            <Link
              href="/community"
              className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-5 py-3 text-sm font-medium text-foreground/90 transition-colors hover:border-brand/40 hover:text-foreground"
            >
              <Users className="h-4 w-4" /> Community board
            </Link>
            <Link
              href="/draft-order"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Radio className="h-4 w-4" /> Live draft order
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 pt-2 text-xs">
            <span className="chip"><span className="num font-semibold text-foreground">{totalPlayers}</span> prospects · 9 classes</span>
            <span className="chip"><span className="num font-semibold text-foreground">{totalMatchups}</span> matchups</span>
            <span className="chip">Elo paired-comparison engine</span>
          </div>
          <div className="pt-2 md:max-w-md">
            <PlayerSearch />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <FeatureCard icon={Swords}        title="Pairwise arena"      href="/compare"     desc="Pick between two prospects. Your choices tune Elo ratings in real time." />
        <FeatureCard icon={ClipboardList} title="Your big board"      href="/board"       desc="See your rankings by position, team needs, or draft class. Pin manual overrides." />
        <FeatureCard icon={Users}         title="Community consensus" href="/community"   desc="Aggregated board from every voter, filtered by school, conference, testing." />
        <FeatureCard icon={Radio}         title="Live draft order"    href="/draft-order" desc="The live NFL Draft order, sourced from ESPN and linked to your board picks." />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Community top 10 · {currentYear}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {topCommunity.map((c, idx) => (
              <Link
                href={`/player/${c.player.slug}`}
                key={c.id}
                className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/40"
              >
                <div className="w-6 text-center font-mono text-sm text-muted-foreground">{idx + 1}</div>
                <PlayerHeadshot url={c.player.headshotUrl} espnId={c.player.espnId} espnIdSource={c.player.espnIdSource} positionGroup={c.player.positionGroup} name={c.player.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate font-semibold">{c.player.fullName}</span>
                    <Badge variant="outline" className={POSITION_COLOR[c.player.position]}>{c.player.position}</Badge>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{c.player.school}</div>
                </div>
                <div className="font-mono text-sm">{Math.round(c.rating)}</div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-4 w-4" /> Quick look
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
            <p>
              DraftBoard uses an Elo-based paired-comparison engine. Early votes move ratings a
              lot, and every player carries an uncertainty band (sigma) that shrinks as you
              compare them more. That means you see a confidence label on each of your rankings,
              not just an ordered list.
            </p>
            <p>
              The arena progresses through stages — start with the top of each position, fill
              out same-position boards, then move to cross-position comparisons, and finally
              pit current prospects against actual picks from 2018–2025.
            </p>
            <p>
              Mock drafts and historical redraft tools are on the roadmap — see the About page
              for what's coming.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm"><Link href="/about">Read methodology</Link></Button>
              <Button asChild variant="ghost"   size="sm"><Link href="/draft-order">Draft order</Link></Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function FeatureCard({
  icon: Icon, title, desc, href,
}: {
  icon: any;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="hover-lift card-lux h-full border-border/60">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand/20 to-brand-2/20 text-brand ring-1 ring-inset ring-brand/30 transition-transform group-hover:scale-110">
            <Icon className="h-5 w-5" />
          </div>
          <div className="font-display text-lg font-semibold tracking-tight">{title}</div>
          <div className="text-sm text-muted-foreground leading-relaxed">{desc}</div>
          <div className="mt-auto pt-2 text-xs font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
            Open →
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
