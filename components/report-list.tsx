import { BridgeIncident } from "@/lib/types";

function fmtDate(iso: string, precision?: string) {
  const d = new Date(iso);
  if (precision === "year") return String(d.getFullYear());
  if (precision === "month") return d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", year: "numeric" });
  return d.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: precision === "exact" || precision === "day" ? "short" : undefined });
}

export function ReportList({ incidents }: { incidents: BridgeIncident[] }) {
  return (
    <section id="incidents" className="rounded-3xl bg-white p-5 text-slate-950 shadow-xl sm:p-7">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Lifetime archive</p>
          <h2 className="text-2xl font-black sm:text-3xl">Documented truck strikes</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Every individually documented strike we can support with a public source. Older records can be incomplete; uncertain dates are labeled rather than invented.</p>
        </div>
        <p className="text-sm font-bold text-slate-500">{incidents.length} individually documented events</p>
      </div>

      {incidents.length === 0 ? <p className="py-8 text-slate-500">No incidents are loaded yet.</p> : (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {incidents.map((incident) => {
            const image = incident.image_url || incident.sources?.find((s) => s.image_url)?.image_url;
            return (
              <article key={incident.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="relative h-48 bg-slate-200 bg-cover bg-center" style={{ backgroundImage: `url(${image || "/bridge.svg"})` }}>
                  {!image && <div className="absolute inset-x-0 bottom-0 bg-slate-950/75 px-3 py-2 text-xs font-semibold text-white">No archived incident photo located</div>}
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-amber-700">{fmtDate(incident.incident_at, incident.date_precision)}</p>
                    {incident.date_precision && !["exact", "day"].includes(incident.date_precision) && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold uppercase text-amber-800">{incident.date_precision} date</span>}
                    {incident.evidence_level && <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-bold uppercase text-slate-600">{incident.evidence_level}</span>}
                  </div>
                  <h3 className="mt-2 text-xl font-black">{incident.title}</h3>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="font-bold text-slate-500">Truck</dt><dd>{incident.truck_type || "Not reported"}</dd></div>
                    <div><dt className="font-bold text-slate-500">Direction</dt><dd>{incident.travel_direction || "Not reported"}</dd></div>
                    <div><dt className="font-bold text-slate-500">Damage</dt><dd>{incident.damage_summary || "See source"}</dd></div>
                    <div><dt className="font-bold text-slate-500">Injuries</dt><dd>{incident.injury_summary || "Not reported"}</dd></div>
                  </dl>
                  {(incident.historical_notes || incident.match_notes) && <p className="mt-4 text-sm leading-6 text-slate-600">{incident.historical_notes || incident.match_notes}</p>}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {incident.sources?.map((source) => <a key={source.id} href={source.source_url} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">{source.source_name}{source.source_kind === "reddit" ? " · Reddit" : ""} ↗</a>)}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
