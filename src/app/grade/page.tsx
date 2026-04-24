import { Lock, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PICK_GRADE_UNLOCK } from "@/lib/pick-grade";
import { GradeClientShell } from "./grade-client-shell";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GradePage() {
  const now = new Date();
  const dateLocked = now < PICK_GRADE_UNLOCK;

  // Also unlock once actual picks exist in the DB regardless of date.
  const completedPicks = dateLocked ? 0 : await db.player.count({
    where: { draftYear: 2026, actualPick: { not: null } },
  });
  const locked = dateLocked || completedPicks < 2;

  const msLeft = dateLocked ? PICK_GRADE_UNLOCK.getTime() - now.getTime() : 0;
  const hoursLeft = Math.ceil(msLeft / 3_600_000);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <header>
        <div className="flex items-center gap-2.5">
          <GraduationCap className="h-7 w-7 text-brand" />
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight">
            Pick Grader
          </h1>
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
              <Lock className="h-3 w-3" /> Unlocks after Round 1
            </span>
          )}
        </div>
        <p className="mt-1 text-muted-foreground">
          Grade every pick in the 2026 NFL Draft. Compare picks head-to-head
          and earn a letter grade for each — A+ to F- — weighted by both
          player talent and pick value.
        </p>
      </header>

      {locked ? (
        <LockScreen hoursLeft={hoursLeft} />
      ) : (
        <GradeClientShell />
      )}
    </div>
  );
}

function LockScreen({ hoursLeft }: { hoursLeft: number }) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="relative overflow-hidden">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px] stripe" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-400" />
            Unlocks after Round 1 · April 23, 2026
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            The Pick Grader opens once Round 1 is complete — approximately{" "}
            <span className="font-semibold text-foreground">
              {hoursLeft} hour{hoursLeft === 1 ? "" : "s"} from now.
            </span>{" "}
            Come back after the picks are in and start grading.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { step: "1", title: "Compare picks", body: "Two picks appear side by side. Choose which gave the team better value — talent matters, but so does the pick cost." },
              { step: "2", title: "Ratings update live", body: "Each vote updates Elo ratings for both picks. High-value steals rise; overdrafts fall." },
              { step: "3", title: "See letter grades", body: "Your grades rank from A+ (elite value) to F- (historic bust). The class board shows every pick graded and sorted." },
            ].map(({ step, title, body }) => (
              <div key={step} className="rounded-xl border border-border/50 p-4">
                <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  {step}
                </div>
                <p className="font-semibold text-foreground mb-1">{title}</p>
                <p className="text-xs">{body}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Grade scale preview */}
      <Card>
        <CardHeader><CardTitle>Grade scale</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "A+", hex: "#10b981" }, { label: "A", hex: "#22c55e" }, { label: "A-", hex: "#4ade80" },
              { label: "B+", hex: "#a3e635" }, { label: "B", hex: "#facc15" }, { label: "B-", hex: "#fb923c" },
              { label: "C+", hex: "#f97316" }, { label: "C", hex: "#ef4444" }, { label: "C-", hex: "#dc2626" },
              { label: "D+", hex: "#b91c1c" }, { label: "D", hex: "#991b1b" }, { label: "D-", hex: "#7f1d1d" },
              { label: "F", hex: "#6b21a8" }, { label: "F-", hex: "#581c87" },
            ].map(({ label, hex }) => (
              <span
                key={label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white shadow-md"
                style={{ background: hex }}
              >
                {label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Grades are assigned by percentile rank within the class — not absolute Elo.
            Roughly top 8% earn an A or better; bottom 4% land in F territory.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
