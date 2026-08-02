"use client";

import { useEffect, useState } from "react";
import { BridgeReport, ScanResult } from "@/lib/types";

type OpsHealth = {
  latestRuns: Array<any>;
  lastSuccess: any | null;
  recentErrors: Array<any>;
  feedback: Array<any>;
};

export function AdminPanel() {
  const [secret, setSecret] = useState("");
  const [reports, setReports] = useState<BridgeReport[]>([]);
  const [health, setHealth] = useState<OpsHealth | null>(null);
  const [message, setMessage] = useState("Enter your admin secret to view scanner diagnostics.");
  const [busy, setBusy] = useState(false);
  const [rpdCsv, setRpdCsv] = useState("");
  const [rpdFileName, setRpdFileName] = useState("RPD export.csv");
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergeSource, setMergeSource] = useState("");
  const [splitReportId, setSplitReportId] = useState("");
  const [splitIncidentAt, setSplitIncidentAt] = useState("");

  async function loadHealth(currentSecret = secret) {
    const response = await fetch("/api/admin/health", { headers: { "x-admin-secret": currentSecret } });
    const data = (await response.json()) as OpsHealth & { error?: string };
    if (response.ok) setHealth(data);
    else setMessage(data.error ?? "Unable to load scanner health.");
  }

  async function loadReports(currentSecret = secret) {
    setBusy(true);
    const [response] = await Promise.all([
      fetch("/api/admin/reports", { headers: { "x-admin-secret": currentSecret } }),
      loadHealth(currentSecret),
    ]);
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

  async function downloadBackup() {
    setBusy(true);
    const response = await fetch("/api/admin/backup", { headers: { "x-admin-secret": secret } });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setBusy(false);
      return setMessage(data.error ?? "Backup failed.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peace-street-bridge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setBusy(false);
    setMessage("Database backup downloaded. Keep it before each beta/public release.");
    void loadHealth();
  }

  async function importRpdRecords() {
    if (!rpdCsv.trim()) return setMessage("Choose an RPD CSV file first.");
    setBusy(true);
    const response = await fetch("/api/admin/rpd-import", {
      method: "POST",
      headers: { "x-admin-secret": secret, "Content-Type": "application/json" },
      body: JSON.stringify({ csv: rpdCsv, sourceFile: rpdFileName }),
    });
    const data = (await response.json()) as {
      imported?: number; duplicates?: number; linked?: number; created?: number; skipped?: number; errors?: string[]; error?: string;
    };
    setBusy(false);
    if (!response.ok) return setMessage(data.error ?? "RPD import failed.");
    setMessage(`RPD import complete: ${data.imported ?? 0} imported, ${data.created ?? 0} new incidents, ${data.linked ?? 0} linked, ${data.duplicates ?? 0} duplicates, ${data.skipped ?? 0} skipped.`);
    await loadReports();
  }

  async function chooseRpdFile(file?: File) {
    if (!file) return;
    setRpdFileName(file.name);
    setRpdCsv(await file.text());
    setMessage(`Loaded ${file.name}. Click Import RPD records when ready.`);
  }

  async function runScan() {
    setBusy(true);
    const response = await fetch("/api/admin/scan", { method: "POST", headers: { "x-admin-secret": secret } });
    const data = (await response.json()) as ScanResult & { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(data.error ?? "Scan failed.");
    setMessage(`Scan complete: ${data.newIncidents} new incident(s), ${data.duplicates} duplicate article(s), ${data.skipped} skipped, ${data.notificationsSent} notification(s).`);
    await loadReports();
  }

  async function incidentAction(action: "merge" | "split") {
    setBusy(true);
    const response = await fetch("/api/admin/incidents", {
      method: "POST",
      headers: { "x-admin-secret": secret, "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "merge"
          ? { action, targetIncidentId: mergeTarget.trim(), sourceIncidentId: mergeSource.trim() }
          : { action, reportId: splitReportId.trim(), incidentAt: splitIncidentAt ? new Date(splitIncidentAt).toISOString() : undefined },
      ),
    });
    const data = (await response.json()) as { error?: string; new_incident_id?: string; target_incident_id?: string; moved_reports?: number };
    setBusy(false);
    if (!response.ok) return setMessage(data.error ?? "Incident operation failed.");
    setMessage(action === "merge"
      ? `Incidents merged. ${data.moved_reports ?? 0} source report(s) moved.`
      : `Report split into new incident ${data.new_incident_id}.`);
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

  const lastSuccess = health?.lastSuccess?.completed_at ? new Date(health.lastSuccess.completed_at).toLocaleString("en-US", { timeZone: "America/New_York" }) : "No successful scan recorded yet";
  const lastRun = health?.latestRuns?.[0];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <label className="block text-sm font-semibold" htmlFor="secret">Admin secret</label>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row">
          <input id="secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 caret-slate-950" />
          <button disabled={busy || !secret} onClick={saveAndLoad} className="rounded-xl bg-sky-500 px-5 py-3 font-black text-slate-950 disabled:opacity-50">Load diagnostics</button>
          <button disabled={busy || !secret} onClick={runScan} className="rounded-xl border-2 border-sky-600 bg-white px-5 py-3 font-black text-sky-800 hover:bg-sky-50 disabled:opacity-50">Run scan now</button>
          <button disabled={busy || !secret} onClick={sendTestNotification} className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white hover:bg-emerald-700 disabled:opacity-50">Send test notification</button>
          <button disabled={busy || !secret} onClick={downloadBackup} className="rounded-xl bg-slate-900 px-5 py-3 font-black text-white hover:bg-slate-800 disabled:opacity-50">Download backup</button>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-600">{busy ? "Working…" : message}</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
          <p className="text-xs font-black uppercase tracking-[.16em] text-sky-700">Scanner health</p>
          <p className="mt-3 text-lg font-black">{lastRun?.status === "failed" ? "Needs attention" : lastRun?.status === "success" ? "Healthy" : "No run yet"}</p>
          <p className="mt-2 text-sm text-slate-600">Last successful scan: {lastSuccess}</p>
          {lastRun ? <p className="mt-1 text-sm text-slate-600">Latest attempt: {lastRun.status} · {new Date(lastRun.started_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</p> : null}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
          <p className="text-xs font-black uppercase tracking-[.16em] text-rose-700">Recent errors</p>
          <p className="mt-3 text-3xl font-black">{health?.recentErrors?.length ?? 0}</p>
          <p className="mt-1 text-sm text-slate-600">Most recent server/scanner errors retained for beta diagnostics.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
          <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Beta feedback</p>
          <p className="mt-3 text-3xl font-black">{health?.feedback?.filter((f: any) => f.status === "new").length ?? 0}</p>
          <p className="mt-1 text-sm text-slate-600">New tester reports awaiting review.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <p className="text-xs font-black uppercase tracking-[.16em] text-violet-700">Incident correction tools</p>
        <h2 className="mt-2 text-2xl font-black">Merge or split scanner records</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Use IDs shown on the source-record cards below. Merge when two incident IDs are the same physical strike. Split when one source report belongs to a different physical strike.</p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <h3 className="font-black">Merge incidents</h3>
            <input value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} placeholder="Target incident ID (keep)" className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-3" />
            <input value={mergeSource} onChange={(e) => setMergeSource(e.target.value)} placeholder="Source incident ID (remove)" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" />
            <button disabled={busy || !secret || !mergeTarget || !mergeSource} onClick={() => incidentAction("merge")} className="mt-3 rounded-xl bg-violet-700 px-4 py-3 font-bold text-white disabled:opacity-50">Merge incidents</button>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <h3 className="font-black">Split a source into a new incident</h3>
            <input value={splitReportId} onChange={(e) => setSplitReportId(e.target.value)} placeholder="Source report ID" className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-3" />
            <label className="mt-3 block text-xs font-bold text-slate-600">Optional corrected strike time</label>
            <input type="datetime-local" value={splitIncidentAt} onChange={(e) => setSplitIncidentAt(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3" />
            <button disabled={busy || !secret || !splitReportId} onClick={() => incidentAction("split")} className="mt-3 rounded-xl bg-violet-700 px-4 py-3 font-bold text-white disabled:opacity-50">Split report</button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <p className="text-xs font-black uppercase tracking-[.16em] text-sky-700">Raleigh Police historical records</p>
        <h2 className="mt-2 text-2xl font-black">Import official crash-record CSV</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Upload the electronic index returned by Raleigh Police. Timed records auto-link only within 30 minutes; unique report numbers remain primary evidence.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input type="file" accept=".csv,text/csv" disabled={busy || !secret} onChange={(e) => void chooseRpdFile(e.target.files?.[0])} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:font-bold file:text-white" />
          <button disabled={busy || !secret || !rpdCsv.trim()} onClick={importRpdRecords} className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50">Import RPD records</button>
        </div>
      </section>

      {health?.feedback?.length ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
          <h2 className="text-2xl font-black">Recent beta feedback</h2>
          <div className="mt-4 space-y-3">
            {health.feedback.slice(0, 10).map((item: any) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap gap-2 text-xs font-bold uppercase text-slate-500"><span>{item.category}</span><span>·</span><span>{item.status}</span><span>·</span><span>{new Date(item.created_at).toLocaleString()}</span></div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{item.message}</p>
                {item.contact ? <p className="mt-2 text-xs text-slate-500">Contact: {item.contact}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {health?.recentErrors?.length ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-lg">
          <h2 className="text-2xl font-black text-rose-950">Recent errors</h2>
          <div className="mt-4 space-y-3">
            {health.recentErrors.slice(0, 8).map((item: any) => (
              <div key={item.id} className="rounded-2xl bg-white p-4">
                <p className="text-xs font-black uppercase text-rose-700">{item.area} · {item.severity}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{item.message}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        {reports.map((report) => (
          <article key={report.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-emerald-800">{report.status}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">{report.source_kind || "source"}</span>
              <span className="text-sm text-slate-500">{report.detected_incident_at ? new Date(report.detected_incident_at).toLocaleString("en-US", { timeZone: "America/New_York" }) : "No incident time extracted"}</span>
            </div>
            <h2 className="mt-3 text-lg font-bold">{report.title}</h2>
            <p className="mt-2 break-all text-xs text-slate-500">Report ID: {report.id}</p>
            <p className="mt-1 break-all text-xs text-slate-500">Incident ID: {report.incident_id ?? "none"}</p>
            <p className="mt-2 text-sm text-slate-500">Method: {report.extraction_method ?? "none"} · Confidence: {report.confidence ? `${Math.round(report.confidence * 100)}%` : "n/a"}</p>
            {report.notes && <p className="mt-2 text-sm text-amber-700">{report.notes}</p>}
            <a href={report.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-sky-700">Open source ↗</a>
          </article>
        ))}
      </section>
    </div>
  );
}
