import { NextRequest, NextResponse } from "next/server";
import { removePushSubscription } from "@/lib/push";

export async function POST(request: NextRequest) {
  try {
    const { endpoint } = (await request.json()) as { endpoint?: string };
    if (endpoint) await removePushSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove subscription." }, { status: 400 });
  }
}
