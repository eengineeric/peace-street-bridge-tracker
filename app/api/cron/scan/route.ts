import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth";
import { scanNews } from "@/lib/news";
import { runTrackedScan, logAppError } from "@/lib/ops";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json(await runTrackedScan("cron", scanNews));
  } catch (error) {
    await logAppError("cron.scan", error, request.nextUrl.pathname);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Scan failed." }, { status: 500 });
  }
}
