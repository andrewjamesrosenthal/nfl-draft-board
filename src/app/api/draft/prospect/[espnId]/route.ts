import { NextResponse } from "next/server";
import { fetchProspect } from "@/lib/espn/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/draft/prospect/{espnId}?year=2026
// Passthrough to ESPN's draft/athlete endpoint. Used during seed and by the
// admin UI to pull headshot + bio for a current-year prospect.
export async function GET(
  req: Request,
  { params }: { params: { espnId: string } },
) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
  try {
    const data = await fetchProspect(params.espnId, year);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: "upstream_failed", message: (e as Error).message },
      { status: 502 },
    );
  }
}
