import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";
import { eloUpdatePick, pickGraderUnlocked } from "@/lib/pick-grade";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  winnerId: z.number().int().optional(),
  loserId: z.number().int().optional(),
  leftId: z.number().int(),
  rightId: z.number().int(),
  skipped: z.boolean().default(false),
  draftYear: z.number().int().default(2026),
});

export async function POST(req: Request) {
  if (!pickGraderUnlocked()) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }

  const { id: userId } = await getOrCreateUser();
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { winnerId, loserId, leftId, rightId, skipped, draftYear } = parsed.data;

  // Record the matchup.
  await db.pickGradeMatchup.create({
    data: { userId, leftId, rightId, winnerId: skipped ? null : winnerId ?? null, skipped, draftYear },
  });

  if (!skipped && winnerId && loserId) {
    // Fetch or create grades for both picks.
    const [winnerGrade, loserGrade] = await Promise.all([
      ensureGrade(userId, winnerId, draftYear),
      ensureGrade(userId, loserId, draftYear),
    ]);

    const { winnerDelta, loserDelta } = eloUpdatePick(
      winnerGrade.rating,
      loserGrade.rating,
      winnerGrade.comparisons,
      loserGrade.comparisons,
    );

    await Promise.all([
      db.pickGrade.update({
        where: { id: winnerGrade.id },
        data: {
          rating: winnerGrade.rating + winnerDelta,
          sigma: winnerGrade.sigma * 0.99,
          comparisons: { increment: 1 },
          wins: { increment: 1 },
        },
      }),
      db.pickGrade.update({
        where: { id: loserGrade.id },
        data: {
          rating: Math.max(1000, loserGrade.rating + loserDelta),
          sigma: loserGrade.sigma * 0.99,
          comparisons: { increment: 1 },
          losses: { increment: 1 },
        },
      }),
    ]);

    // Update community rating.
    const [commWinner, commLoser] = await Promise.all([
      ensureCommunityGrade(winnerId, draftYear),
      ensureCommunityGrade(loserId, draftYear),
    ]);
    const { winnerDelta: cw, loserDelta: cl } = eloUpdatePick(
      commWinner.rating, commLoser.rating, commWinner.comparisons, commLoser.comparisons,
    );
    await Promise.all([
      db.communityPickGrade.update({
        where: { id: commWinner.id },
        data: { rating: commWinner.rating + cw, comparisons: { increment: 1 } },
      }),
      db.communityPickGrade.update({
        where: { id: commLoser.id },
        data: { rating: Math.max(1000, commLoser.rating + cl), comparisons: { increment: 1 } },
      }),
    ]);
  }

  return NextResponse.json({ ok: true });
}

async function ensureGrade(userId: string, playerId: number, draftYear: number) {
  const existing = await db.pickGrade.findUnique({ where: { userId_playerId: { userId, playerId } } });
  if (existing) return existing;
  return db.pickGrade.create({ data: { userId, playerId, draftYear } });
}

async function ensureCommunityGrade(playerId: number, draftYear: number) {
  const existing = await db.communityPickGrade.findUnique({ where: { playerId } });
  if (existing) return existing;
  return db.communityPickGrade.create({ data: { playerId, draftYear } });
}
