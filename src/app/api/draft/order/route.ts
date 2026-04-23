import { NextResponse } from "next/server";
import db from "@/lib/db";
import { refreshFromEspn } from "@/lib/espn/draft-order";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
  const shouldRefresh = url.searchParams.get("refresh") === "1";

  const existing = await db.draftOrderPick.count({ where: { draftYear: year } });
  if (shouldRefresh || existing === 0) {
    try {
      await refreshFromEspn(year);
    } catch (e) {
      if (existing === 0) {
        return NextResponse.json(
          { error: "upstream_failed", message: (e as Error).message },
          { status: 502 },
        );
      }
    }
  }

  const picks = await db.draftOrderPick.findMany({
    where: { draftYear: year },
    orderBy: { overallPick: "asc" },
  });
  return NextResponse.json({
    year,
    count: picks.length,
    picks,
    fetchedAt: picks[0]?.fetchedAt ?? null,
  });
}
