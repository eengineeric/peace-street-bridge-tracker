import type { BridgeReport } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase";

const demoReports: BridgeReport[] = [];

export async function getReports(limit = 30): Promise<BridgeReport[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return demoReports;

  const { data, error } = await supabase
    .from("bridge_reports")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("discovered_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Unable to load reports", error);
    return [];
  }
  return (data ?? []) as BridgeReport[];
}
