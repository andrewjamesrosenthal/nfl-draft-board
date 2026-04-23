import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const year = url.searchParams.get("year");
    const position = url.searchParams.get("position");

    const players = await db.player.findMany({
      where: {
        // SQLite doesn't support mode: "insensitive" — use contains without it
        // (SQLite LIKE is case-insensitive for ASCII by default).
        ...(q
          ? {
              OR: [
                { fullName: { contains: q } },
                { school: { contains: q } },
              ],
            }
          : {}),
        ...(year ? { draftYear: Number(year) } : {}),
        ...(position ? { position: position as any } : {}),
      },
      orderBy: [{ draftYear: "desc" }, { lastName: "asc" }],
      take: 50,
    });
    return NextResponse.json({ items: players });
  } catch (err) {
    console.error("[/api/players] error:", err);
    return NextResponse.json({ items: [], error: String(err) }, { status: 500 });
  }
}
