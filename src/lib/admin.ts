import { cookies } from "next/headers";

// Admin is gated by a simple cookie that must match ADMIN_TOKEN in env.
// Set via POST /api/admin/login. TODO: replace with real RBAC auth.
export const ADMIN_COOKIE = "draftboard_admin";

export function isAdminAuthorized(): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false; // admin is locked when no token is configured
  const jar = cookies();
  const supplied = jar.get(ADMIN_COOKIE)?.value;
  return !!supplied && supplied === token;
}
