import { requireServerConfig } from "@/lib/config";
import { ScanResult } from "@/lib/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
  if (!response.ok) throw new Error(`Ops request failed (${response.status}): ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function logAppError(area: string, error: unknown, requestPath?: string, severity = "error") {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const details = error instanceof Error ? error.stack?.slice(0, 6000) ?? null : null;
    await request("app_error_log", {
      method: "POST",
      body: JSON.stringify({
        area,
        message: message.slice(0, 1200),
        details,
        request_path: requestPath ?? null,
        severity,
      }),
    });
  } catch {
    // Error logging must never cause a second failure.
  }
}

export async function runTrackedScan(triggerKind: "manual" | "cron", scanner: () => Promise<ScanResult>) {
  const [run] = await request<Array<{ id: string }>>("scan_runs", {
    method: "POST",
    body: JSON.stringify({ trigger_kind: triggerKind, status: "running" }),
  });

  try {
    const result = await scanner();
    await request(`scan_runs?id=eq.${run.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        completed_at: new Date().toISOString(),
        status: "success",
        found: result.found,
        relevant: result.relevant,
        accepted: result.accepted,
        new_incidents: result.newIncidents,
        duplicates: result.duplicates,
        skipped: result.skipped,
        notifications_sent: result.notificationsSent,
        news_items: result.newsItems,
        reddit_items: result.redditItems,
        error_count: result.errors.length,
        error_summary: result.errors.slice(0, 20).join("\n") || null,
      }),
    });
    if (result.errors.length) await logAppError("scanner.partial", result.errors.join("\n"), triggerKind, "warning");
    return result;
  } catch (error) {
    await request(`scan_runs?id=eq.${run.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        completed_at: new Date().toISOString(),
        status: "failed",
        error_count: 1,
        error_summary: error instanceof Error ? error.message.slice(0, 4000) : String(error).slice(0, 4000),
      }),
    }).catch(() => undefined);
    await logAppError("scanner.failed", error, triggerKind, "critical");
    throw error;
  }
}

export async function getOpsHealth() {
  const [latestRuns, latestSuccess, errors, feedback] = await Promise.all([
    request<any[]>("scan_runs?select=*&order=started_at.desc&limit=5"),
    request<any[]>("scan_runs?select=*&status=eq.success&order=completed_at.desc&limit=1"),
    request<any[]>("app_error_log?select=*&order=created_at.desc&limit=10"),
    request<any[]>("beta_feedback?select=*&order=created_at.desc&limit=25"),
  ]);

  return {
    latestRuns,
    lastSuccess: latestSuccess[0] ?? null,
    recentErrors: errors,
    feedback,
  };
}

export async function exportDatabaseSnapshot() {
  const tables = [
    "bridge_incidents",
    "bridge_reports",
    "bridge_official_stats",
    "bridge_history_milestones",
    "push_subscriptions",
    "rpd_crash_records",
    "rpd_data_imports",
    "scan_runs",
    "beta_feedback",
    "app_error_log",
  ];

  const snapshot: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const table of tables) {
    try {
      const rows = await request<unknown[]>(`${table}?select=*`);
      snapshot[table] = rows;
      counts[table] = rows.length;
    } catch {
      snapshot[table] = [];
      counts[table] = 0;
    }
  }

  await request("backup_exports", {
    method: "POST",
    body: JSON.stringify({
      table_counts: counts,
      notes: "Admin JSON backup export",
    }),
  }).catch(() => undefined);

  return {
    exportedAt: new Date().toISOString(),
    app: "Peace Street Bridge Tracker",
    version: "2.7-beta",
    counts,
    data: snapshot,
  };
}

export async function submitBetaFeedback(input: {
  category: string;
  message: string;
  pageUrl?: string;
  userAgent?: string;
  contact?: string;
}) {
  await request("beta_feedback", {
    method: "POST",
    body: JSON.stringify({
      category: input.category.slice(0, 40),
      message: input.message.slice(0, 4000),
      page_url: input.pageUrl?.slice(0, 1000) || null,
      user_agent: input.userAgent?.slice(0, 1000) || null,
      contact: input.contact?.slice(0, 300) || null,
    }),
  });
}

export async function mergeIncidents(targetIncidentId: string, sourceIncidentId: string) {
  return request("rpc/admin_merge_bridge_incidents", {
    method: "POST",
    body: JSON.stringify({
      p_target_incident_id: targetIncidentId,
      p_source_incident_id: sourceIncidentId,
    }),
  });
}

export async function splitReport(reportId: string, incidentAt?: string) {
  return request("rpc/admin_split_bridge_report", {
    method: "POST",
    body: JSON.stringify({
      p_report_id: reportId,
      p_incident_at: incidentAt || null,
    }),
  });
}
