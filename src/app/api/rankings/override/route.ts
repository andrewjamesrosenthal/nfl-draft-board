import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  playerId: z.number().int(),
  manualRank: z.number().int().min(1),
  draftYear: z.number().int(),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  const { id: userId } = await getOrCreateUser();
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { playerId, manualRank, draftYear, note } = parsed.data;

  const result = await db.userRankingOverride.upsert({
    where: {
      userId_playerId_draftYear: { userId, playerId, draftYear },
    },
    update: { manualRank, note },
    create: { userId, playerId, draftYear, manualRank, note },
  });
  return NextResponse.json({ override: result });
}

export async function DELETE(req: Request) {
  const { id: userId } = await getOrCreateUser();
  const url = new URL(req.url);
  const playerId = Number(url.searchParams.get("playerId") ?? "0");
  const draftYear = Number(url.searchParams.get("year") ?? "0");
  if (!playerId || !draftYear) {
    return NextResponse.json({ error: "playerId and year required" }, { status: 400 });
  }
  await db.userRankingOverride.deleteMany({
    where: { userId, playerId, draftYear },
  });
  return NextResponse.json({ ok: true });
}
