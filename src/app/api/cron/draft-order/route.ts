import { NextResponse } from "next/server";
import db from "@/lib/db";
import { refreshFromEspn } from "@/app/api/draft/order/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Daily cron. Refreshes the cached ESPN draft order for every DraftClass with
// isCurrent=true and also the single next upcoming class (by draftDate).
// Wired up in vercel.json. Requires Authorization: Bearer <CRON_SECRET> in prod.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = process.env.CRON_SECRET;
  if (token) {
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const classes = await db.draftClass.findMany({
    where: { isCurrent: true },
    orderBy: { year: "desc" },
  });
  const years = Array.from(new Set(classes.map((c) => c.year)));

  // Also include the next upcoming class (in case nobody has flagged it current yet).
  const upcoming = await db.draftClass.findFirst({
    where: { draftDate: { gte: new Date() } },
    orderBy: { draftDate: "asc" },
  });
  if (upcoming && !years.includes(upcoming.year)) years.push(upcoming.year);

  const results: { year: number; picks: number; error?: string }[] = [];
  for (const year of years) {
    try {
      const n = await refreshFromEspn(year);
      results.push({ year, picks: n });
    } catch (e) {
      results.push({ year, picks: 0, error: (e as Error).message });
    }
  }
  return NextResponse.json({ ok: true, refreshed: results, ranAt: new Date().toISOString() });
}
