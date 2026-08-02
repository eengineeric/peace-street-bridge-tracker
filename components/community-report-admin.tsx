"use client";

import { useEffect, useState } from "react";

type CommunityReport = {
  id: string;
  reported_incident_at: string;
  description: string;
  reporter_name: string | null;
  reporter_contact: string | null;
  photo_url: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  created_at: string;
  approved_incident_id: string | null;
};

export function CommunityReportAdmin({ secret, onMessage }: { secret: string; onMessage: (message: string) => void }) {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    if (!secret) return;
    const response = await fetch("/api/admin/community-reports", { headers: { "x-admin-secret": secret } });
    const data = (await response.json()) as { reports?: CommunityReport[]; error?: string };
    if (!response.ok) return onMessage(data.error ?? "Unable to load community reports.");
    setReports(data.reports ?? []);
  }

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    const response = await fetch("/api/admin/community-reports", {
      method: "POST",
      headers: { "x-admin-secret": secret, "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = (await response.json()) as { error?: string; createdIncident?: boolean; notificationsSent?: number };
    setBusyId(null);
    if (!response.ok) return onMessage(data.error ?? "Unable to review report.");
    onMessage(
      action === "approve"
        ? `Community report approved${data.createdIncident ? " as a new strike" : " and matched to an existing strike"}. ${data.notificationsSent ?? 0} notification(s) sent.`
        : "Community report rejected.",
    );
    await load();
  }

  useEffect(() => {
    void load();
  }, [secret]);

  const pending = reports.filter((report) => report.status === "pending");

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-lg">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Community strike reports</p>
          <h2 className="mt-1 text-2xl font-black">Pending admin approval</h2>
          <p className="mt-1 text-sm text-slate-600">Nothing submitted by a user becomes public or changes the strike count until you approve it here.</p>
        </div>
        <button onClick={() => void load()} disabled={!secret} className="rounded-xl border border-amber-400 bg-white px-4 py-2 font-bold text-amber-900 disabled:opacity-50">Refresh</button>
      </div>

      {pending.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-500">No pending community strike reports.</p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {pending.map((report) => (
            <article key={report.id} className="overflow-hidden rounded-2xl border border-amber-200 bg-white">
              {report.photo_url ? (
                <div className="h-56 bg-slate-200 bg-cover bg-center" style={{ backgroundImage: `url(${report.photo_url})` }} />
              ) : null}
              <div className="p-5">
                <p className="text-sm font-black text-amber-800">{new Date(report.reported_incident_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.description}</p>
                {(report.reporter_name || report.reporter_contact) ? (
                  <p className="mt-3 text-xs text-slate-500">Reporter: {[report.reporter_name, report.reporter_contact].filter(Boolean).join(" · ")}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button disabled={busyId === report.id} onClick={() => void review(report.id, "approve")} className="rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:opacity-50">Approve</button>
                  <button disabled={busyId === report.id} onClick={() => void review(report.id, "reject")} className="rounded-xl bg-rose-600 px-4 py-3 font-black text-white disabled:opacity-50">Reject</button>
                </div>
                <p className="mt-3 break-all text-[11px] text-slate-400">Submission ID: {report.id}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
