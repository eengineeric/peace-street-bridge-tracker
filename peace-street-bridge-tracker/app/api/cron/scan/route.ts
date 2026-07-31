import { NextRequest, NextResponse } from "next/server";
import { runScan } from "@/lib/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const adminSecret = process.env.ADMIN_SECRET;
  const supplied = auth?.replace(/^Bearer\s+/i, "") || request.nextUrl.searchParams.get("secret");

  if (!supplied || (supplied !== cronSecret && supplied !== adminSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await runScan()) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Scan failed" }, { status: 500 });
  }
}
