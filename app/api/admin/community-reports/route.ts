import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/auth";
import { getCommunityStrikeReports, reviewCommunityStrikeReport } from "@/lib/community-reports";
import { logAppError } from "@/lib/ops";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json({ reports: await getCommunityStrikeReports() });
  } catch (error) {
    await logAppError("community-report.admin-list", error, request.nextUrl.pathname);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load community reports." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = (await request.json()) as { id?: string; action?: "approve" | "reject"; adminNotes?: string };
    if (!body.id || !body.action) return NextResponse.json({ error: "Report ID and action are required." }, { status: 400 });
    return NextResponse.json(await reviewCommunityStrikeReport(body.id, body.action, body.adminNotes));
  } catch (error) {
    await logAppError("community-report.admin-review", error, request.nextUrl.pathname);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review community report." }, { status: 500 });
  }
}
