import { NextRequest } from "next/server";

export function isAdminAuthorized(request: NextRequest) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return false;

  const supplied = request.headers.get("x-admin-secret") ?? "";
  return supplied.length > 0 && supplied === expected;
}

export function isCronAuthorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${expected}`;
}
