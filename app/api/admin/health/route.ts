import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/auth";
import { getOpsHealth, logAppError } from "@/lib/ops";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json(await getOpsHealth());
  } catch (error) {
    await logAppError("admin.health", error, request.nextUrl.pathname);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load health." }, { status: 500 });
  }
}
