import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";
import { BADGES, computeProgress } from "@/lib/badges";

export const dynamic = "force-dynamic";

export async function GET() {
  const { id: userId } = await getOrCreateUser();
  const [earned, progress] = await Promise.all([
    db.userBadge.findMany({ where: { userId } }),
    computeProgress(userId),
  ]);
  const earnedKeys = new Set(earned.map((b) => b.key));
  const items = BADGES.map((b) => ({
    key: b.key,
    label: b.label,
    blurb: b.blurb,
    emoji: b.emoji,
    earned: earnedKeys.has(b.key),
    earnedAt: earned.find((e) => e.key === b.key)?.earnedAt ?? null,
  }));
  return NextResponse.json({ items, progress });
}
