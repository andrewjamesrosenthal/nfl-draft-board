import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";

export const dynamic = "force-dynamic";

const claimSchema = z.object({
  handle: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/, "handle must be letters / digits / _ / -"),
  displayName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
});

// POST upgrades the current anonymous user to a named account. We do NOT
// create a new user row; we keep the same ID so all prior rankings, matchups,
// and mock drafts stay attached. Real magic-link verification can be layered
// on top later (NextAuth). Until then, this is the identity claim surface.
export async function POST(req: Request) {
  const { id: userId } = await getOrCreateUser();
  const body = await req.json().catch(() => null);
  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const handleLower = parsed.data.handle.toLowerCase();
  const existing = await db.user.findFirst({
    where: { handle: handleLower, NOT: { id: userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "handle already taken" }, { status: 409 });
  }
  if (parsed.data.email) {
    const emailTaken = await db.user.findFirst({
      where: { email: parsed.data.email, NOT: { id: userId } },
    });
    if (emailTaken) {
      return NextResponse.json({ error: "email already registered" }, { status: 409 });
    }
  }

  const user = await db.user.update({
    where: { id: userId },
    data: {
      handle: handleLower,
      displayName: parsed.data.displayName ?? parsed.data.handle,
      email: parsed.data.email,
      isAnonymous: false,
    },
  });
  return NextResponse.json({ user });
}
