import { BridgeIncident, BridgeReport } from "@/lib/types";
import { isSupabaseConfigured, requireServerConfig } from "@/lib/config";

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

export async function getIncidents(limit = 100): Promise<BridgeIncident[]> {
  if (!isSupabaseConfigured) return [];

  const incidents = await supabaseRequest<BridgeIncident[]>(
    `bridge_incidents?select=*&order=incident_at.desc&limit=${limit}`,
  );
  if (incidents.length === 0) return [];

  const ids = incidents.map((incident) => incident.id).join(",");
  const reports = await supabaseRequest<BridgeReport[]>(
    `bridge_reports?select=*&incident_id=in.(${ids})&order=published_at.asc`,
  );

  return incidents.map((incident) => {
    const sources = reports.filter((report) => report.incident_id === incident.id);
    return { ...incident, sources, source_count: sources.length };
  });
}

export async function getReports(limit = 100): Promise<BridgeReport[]> {
  if (!isSupabaseConfigured) return [];
  return supabaseRequest<BridgeReport[]>(
    `bridge_reports?select=*&order=published_at.desc&limit=${limit}`,
  );
}

export type RegisterReportInput = {
  title: string;
  source_url: string;
  source_name: string;
  published_at: string;
  detected_incident_at: string;
  confidence: number;
  extraction_method: string;
  excerpt: string;
  source_kind: string;
  location: string | null;
  travel_direction: string | null;
  truck_type: string | null;
  damage_summary: string | null;
  injury_summary: string | null;
};

export type RegisterReportResult = {
  report_id: string;
  incident_id: string;
  created_incident: boolean;
  duplicate_source: boolean;
};

export async function registerAutomaticReport(
  input: RegisterReportInput,
): Promise<RegisterReportResult> {
  const { url, key } = requireServerConfig();
  const response = await fetch(`${url}/rest/v1/rpc/register_bridge_report`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_title: input.title,
      p_source_url: input.source_url,
      p_source_name: input.source_name,
      p_published_at: input.published_at,
      p_detected_incident_at: input.detected_incident_at,
      p_confidence: input.confidence,
      p_extraction_method: input.extraction_method,
      p_excerpt: input.excerpt,
      p_source_kind: input.source_kind,
      p_location: input.location,
      p_travel_direction: input.travel_direction,
      p_truck_type: input.truck_type,
      p_damage_summary: input.damage_summary,
      p_injury_summary: input.injury_summary,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Automatic registration failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as RegisterReportResult;
}

export async function recordSkippedReport(input: {
  title: string;
  source_url: string;
  source_name: string;
  published_at: string;
  reason: string;
  excerpt?: string;
}) {
  if (!isSupabaseConfigured) return;
  const existing = await supabaseRequest<BridgeReport[]>(
    `bridge_reports?select=id&source_url=eq.${encodeURIComponent(input.source_url)}&limit=1`,
  );
  if (existing.length > 0) return;

  await supabaseRequest<BridgeReport[]>("bridge_reports", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      source_url: input.source_url,
      source_name: input.source_name,
      published_at: input.published_at,
      incident_date: input.published_at.slice(0, 10),
      status: "skipped",
      notes: input.reason,
      excerpt: input.excerpt?.slice(0, 800) ?? null,
    }),
  });
}
