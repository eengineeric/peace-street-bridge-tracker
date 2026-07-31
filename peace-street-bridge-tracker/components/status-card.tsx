import type { BridgeReport } from "@/lib/types";

export function StatusCard({ reports }: { reports: BridgeReport[] }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const isToday = (date: string | null) => date && new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(date)) === today;
  const confirmedToday = reports.some((r) => r.status === "confirmed" && isToday(r.published_at || r.discovered_at));
  const candidateToday = reports.some((r) => r.status === "candidate" && isToday(r.published_at || r.discovered_at));

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Today in Raleigh</p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tight sm:text-6xl">{confirmedToday ? "YES" : "NO"}</h2>
          <p className="mt-2 text-lg text-slate-300">Confirmed truck strike today</p>
        </div>
        <div className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${candidateToday ? "bg-amber-300 text-amber-950" : "bg-emerald-300 text-emerald-950"}`}>
          {candidateToday ? "News report awaiting review" : "No unverified report today"}
        </div>
      </div>
    </section>
  );
}
