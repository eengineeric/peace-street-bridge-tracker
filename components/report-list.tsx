import { BridgeReport } from "@/lib/types";

export function ReportList({ reports }: { reports: BridgeReport[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-2xl font-bold">Confirmed incident history</h2>
      {reports.length === 0 ? (
        <p className="mt-4 text-slate-400">No confirmed incidents have been added.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {reports.map((report) => (
            <article key={report.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-sm font-semibold text-sky-300">{report.incident_date}</p>
              <h3 className="mt-1 font-bold">{report.title}</h3>
              <p className="mt-2 text-sm text-slate-400">Source: {report.source_name}</p>
              <a className="mt-3 inline-block text-sm font-semibold text-sky-300 hover:text-sky-200" href={report.source_url} target="_blank" rel="noreferrer">
                View source ↗
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
