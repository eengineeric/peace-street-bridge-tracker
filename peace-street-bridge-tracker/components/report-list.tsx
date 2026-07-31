import type { BridgeReport } from "@/lib/types";

export function ReportList({ reports }: { reports: BridgeReport[] }) {
  if (!reports.length) {
    return <div className="rounded-2xl border border-dashed border-white/20 p-8 text-slate-400">No reports yet. Once Supabase is configured, the daily scan will begin building history.</div>;
  }
  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <article key={report.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${report.status === "confirmed" ? "bg-red-400 text-red-950" : report.status === "candidate" ? "bg-amber-300 text-amber-950" : "bg-slate-600 text-white"}`}>{report.status}</span>
            <span className="text-sm text-slate-400">{new Date(report.published_at || report.discovered_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
          <h3 className="mt-3 text-lg font-bold">{report.title}</h3>
          <p className="mt-1 text-sm text-slate-400">{report.source_name || "News source"}</p>
          <a className="mt-3 inline-block font-semibold text-sky-300 hover:text-sky-200" href={report.source_url} target="_blank" rel="noreferrer">View source ↗</a>
        </article>
      ))}
    </div>
  );
}
