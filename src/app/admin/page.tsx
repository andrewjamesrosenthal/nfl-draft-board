import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { POSITION_COLOR } from "@/lib/positions";
import { isAdminAuthorized } from "@/lib/admin";
import { AdminLogin } from "./admin-login";

export const dynamic = "force-dynamic";

// Gated via ADMIN_TOKEN env + cookie. Production auth should replace this
// with real RBAC, but this keeps the page from being public by default.
export default async function AdminPage() {
  if (!isAdminAuthorized()) {
    return (
      <div className="flex flex-col gap-6 max-w-md">
        <header>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Admin</h1>
          <p className="text-muted-foreground">Enter your admin token to continue.</p>
        </header>
        <AdminLogin />
        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground">
            Set <code>ADMIN_TOKEN</code> in your environment. If the variable is missing the
            admin area is locked entirely.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [counts, classes, players] = await Promise.all([
    Promise.all([
      db.player.count(),
      db.draftClass.count(),
      db.team.count(),
      db.teamNeed.count(),
      db.pairwiseMatchup.count(),
      db.userRanking.count(),
      db.mockDraft.count(),
      db.scoutingReport.count(),
    ]),
    db.draftClass.findMany({ orderBy: { year: "desc" } }),
    db.player.findMany({
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
  ]);

  const [players_n, classes_n, teams_n, needs_n, matchups_n, rankings_n, mocks_n, reports_n] = counts;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Admin</h1>
          <p className="text-muted-foreground">Diagnostics, data health, and content tools.</p>
        </div>
        <form action="/api/admin/logout" method="post">
          <button className="text-sm text-muted-foreground underline-offset-2 hover:underline">Sign out</button>
        </form>
      </header>
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Players"   value={players_n} />
        <Metric label="Classes"   value={classes_n} />
        <Metric label="Teams"     value={teams_n} />
        <Metric label="Needs"     value={needs_n} />
        <Metric label="Matchups"  value={matchups_n} />
        <Metric label="Rankings"  value={rankings_n} />
        <Metric label="Mocks"     value={mocks_n} />
        <Metric label="Reports"   value={reports_n} />
      </div>
      <Card>
        <CardHeader><CardTitle>Draft classes</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1">
          {classes.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span>{c.name}</span>
              <div className="flex items-center gap-2">
                {c.draftDate && <span className="text-xs text-muted-foreground">{new Date(c.draftDate).toLocaleDateString()}</span>}
                {c.isCurrent && <Badge variant="brand">current</Badge>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recently edited players</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1">
          {players.map((p) => (
            <Link key={p.id} href={`/player/${p.slug}`} className="flex items-center gap-2 rounded-md p-1 hover:bg-muted/40 text-sm">
              <div className="font-medium flex-1 truncate">{p.fullName}</div>
              <Badge variant="outline" className={POSITION_COLOR[p.position]}>{p.position}</Badge>
              <span className="text-xs text-muted-foreground w-12 text-right">{p.draftYear}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Operations</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <div>
            POST <code>/api/scouting/generate</code> with <code>{"{ playerId, style? }"}</code> to write an
            AI-sourced scouting report for a player. Wire an LLM provider in <code>src/app/api/scouting/generate/route.ts</code>.
          </div>
          <div>
            GET <code>/api/cron/snapshot</code> with the <code>CRON_SECRET</code> header to record ranking
            snapshots and refresh <code>trend7d</code>. The Vercel cron config runs it hourly.
          </div>
          <div>
            Import new classes by adding <code>prisma/seed-data/players-YYYY.ts</code> and re-running
            <code>npm run db:seed</code>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-mono text-2xl font-semibold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
