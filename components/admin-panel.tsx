"use client";

import { useEffect, useState } from "react";
import { BridgeReport, ScanResult } from "@/lib/types";

export function AdminPanel() {
  const [secret, setSecret] = useState("");
  const [reports, setReports] = useState<BridgeReport[]>([]);
  const [message, setMessage] = useState("Enter your admin secret to view scanner diagnostics.");
  const [busy, setBusy] = useState(false);

  async function loadReports(currentSecret = secret) {
    setBusy(true);
    const response = await fetch("/api/admin/reports", { headers: { "x-admin-secret": currentSecret } });
    const data = (await response.json()) as { reports?: BridgeReport[]; error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(data.error ?? "Unable to load diagnostics.");
    setReports(data.reports ?? []);
    setMessage(`Loaded ${data.reports?.length ?? 0} source records.`);
  }

  async function sendTestNotification() {
    setBusy(true);
    const response = await fetch("/api/admin/test-push", { method: "POST", headers: { "x-admin-secret": secret } });
    const data = (await response.json()) as { sent?: number; failed?: number; error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(data.error ?? "Test notification failed.");
    setMessage(`Test notification sent to ${data.sent ?? 0} device(s)${data.failed ? `; ${data.failed} failed` : ""}.`);
  }

  async function runScan() {
    setBusy(true);
    const response = await fetch("/api/admin/scan", { method: "POST", headers: { "x-admin-secret": secret } });
    const data = (await response.json()) as ScanResult & { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(data.error ?? "Scan failed.");
    setMessage(`Scan complete: ${data.newIncidents} new incident(s), ${data.duplicates} duplicate article(s), ${data.skipped} skipped, ${data.notificationsSent} push notification(s) sent.`);
    await loadReports();
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("peace-admin-secret");
    if (saved) setSecret(saved);
  }, []);

  function saveAndLoad() {
    sessionStorage.setItem("peace-admin-secret", secret);
    void loadReports(secret);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <label className="block text-sm font-semibold" htmlFor="secret">Admin secret</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input id="secret" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 caret-slate-950 placeholder:text-slate-400" />
          <button disabled={busy || !secret} onClick={saveAndLoad} className="rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">Load diagnostics</button>
          <button disabled={busy || !secret} onClick={runScan} className="rounded-xl border-2 border-sky-500 bg-white px-5 py-3 font-bold text-sky-700 hover:bg-sky-50 disabled:opacity-50">Run scan now</button>
          <button disabled={busy || !secret} onClick={sendTestNotification} className="rounded-xl border border-emerald-600 bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Send test notification</button>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-600">{busy ? "Working…" : message}</p>
      </section>

      <section className="space-y-4">
        {reports.map((report) => (
          <article key={report.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-emerald-800">{report.status}</span>
              <span className="text-sm text-slate-500">{report.detected_incident_at ? new Date(report.detected_incident_at).toLocaleString("en-US", { timeZone: "America/New_York" }) : "No incident time extracted"}</span>
            </div>
            <h2 className="mt-3 text-lg font-bold">{report.title}</h2>
            <p className="mt-2 text-sm text-slate-500">Method: {report.extraction_method ?? "none"} · Confidence: {report.confidence ? `${Math.round(report.confidence * 100)}%` : "n/a"}</p>
            {report.notes && <p className="mt-2 text-sm text-amber-700">{report.notes}</p>}
            <a href={report.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-sky-700">Open source ↗</a>
          </article>
        ))}
      </section>
    </div>
  );
}
