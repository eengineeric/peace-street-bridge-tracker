import { BridgeIncident } from "@/lib/types";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-200">{value}</dd></div>;
}

export function ReportList({ incidents }: { incidents: BridgeIncident[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-2xl font-bold">Incident history</h2>
      <p className="mt-2 text-sm text-slate-400">One counted incident per Raleigh calendar day. News and Reddit posts from the same day are grouped as supporting sources.</p>
      {incidents.length === 0 ? (
        <p className="mt-4 text-slate-400">No incidents have been automatically verified.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {incidents.map((incident) => (
            <article key={incident.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-sm font-semibold text-sky-300">
                {new Date(incident.incident_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" })}
              </p>
              <h3 className="mt-1 text-lg font-bold">{incident.title}</h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Location" value={incident.location} />
                <Field label="Direction" value={incident.travel_direction} />
                <Field label="Truck type" value={incident.truck_type} />
                <Field label="Damage" value={incident.damage_summary} />
                <Field label="Injuries" value={incident.injury_summary} />
              </dl>
              <p className="mt-4 text-sm text-slate-400">{incident.source_count ?? 0} source{incident.source_count === 1 ? "" : "s"} grouped into this incident.</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {incident.sources?.map((source) => (
                  <a key={source.id} className="text-sm font-semibold text-sky-300 hover:text-sky-200" href={source.source_url} target="_blank" rel="noreferrer">
                    {source.source_name}{source.source_kind === "reddit" ? " (Reddit)" : ""} ↗
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
