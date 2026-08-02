import { NextRequest, NextResponse } from "next/server";
import { submitBetaFeedback, logAppError } from "@/lib/ops";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      category?: string;
      message?: string;
      pageUrl?: string;
      contact?: string;
      website?: string;
    };

    // Honeypot: silently accept bot submissions without storing them.
    if (body.website) return NextResponse.json({ ok: true });

    const message = body.message?.trim() ?? "";
    if (message.length < 3) return NextResponse.json({ error: "Please enter a little more detail." }, { status: 400 });

    await submitBetaFeedback({
      category: body.category?.trim() || "general",
      message,
      pageUrl: body.pageUrl,
      contact: body.contact,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logAppError("feedback.api", error, request.nextUrl.pathname);
    return NextResponse.json({ error: "Unable to save feedback right now." }, { status: 500 });
  }
}
