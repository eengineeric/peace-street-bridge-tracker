import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/auth";
import { mergeIncidents, splitReport, logAppError } from "@/lib/ops";

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = (await request.json()) as {
      action?: "merge" | "split";
      targetIncidentId?: string;
      sourceIncidentId?: string;
      reportId?: string;
      incidentAt?: string;
    };

    if (body.action === "merge") {
      if (!body.targetIncidentId || !body.sourceIncidentId) {
        return NextResponse.json({ error: "Target and source incident IDs are required." }, { status: 400 });
      }
      return NextResponse.json(await mergeIncidents(body.targetIncidentId, body.sourceIncidentId));
    }

    if (body.action === "split") {
      if (!body.reportId) return NextResponse.json({ error: "Report ID is required." }, { status: 400 });
      return NextResponse.json(await splitReport(body.reportId, body.incidentAt));
    }

    return NextResponse.json({ error: "Unknown incident action." }, { status: 400 });
  } catch (error) {
    await logAppError("admin.incidents", error, request.nextUrl.pathname);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Incident operation failed." }, { status: 500 });
  }
}
