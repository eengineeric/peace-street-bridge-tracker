import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/auth";
import { updateReportStatus } from "@/lib/reports";
import { ReportStatus } from "@/lib/types";

const allowedStatuses: ReportStatus[] = ["candidate", "confirmed", "rejected"];

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as { status?: ReportStatus; notes?: string };
  if (!body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  try {
    const { id } = context.params;
    const report = await updateReportStatus(id, body.status, body.notes);
    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed." },
      { status: 500 },
    );
  }
}
