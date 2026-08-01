import Link from "next/link";
import { ReportList } from "@/components/report-list";
import { StatusCard } from "@/components/status-card";
import { getIncidents } from "@/lib/reports";
import { isSupabaseConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const incidents = await getIncidents(100);
  const thisYear = new Date().getFullYear();
  const yearCount = incidents.filter((incident) =>
    new Date(incident.incident_at).toLocaleDateString("en-CA", { timeZone: "America/New_York" }).startsWith(String(thisYear)),
  ).length;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:py-16">
      <header className="flex flex-col gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-300">Raleigh, North Carolina</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">Peace Street Bridge Tracker</h1>
          <p className="mt-3 max-w-2xl text-slate-400">An automatically updated dashboard for truck strikes at the railroad bridge over Peace Street.</p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-sky-300 hover:text-sky-200">Scanner status →</Link>
      </header>

      <div className="mt-8 space-y-6">
        {!isSupabaseConfigured && (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            Demo mode: connect Supabase using the README instructions to enable shared data.
          </div>
        )}
        <StatusCard incidents={incidents} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-400">Incidents this year</p><p className="mt-2 text-3xl font-black">{yearCount}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-400">All-time incidents</p><p className="mt-2 text-3xl font-black">{incidents.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-400">Deduplication</p><p className="mt-2 text-lg font-bold">30-minute window</p></div>
        </div>
        <ReportList incidents={incidents} />
      </div>
    </main>
  );
}
