import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Clock, GraduationCap } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight">Methodology</h1>
        <p className="text-muted-foreground">How DraftBoard builds your personal board and the community consensus.</p>
      </header>

      <Card className="relative overflow-hidden">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px] stripe" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" /> Roadmap
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground leading-relaxed">
          <div className="flex items-start gap-2">
            <GraduationCap className="h-4 w-4 mt-0.5 shrink-0 text-brand" />
            <div>
              <span className="font-semibold text-foreground">Pick Grader — unlocks after Round 1.</span>{" "}
              Once the picks are in, compare every selection head-to-head and earn an A+ to F− grade
              for each pick. Talent matters, but so does value — a late-round steal can outgrade
              a first-round overdraft.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <span className="font-semibold text-foreground">Mock drafts, coming soon.</span>{" "}
              The mock draft runner is being rebuilt to use live board ratings alongside team needs
              and positional value. Focus on stacking your personal board — that data feeds the
              mock engine when it ships.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <span className="font-semibold text-foreground">Historical redraft, coming soon.</span>{" "}
              Pre-draft vs actual comparisons and biggest-steals views are on deck. You can already
              pit current prospects against past picks in Historical mode in the arena.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pairwise comparison engine</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed flex flex-col gap-3">
          <p>
            Every prospect starts at the same baseline rating (1500) with a relatively large
            uncertainty (sigma of 350). When you pick one player over another, both ratings
            move using an Elo-style update. The K factor decays as players get more votes, so
            early choices move the needle more than late ones.
          </p>
          <p>
            Sigma decays slowly toward a floor over time. Combined with the number of
            comparisons you've made for a player, it drives the confidence label you see on
            each board row: volatile, forming, medium, high, or locked in.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Matchup selection</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed flex flex-col gap-3">
          <p>
            The selector prioritizes prospects with the highest remaining uncertainty, then
            pairs them with a player ranked close to them so every vote is informative. It
            avoids pairs that showed up in your last 25 matchups and occasionally revisits
            older matchups to refine rankings.
          </p>
          <p>
            The arena progresses through four stages automatically: top players at each position,
            full same-position board, cross-position comparisons, and finally current prospects
            vs actual picks from 2018–2025. You can also lock to a specific mode at any time.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pick Grader</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed flex flex-col gap-3">
          <p>
            After Round 1, every pick in the 2026 class becomes comparable — not just as
            players, but as selections. The Pick Grader runs a separate Elo system on drafted
            players: you compare two picks and decide which gave the team better value.
          </p>
          <p>
            Grades (A+ to F−) are assigned by percentile rank within the class, not by
            raw Elo. This means roughly the top 8% earn A or better, and only the worst
            4% fall to F territory. A third-round steal can absolutely outgrade a first-round bust.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Community consensus</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          Community ratings are a parallel Elo run where every non-skipped vote from any user
          updates both players. Ranks within a class are recomputed after every batch of votes
          so the live board stays consistent. We use the same scale as personal boards so you
          can compare ratings directly.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Data sources</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed flex flex-col gap-2">
          <p>
            Historical picks and combine measurables come from nflverse via nfl_data_py —
            all 257+ picks per class from 2018–2025. Headshots use ESPN's CDN (NFL bucket
            for drafted players, college-football bucket for prospects). The 2026 declared
            prospect list is sourced from public declarations as of April 2026.
          </p>
          <p>
            All player data is for research and illustrative purposes. DraftBoard is an
            independent project and is not affiliated with the NFL, ESPN, or any team.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
