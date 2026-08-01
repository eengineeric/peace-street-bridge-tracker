import { BridgeIncident } from "@/lib/types";

export function StatusCard({ incidents }: { incidents: BridgeIncident[] }) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const hitToday = incidents.some((incident) =>
    new Date(incident.incident_at).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) === today,
  );
  const latest = incidents[0];

  return (
    <section className={`rounded-3xl border p-7 ${hitToday ? "border-red-400/40 bg-red-500/10" : "border-emerald-400/30 bg-emerald-500/10"}`}>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Today&apos;s status</p>
      <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
        {hitToday ? "Yes — a strike was detected" : "No detected strike today"}
      </h2>
      <p className="mt-4 max-w-2xl text-slate-300">
        {latest
          ? `Most recent incident: ${new Date(latest.incident_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" })}.`
          : "No automatically verified incidents are in the shared database yet."}
      </p>
    </section>
  );
}
