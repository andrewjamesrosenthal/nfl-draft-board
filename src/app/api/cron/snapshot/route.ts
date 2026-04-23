import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Hourly cron: records a RankingSnapshot for every player in every active
// class, then recomputes CommunityRanking.trend7d as (current rating - rating
// from the nearest snapshot at least 7 days old).
//
// Wired up via vercel.json. Requires CRON_SECRET in the Authorization header.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = process.env.CRON_SECRET;
  if (token) {
    const expected = `Bearer ${token}`;
    if (auth !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
  const communityRankings = await db.communityRanking.findMany({
    include: { player: true },
  });

  // 1) Record current snapshots (community scope -> userId null).
  if (communityRankings.length > 0) {
    await db.rankingSnapshot.createMany({
      data: communityRankings.map((c) => ({
        userId: null,
        playerId: c.playerId,
        draftYear: c.draftYear,
        rating: c.rating,
        rankOverall: c.rankOverall,
        capturedAt: now,
      })),
    });
  }

  // 2) Compute trend7d for each player.
  const updates: Promise<unknown>[] = [];
  for (const c of communityRankings) {
    const older = await db.rankingSnapshot.findFirst({
      where: {
        userId: null,
        playerId: c.playerId,
        capturedAt: { lte: sevenDaysAgo },
      },
      orderBy: { capturedAt: "desc" },
    });
    const trend = older ? c.rating - older.rating : 0;
    updates.push(
      db.communityRanking.update({
        where: { id: c.id },
        data: { trend7d: trend },
      }),
    );
  }
  await Promise.all(updates);

  // 3) Retention: keep only 60 days of snapshots so the table does not balloon.
  const cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  await db.rankingSnapshot.deleteMany({ where: { capturedAt: { lt: cutoff } } });

  return NextResponse.json({
    ok: true,
    snapshotsWritten: communityRankings.length,
    capturedAt: now.toISOString(),
  });
}
