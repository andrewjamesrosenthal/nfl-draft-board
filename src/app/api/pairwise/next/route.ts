import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";
import { selectNextMatchup, type MatchupContext } from "@/lib/matchup-selector";
import type { Position } from "@/types";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  mode: z.enum(["AUTO", "OVERALL", "POSITION", "GROUP", "HISTORICAL"]).default("AUTO"),
  position: z.string().optional(),
  group: z.string().optional(),
  year: z.coerce.number().int().default(2026),
  // Comma-separated list of historical years to draw opponents from.
  historicalYears: z.string().optional(),
  // Keep a just-voted player in the next matchup (2–3 times after a vote).
  stickyId: z.coerce.number().int().optional(),
  // Lock a player into every matchup until unlocked.
  lockedId: z.coerce.number().int().optional(),
  // Restrict the player pool to the top N by community ranking.
  topN: z.coerce.number().int().min(10).max(500).optional(),
});

export async function GET(req: Request) {
  const { id: userId } = await getOrCreateUser();
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    mode: url.searchParams.get("mode") ?? undefined,
    position: url.searchParams.get("position") ?? undefined,
    group: url.searchParams.get("group") ?? undefined,
    year: url.searchParams.get("year") ?? undefined,
    historicalYears: url.searchParams.get("historicalYears") ?? undefined,
    stickyId: url.searchParams.get("stickyId") ?? undefined,
    lockedId: url.searchParams.get("lockedId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { mode, position, group, year, historicalYears, stickyId, lockedId, topN } = parsed.data;

  let ctx: MatchupContext;
  if (mode === "POSITION" && position) {
    ctx = { kind: "POSITION", position: position as Position, draftYear: year };
  } else if (mode === "GROUP" && group) {
    ctx = { kind: "GROUP", group, draftYear: year };
  } else if (mode === "HISTORICAL") {
    const parsedYears = (historicalYears ?? "2018,2019,2020,2021,2022,2023,2024,2025")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n !== year);
    ctx = {
      kind: "HISTORICAL",
      draftYear: year,
      historicalYears: parsedYears,
      position: position ? (position as Position) : undefined,
    };
  } else if (mode === "OVERALL") {
    ctx = { kind: "OVERALL", draftYear: year };
  } else {
    // AUTO is the default — progressive stages driven by vote count.
    ctx = { kind: "AUTO", draftYear: year };
  }

  // Pinning overrides stage selection: a locked or sticky player is always in
  // the next matchup. Opponent selection still respects the context window.
  const pinnedId = lockedId ?? stickyId ?? null;
  const matchup = await selectNextMatchup(userId, ctx, pinnedId, topN ?? null);
  if (!matchup) {
    return NextResponse.json({ matchup: null, stats: await userStats(userId) });
  }
  // How many times the community has voted on this exact pair (either order).
  const communityVotes = await db.pairwiseMatchup.count({
    where: {
      skipped: false,
      OR: [
        { leftId: matchup.left.id,  rightId: matchup.right.id },
        { leftId: matchup.right.id, rightId: matchup.left.id },
      ],
    },
  });
  return NextResponse.json({
    matchup: { ...matchup, communityVotes },
    stats: await userStats(userId),
  });
}

// Totals that the arena shows in its counter badges. We compute these here so
// the UI survives page reloads without relying on local state.
async function userStats(userId: string) {
  const [votes, skips, lastMatchup] = await Promise.all([
    db.pairwiseMatchup.count({ where: { userId, skipped: false } }),
    db.pairwiseMatchup.count({ where: { userId, skipped: true } }),
    db.pairwiseMatchup.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { skipped: true, createdAt: true },
    }),
  ]);
  // Current streak = consecutive non-skipped matchups walking backwards from
  // the most recent one. Cap lookback at 200 so this stays cheap.
  const recent = lastMatchup
    ? await db.pairwiseMatchup.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { skipped: true },
      })
    : [];
  let streak = 0;
  for (const m of recent) {
    if (m.skipped) break;
    streak += 1;
  }
  return { votes, skips, streak };
}
