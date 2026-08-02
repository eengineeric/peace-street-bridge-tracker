import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/auth";
import { scanNews } from "@/lib/news";
import { runTrackedScan, logAppError } from "@/lib/ops";

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json(await runTrackedScan("manual", scanNews));
  } catch (error) {
    await logAppError("admin.scan", error, request.nextUrl.pathname);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Scan failed." }, { status: 500 });
  }
}
