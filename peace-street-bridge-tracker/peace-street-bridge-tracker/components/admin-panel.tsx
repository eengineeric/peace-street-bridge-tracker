"use client";

import { useEffect, useState } from "react";
import { BridgeReport, ReportStatus } from "@/lib/types";

export function AdminPanel() {
  const [secret, setSecret] = useState("");
  const [reports, setReports] = useState<BridgeReport[]>([]);
  const [message, setMessage] = useState("Enter your admin secret to load reports.");
  const [busy, setBusy] = useState(false);

  async function loadReports(currentSecret = secret) {
    setBusy(true);
    const response = await fetch("/api/admin/reports", { headers: { "x-admin-secret": currentSecret } });
    const data = (await response.json()) as { reports?: BridgeReport[]; error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(data.error ?? "Unable to load reports.");
    setReports(data.reports ?? []);
    setMessage(`Loaded ${data.reports?.length ?? 0} reports.`);
  }

  async function runScan() {
    setBusy(true);
    const response = await fetch("/api/admin/scan", { method: "POST", headers: { "x-admin-secret": secret } });
    const data = (await response.json()) as { inserted?: number; error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(data.error ?? "Scan failed.");
    setMessage(`Scan complete. ${data.inserted ?? 0} candidate(s) added.`);
    await loadReports();
  }

  async function setStatus(id: string, status: ReportStatus) {
    setBusy(true);
    const response = await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ status }),
    });
    const data = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(data.error ?? "Update failed.");
    setMessage(`Report marked ${status}.`);
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
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <label className="block text-sm font-semibold" htmlFor="secret">Admin secret</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input id="secret" type="password" value={secret} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSecret(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3" />
          <button disabled={busy || !secret} onClick={saveAndLoad} className="rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">Load reports</button>
          <button disabled={busy || !secret} onClick={runScan} className="rounded-xl border border-white/15 px-5 py-3 font-bold disabled:opacity-50">Run scan now</button>
        </div>
        <p className="mt-3 text-sm text-slate-400">{busy ? "Working…" : message}</p>
      </section>

      <section className="space-y-4">
        {reports.map((report) => (
          <article key={report.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold uppercase">{report.status}</span><span className="text-sm text-slate-400">{report.incident_date}</span></div>
            <h2 className="mt-3 text-lg font-bold">{report.title}</h2>
            <a href={report.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-sky-300">Open source ↗</a>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => setStatus(report.id, "confirmed")} className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-slate-950">Confirm</button>
              <button disabled={busy} onClick={() => setStatus(report.id, "rejected")} className="rounded-lg bg-red-400 px-3 py-2 text-sm font-bold text-slate-950">Reject</button>
              <button disabled={busy} onClick={() => setStatus(report.id, "candidate")} className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold">Return to candidate</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
