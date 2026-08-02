import { randomUUID } from "crypto";
import { requireServerConfig } from "@/lib/config";
import { registerAutomaticReport } from "@/lib/reports";
import { sendStrikePush } from "@/lib/push";

export type CommunityStrikeReportRow = {
  id: string;
  reported_incident_at: string;
  description: string;
  reporter_name: string | null;
  reporter_contact: string | null;
  location: string;
  photo_url: string | null;
  photo_path: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  reviewed_at: string | null;
  approved_incident_id: string | null;
  approved_report_id: string | null;
  created_at: string;
  updated_at: string;
};

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
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
  if (!response.ok) throw new Error(`Community report request failed (${response.status}): ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function saveCommunityStrikeReport(input: {
  reportedIncidentAt: string;
  description: string;
  reporterName?: string;
  reporterContact?: string;
  photo?: File | null;
}) {
  const { url, key } = requireServerConfig();
  let photoUrl: string | null = null;
  let photoPath: string | null = null;

  if (input.photo && input.photo.size > 0) {
    if (input.photo.size > 12 * 1024 * 1024) throw new Error("Photo is larger than the 12 MB limit.");

    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
    if (!allowed.has(input.photo.type)) throw new Error("Photo must be JPEG, PNG, WebP, HEIC or HEIF.");

    const extension = (input.photo.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "jpg";
    photoPath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const upload = await fetch(`${url}/storage/v1/object/community-strike-photos/${photoPath}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": input.photo.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: await input.photo.arrayBuffer(),
    });
    if (!upload.ok) throw new Error(`Photo upload failed (${upload.status}): ${await upload.text()}`);
    photoUrl = `${url}/storage/v1/object/public/community-strike-photos/${photoPath}`;
  }

  const [created] = await rest<CommunityStrikeReportRow[]>("community_strike_reports", {
    method: "POST",
    body: JSON.stringify({
      reported_incident_at: input.reportedIncidentAt,
      description: input.description,
      reporter_name: input.reporterName || null,
      reporter_contact: input.reporterContact || null,
      location: "Peace Street railroad bridge near N West St / Capital Blvd, Raleigh, NC",
      photo_url: photoUrl,
      photo_path: photoPath,
      status: "pending",
    }),
  });
  return created;
}

export async function getCommunityStrikeReports() {
  return rest<CommunityStrikeReportRow[]>("community_strike_reports?select=*&order=created_at.desc&limit=100");
}

export async function reviewCommunityStrikeReport(id: string, action: "approve" | "reject", adminNotes?: string) {
  const [row] = await rest<CommunityStrikeReportRow[]>(
    `community_strike_reports?id=eq.${encodeURIComponent(id)}&select=*`,
  );
  if (!row) throw new Error("Community report not found.");

  if (row.status !== "pending") throw new Error(`This report is already ${row.status}.`);

  if (action === "reject") {
    const [updated] = await rest<CommunityStrikeReportRow[]>(`community_strike_reports?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "rejected",
        admin_notes: adminNotes || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
    return { report: updated, createdIncident: false, notificationsSent: 0 };
  }

  const result = await registerAutomaticReport({
    title: "Admin-approved community report: Peace Street bridge truck strike",
    source_url: `https://peace-street-bridge-tracker.vercel.app/#community-report-${row.id}`,
    source_name: "Community submission",
    published_at: row.created_at,
    detected_incident_at: row.reported_incident_at,
    confidence: 0.9,
    extraction_method: "admin-approved-community-report",
    excerpt: row.description,
    source_kind: "community",
    location: row.location,
    travel_direction: null,
    truck_type: null,
    damage_summary: row.description,
    injury_summary: null,
  });

  if (row.photo_url) {
    await rest(`bridge_reports?id=eq.${encodeURIComponent(result.report_id)}`, {
      method: "PATCH",
      body: JSON.stringify({ image_url: row.photo_url }),
    });
    await rest(`bridge_incidents?id=eq.${encodeURIComponent(result.incident_id)}&image_url=is.null`, {
      method: "PATCH",
      body: JSON.stringify({ image_url: row.photo_url }),
    });
  }

  let notificationsSent = 0;
  if (result.created_incident) {
    const push = await sendStrikePush({
      incidentId: result.incident_id,
      incidentAt: row.reported_incident_at,
      title: "Community-reported Peace Street bridge strike",
      truckType: null,
    });
    notificationsSent = push.sent;
  }

  const [updated] = await rest<CommunityStrikeReportRow[]>(`community_strike_reports?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "approved",
      admin_notes: adminNotes || null,
      reviewed_at: new Date().toISOString(),
      approved_incident_id: result.incident_id,
      approved_report_id: result.report_id,
      updated_at: new Date().toISOString(),
    }),
  });

  return { report: updated, createdIncident: result.created_incident, notificationsSent };
}
