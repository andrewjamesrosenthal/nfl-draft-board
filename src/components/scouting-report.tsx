import type { ScoutingReport } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CheckCircle2, AlertTriangle, Users } from "lucide-react";

function parseList(value: string): string[] {
  try { return JSON.parse(value) as string[]; } catch { return []; }
}

export function ScoutingReportCard({ report }: { report: ScoutingReport }) {
  const strengths = parseList(report.strengths);
  const weaknesses = parseList(report.weaknesses);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Scouting report</CardTitle>
          <Badge variant="outline">{labelFor(report.source)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Strengths
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {strengths.map((s, i) => <li key={i}>— {s}</li>)}
            </ul>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-300">
              <AlertTriangle className="h-4 w-4" /> Weaknesses
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {weaknesses.map((w, i) => <li key={i}>— {w}</li>)}
            </ul>
          </div>
        </div>
        {report.nflComp && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">NFL comp:</span>
            <span className="font-semibold">{report.nflComp}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function labelFor(source: string): string {
  switch (source) {
    case "INTERNAL": return "Internal summary";
    case "LICENSED": return "Licensed source";
    case "USER":     return "Community writeup";
    case "AI":       return "AI generated";
    default:         return source;
  }
}
