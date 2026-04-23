import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  cookies().delete(ADMIN_COOKIE);
  const url = new URL("/admin", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
