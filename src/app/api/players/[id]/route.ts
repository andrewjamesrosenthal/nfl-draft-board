import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUserId } from "@/lib/user-session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const userId = await getCurrentUserId();

  const player = await db.player.findUnique({
    where: { id },
    include: {
      reports:  { orderBy: { updatedAt: "desc" } },
      stats:    { orderBy: { season: "desc" } },
      images:   true,
      communityRanking: true,
    },
  });

  if (!player) return NextResponse.json({ error: "not found" }, { status: 404 });

  const personal = userId
    ? await db.userRanking.findUnique({
        where: { userId_playerId_draftYear: { userId, playerId: id, draftYear: player.draftYear } },
      })
    : null;

  const matchups = await db.pairwiseMatchup.findMany({
    where: { OR: [{ leftId: id }, { rightId: id }] },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { left: true, right: true, winner: true },
  });

  return NextResponse.json({ player, personal, matchups });
}
