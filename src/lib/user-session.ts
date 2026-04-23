import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import db from "./db";

const COOKIE_NAME = "draftboard_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

// Cookie writes are only legal in Route Handlers and Server Actions in Next 14.
// Callers in those contexts use getOrCreateUser(). Server Components use
// readUserId() which never writes, and gracefully returns null for fresh
// visitors so the page can render an empty-state CTA.
export async function getOrCreateUser(): Promise<{ id: string; isNew: boolean }> {
  const jar = cookies();
  const existing = jar.get(COOKIE_NAME)?.value;
  if (existing) {
    const user = await db.user.findUnique({ where: { id: existing } });
    if (user) {
      await db.user.update({ where: { id: user.id }, data: { lastSeen: new Date() } });
      return { id: user.id, isNew: false };
    }
  }
  const id = randomUUID();
  await db.user.create({
    data: { id, isAnonymous: true },
  });
  jar.set({
    name: COOKIE_NAME,
    value: id,
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return { id, isNew: true };
}

export async function getCurrentUserId(): Promise<string | null> {
  const jar = cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}

/** Read-only user lookup for Server Components. Returns null if no session. */
export async function readUser() {
  const id = await getCurrentUserId();
  if (!id) return null;
  return db.user.findUnique({ where: { id } });
}
