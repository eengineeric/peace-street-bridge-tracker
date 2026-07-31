import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ReportStatus } from "@/lib/types";

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { id?: string; status?: ReportStatus; secret?: string; notes?: string };
  if (!process.env.ADMIN_SECRET || body.secret !== process.env.ADMIN_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!body.id || !["candidate", "confirmed", "rejected"].includes(body.status || "")) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { error } = await supabase.from("bridge_reports").update({ status: body.status, notes: body.notes || null, reviewed_at: new Date().toISOString() }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
