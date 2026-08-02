import { BridgeIncident, BridgeReport, BridgeMilestone, OfficialBridgeStat } from "@/lib/types";
import { isSupabaseConfigured, requireServerConfig } from "@/lib/config";


function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function looksLikeArticleImage(url: string) {
  const lower = url.toLowerCase();
  return (
    /^https?:\/\//i.test(url) &&
    !/\b(logo|icon|avatar|favicon|sprite|placeholder|default[-_]?image|weather|tracking|pixel)\b/i.test(lower) &&
    !lower.endsWith(".svg")
  );
}

async function extractSourceImageUrl(sourceUrl: string): Promise<string | null> {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "PeaceStreetBridgeTracker/2.6.2 (+historical incident archive)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) return null;

    const html = (await response.text()).slice(0, 1_500_000);
    const patterns = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      const candidate = match?.[1] ? decodeHtmlAttribute(match[1].trim()) : "";
      if (candidate && looksLikeArticleImage(candidate)) return candidate;
    }
  } catch {
    // Photo enrichment is best-effort and should never block incident registration.
  }
  return null;
}

async function attachSourceImage(reportId: string, incidentId: string, sourceUrl: string) {
  const imageUrl = await extractSourceImageUrl(sourceUrl);
  if (!imageUrl) return;

  await supabaseRequest<BridgeReport[]>(`bridge_reports?id=eq.${encodeURIComponent(reportId)}`, {
    method: "PATCH",
    body: JSON.stringify({ image_url: imageUrl }),
  });

  await supabaseRequest<BridgeIncident[]>(
    `bridge_incidents?id=eq.${encodeURIComponent(incidentId)}&image_url=is.null`,
    {
      method: "PATCH",
      body: JSON.stringify({ image_url: imageUrl }),
    },
  );
}

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

export async function getMilestones(): Promise<BridgeMilestone[]> {
  if (!isSupabaseConfigured) return [];
  return supabaseRequest<BridgeMilestone[]>(`bridge_history_milestones?select=*&order=milestone_date.asc`);
}

export async function getOfficialStats(): Promise<OfficialBridgeStat[]> {
  if (!isSupabaseConfigured) return [];
  return supabaseRequest<OfficialBridgeStat[]>(
    `bridge_official_stats?select=*&order=window_end.desc`,
  );
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
  match_reason?: string;
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

  const result = (await response.json()) as RegisterReportResult;

  // Best-effort photo enrichment. This does not affect deduplication or whether
  // an incident is accepted; it only attaches a verified source-page image.
  try {
    await attachSourceImage(result.report_id, result.incident_id, input.source_url);
  } catch {
    // Keep scanner resilient if a publisher blocks image/page requests.
  }

  return result;
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
