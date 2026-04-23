import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user-session";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { id } = await getOrCreateUser();
  const user = await db.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          matchups: true,
          rankings: true,
          mocks: true,
          watchlist: true,
        },
      },
    },
  });
  return NextResponse.json({ user });
}
