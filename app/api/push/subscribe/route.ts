import { NextRequest, NextResponse } from "next/server";
import { savePushSubscription } from "@/lib/push";

export async function POST(request: NextRequest) {
  try {
    const subscription = (await request.json()) as PushSubscriptionJSON;
    await savePushSubscription(subscription, request.headers.get("user-agent") ?? undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save subscription." }, { status: 400 });
  }
}
