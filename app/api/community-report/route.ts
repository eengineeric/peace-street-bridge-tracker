import { NextRequest, NextResponse } from "next/server";
import { saveCommunityStrikeReport } from "@/lib/community-reports";
import { logAppError } from "@/lib/ops";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();

    if (String(form.get("website") ?? "")) return NextResponse.json({ ok: true });

    const reportedIncidentAt = String(form.get("incidentWhen") ?? "");
    const description = String(form.get("description") ?? "").trim();
    const reporterName = String(form.get("reporterName") ?? "").trim();
    const reporterContact = String(form.get("reporterContact") ?? "").trim();
    const file = form.get("photo");
    const photo = file instanceof File && file.size > 0 ? file : null;

    if (!reportedIncidentAt || Number.isNaN(new Date(reportedIncidentAt).getTime())) {
      return NextResponse.json({ error: "Please provide a valid incident date and time." }, { status: 400 });
    }
    if (description.length < 10) {
      return NextResponse.json({ error: "Please provide at least 10 characters describing the strike." }, { status: 400 });
    }

    await saveCommunityStrikeReport({
      reportedIncidentAt,
      description: description.slice(0, 3000),
      reporterName: reporterName.slice(0, 120),
      reporterContact: reporterContact.slice(0, 200),
      photo,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await logAppError("community-report.submit", error, request.nextUrl.pathname);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit report." }, { status: 500 });
  }
}
