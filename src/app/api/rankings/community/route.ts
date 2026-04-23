import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? "2026");
  const position = url.searchParams.get("position") ?? undefined;
  const conference = url.searchParams.get("conference") ?? undefined;
  const school = url.searchParams.get("school") ?? undefined;
  const minHeight = Number(url.searchParams.get("minHeight") ?? "0");
  const maxHeight = Number(url.searchParams.get("maxHeight") ?? "99");
  const minWeight = Number(url.searchParams.get("minWeight") ?? "0");
  const maxWeight = Number(url.searchParams.get("maxWeight") ?? "999");
  const maxAge = Number(url.searchParams.get("maxAge") ?? "99");
  const minForty = Number(url.searchParams.get("minForty") ?? "0");
  const maxForty = Number(url.searchParams.get("maxForty") ?? "99");

  const rankings = await db.communityRanking.findMany({
    where: {
      draftYear: year,
      player: {
        ...(position ? { position: position as any } : {}),
        ...(conference ? { conference } : {}),
        ...(school ? { school } : {}),
        ...(minHeight ? { heightInches: { gte: minHeight * 12 } } : {}),
      },
    },
    include: {
      player: {
        include: { reports: { take: 1, orderBy: { updatedAt: "desc" } } },
      },
    },
    orderBy: { rating: "desc" },
  });

  const filtered = rankings.filter((r) => {
    const p = r.player;
    if (p.heightInches != null) {
      if (p.heightInches > maxHeight * 12) return false;
    }
    if (p.weightLbs != null) {
      if (p.weightLbs < minWeight || p.weightLbs > maxWeight) return false;
    }
    if (p.age != null && p.age > maxAge) return false;
    if (p.fortyYard != null) {
      if (p.fortyYard < minForty || p.fortyYard > maxForty) return false;
    }
    return true;
  });

  return NextResponse.json({ items: filtered });
}
