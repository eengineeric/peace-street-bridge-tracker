"use client";

import { useState } from "react";
import type { BridgeReport, ReportStatus } from "@/lib/types";

export function AdminPanel({ reports }: { reports: BridgeReport[] }) {
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  async function update(id: string, status: ReportStatus) {
    setMessage("Saving…");
    const response = await fetch("/api/admin/reports", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status, secret }) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error || "Update failed");
    setMessage("Saved. Refreshing…");
    window.location.reload();
  }
  async function scan() {
    setMessage("Scanning news…");
    const response = await fetch(`/api/cron/scan?secret=${encodeURIComponent(secret)}`);
    const result = await response.json();
    setMessage(response.ok ? `Scan complete: ${result.scanned} matches, ${result.inserted} new.` : result.error || "Scan failed");
  }
  return (
    <div>
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <label className="text-sm font-bold">Admin secret</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row"><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-4 py-3 outline-none focus:border-sky-300" placeholder="Paste ADMIN_SECRET" /><button onClick={scan} className="rounded-xl bg-sky-300 px-5 py-3 font-black text-sky-950">Run scan now</button></div>
        {message && <p className="mt-3 text-sm text-slate-300">{message}</p>}
      </div>
      <div className="space-y-3">
        {reports.map((report) => <article key={report.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-bold uppercase text-slate-400">{report.status}</p><h2 className="mt-2 font-bold">{report.title}</h2><a href={report.source_url} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-sky-300">Open source ↗</a><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => update(report.id, "confirmed")} className="rounded-lg bg-red-400 px-3 py-2 text-sm font-bold text-red-950">Confirm strike</button><button onClick={() => update(report.id, "rejected")} className="rounded-lg bg-slate-600 px-3 py-2 text-sm font-bold">Reject</button><button onClick={() => update(report.id, "candidate")} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-bold">Reset</button></div></article>)}
      </div>
    </div>
  );
}
