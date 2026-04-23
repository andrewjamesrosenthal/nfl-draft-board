import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const { id: userId } = await getOrCreateUser();
  const items = await db.watchlistEntry.findMany({
    where: { userId },
    include: { player: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}

const schema = z.object({ playerId: z.number().int() });

export async function POST(req: Request) {
  const { id: userId } = await getOrCreateUser();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad" }, { status: 400 });
  const entry = await db.watchlistEntry.upsert({
    where: { userId_playerId: { userId, playerId: parsed.data.playerId } },
    create: { userId, playerId: parsed.data.playerId },
    update: {},
  });
  return NextResponse.json({ entry });
}

export async function DELETE(req: Request) {
  const { id: userId } = await getOrCreateUser();
  const url = new URL(req.url);
  const playerId = Number(url.searchParams.get("playerId") ?? "0");
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });
  await db.watchlistEntry.deleteMany({ where: { userId, playerId } });
  return NextResponse.json({ ok: true });
}
