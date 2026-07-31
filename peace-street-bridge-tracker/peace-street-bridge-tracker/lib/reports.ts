import { BridgeReport, ReportStatus } from "@/lib/types";
import { isSupabaseConfigured, requireServerConfig } from "@/lib/config";

const DEMO_REPORTS: BridgeReport[] = [];

async function supabaseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = requireServerConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getReports(limit = 100): Promise<BridgeReport[]> {
  if (!isSupabaseConfigured) return DEMO_REPORTS;
  return supabaseRequest<BridgeReport[]>(
    `bridge_reports?select=*&order=published_at.desc&limit=${limit}`,
  );
}

export async function getConfirmedReports(limit = 100): Promise<BridgeReport[]> {
  if (!isSupabaseConfigured) return [];
  return supabaseRequest<BridgeReport[]>(
    `bridge_reports?select=*&status=eq.confirmed&order=incident_date.desc&limit=${limit}`,
  );
}

export async function insertCandidate(
  input: Pick<BridgeReport, "title" | "source_url" | "source_name" | "published_at" | "incident_date">,
): Promise<BridgeReport | null> {
  if (!isSupabaseConfigured) return null;

  const existing = await supabaseRequest<BridgeReport[]>(
    `bridge_reports?select=*&source_url=eq.${encodeURIComponent(input.source_url)}&limit=1`,
  );
  if (existing.length > 0) return existing[0];

  const rows = await supabaseRequest<BridgeReport[]>("bridge_reports", {
    method: "POST",
    body: JSON.stringify({ ...input, status: "candidate" }),
  });
  return rows[0] ?? null;
}

export async function updateReportStatus(
  id: string,
  status: ReportStatus,
  notes?: string,
): Promise<BridgeReport | null> {
  if (!isSupabaseConfigured) return null;
  const rows = await supabaseRequest<BridgeReport[]>(
    `bridge_reports?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status, notes: notes || null, updated_at: new Date().toISOString() }),
    },
  );
  return rows[0] ?? null;
}
