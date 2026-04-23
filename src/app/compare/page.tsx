import { PairwiseArena } from "@/components/pairwise-arena";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ComparePage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          Head-to-head <span className="gradient-text">arena</span>
        </h1>
        <p className="text-muted-foreground">
          Pick the player you prefer as an NFL prospect. Your choices tune your personal board
          and feed the live community consensus.
        </p>
      </header>
      <PairwiseArena />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How this works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          Each vote updates both prospects using an Elo-style paired comparison model. Early
          votes move ratings more; as you vote more, the system settles. The matchup selector
          mostly pairs players close in your current ranking, occasionally re-tests earlier
          matchups, and avoids duplicates from your recent votes. In overall mode you will
          sometimes see cross-position comparisons to help stack the whole board.
        </CardContent>
      </Card>
    </div>
  );
}
