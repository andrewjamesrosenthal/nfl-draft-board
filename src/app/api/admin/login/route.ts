import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(8) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "missing token" }, { status: 400 });
  }
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "admin is disabled (no ADMIN_TOKEN)" }, { status: 503 });
  }
  if (parsed.data.token !== expected) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
  const jar = cookies();
  jar.set({
    name: ADMIN_COOKIE,
    value: expected,
    maxAge: 60 * 60 * 12, // 12 hours
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return NextResponse.json({ ok: true });
}
