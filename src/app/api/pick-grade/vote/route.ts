import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";
import { eloUpdatePick, PICK_GRADE_UNLOCK } from "@/lib/pick-grade";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // overallPick numbers used as stable IDs (not player IDs)
  winnerId: z.number().int().optional(),
  loserId:  z.number().int().optional(),
  leftId:   z.number().int(),
  rightId:  z.number().int(),
  skipped:  z.boolean().default(false),
  draftYear: z.number().int().default(2026),
});

export async function POST(req: Request) {
  if (new Date() < PICK_GRADE_UNLOCK) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }

  const { id: userId } = await getOrCreateUser();
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { winnerId, loserId, leftId, rightId, skipped, draftYear } = parsed.data;

  // Resolve overallPick → playerId for grade storage.
  // PickGrade still keyed by playerId; for unlinked picks we skip grade updates.
  const [winnerPick, loserPick, leftPick, rightPick] = await Promise.all([
    winnerId ? db.draftOrderPick.findUnique({ where: { draftYear_overallPick: { draftYear, overallPick: winnerId } } }) : null,
    loserId  ? db.draftOrderPick.findUnique({ where: { draftYear_overallPick: { draftYear, overallPick: loserId  } } }) : null,
    db.draftOrderPick.findUnique({ where: { draftYear_overallPick: { draftYear, overallPick: leftId  } } }),
    db.draftOrderPick.findUnique({ where: { draftYear_overallPick: { draftYear, overallPick: rightId } } }),
  ]);

  // Record matchup using playerId if available, otherwise overallPick as synthetic ID.
  const leftRecordId  = leftPick?.playerId  ?? leftId;
  const rightRecordId = rightPick?.playerId ?? rightId;
  const winnerRecordId = winnerId ? (winnerPick?.playerId ?? winnerId) : null;

  await db.pickGradeMatchup.create({
    data: {
      userId,
      leftId:   leftRecordId,
      rightId:  rightRecordId,
      winnerId: skipped ? null : winnerRecordId,
      skipped,
      draftYear,
    },
  });

  if (!skipped && winnerPick?.playerId && loserPick?.playerId) {
    const [winnerGrade, loserGrade] = await Promise.all([
      ensureGrade(userId, winnerPick.playerId, draftYear),
      ensureGrade(userId, loserPick.playerId,  draftYear),
    ]);

    const { winnerDelta, loserDelta } = eloUpdatePick(
      winnerGrade.rating, loserGrade.rating,
      winnerGrade.comparisons, loserGrade.comparisons,
    );

    await Promise.all([
      db.pickGrade.update({
        where: { id: winnerGrade.id },
        data: {
          rating: winnerGrade.rating + winnerDelta,
          sigma:  winnerGrade.sigma * 0.99,
          comparisons: { increment: 1 },
          wins:        { increment: 1 },
        },
      }),
      db.pickGrade.update({
        where: { id: loserGrade.id },
        data: {
          rating: Math.max(1000, loserGrade.rating + loserDelta),
          sigma:  loserGrade.sigma * 0.99,
          comparisons: { increment: 1 },
          losses:      { increment: 1 },
        },
      }),
    ]);

    // Community grades.
    const [cw, cl] = await Promise.all([
      ensureCommunityGrade(winnerPick.playerId, draftYear),
      ensureCommunityGrade(loserPick.playerId,  draftYear),
    ]);
    const { winnerDelta: cwDelta, loserDelta: clDelta } = eloUpdatePick(
      cw.rating, cl.rating, cw.comparisons, cl.comparisons,
    );
    await Promise.all([
      db.communityPickGrade.update({ where: { id: cw.id }, data: { rating: cw.rating + cwDelta, comparisons: { increment: 1 } } }),
      db.communityPickGrade.update({ where: { id: cl.id }, data: { rating: Math.max(1000, cl.rating + clDelta), comparisons: { increment: 1 } } }),
    ]);
  }

  return NextResponse.json({ ok: true });
}

async function ensureGrade(userId: string, playerId: number, draftYear: number) {
  const ex = await db.pickGrade.findUnique({ where: { userId_playerId: { userId, playerId } } });
  if (ex) return ex;
  return db.pickGrade.create({ data: { userId, playerId, draftYear } });
}

async function ensureCommunityGrade(playerId: number, draftYear: number) {
  const ex = await db.communityPickGrade.findUnique({ where: { playerId } });
  if (ex) return ex;
  return db.communityPickGrade.create({ data: { playerId, draftYear } });
}
