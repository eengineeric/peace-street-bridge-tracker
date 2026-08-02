import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/auth";
import { exportDatabaseSnapshot, logAppError } from "@/lib/ops";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const snapshot = await exportDatabaseSnapshot();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="peace-street-bridge-backup-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    await logAppError("admin.backup", error, request.nextUrl.pathname);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Backup failed." }, { status: 500 });
  }
}
