import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/auth";
import { getReports } from "@/lib/reports";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json({ reports: await getReports(200) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load reports." }, { status: 500 });
  }
}
