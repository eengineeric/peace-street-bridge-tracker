import { ReportList } from "@/components/report-list";
import { StatusCard } from "@/components/status-card";
import { getReports } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function Home() {
  const reports = await getReports();
  const confirmed = reports.filter((r) => r.status === "confirmed");

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-12 sm:px-8">
      <header className="mb-10">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-sky-300">Raleigh, North Carolina</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Peace Street Bridge Tracker</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">An automated news monitor with human verification. A news match is shown as a candidate until an administrator confirms that a truck actually struck the bridge.</p>
      </header>

      <StatusCard reports={reports} />

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-sky-300 p-5 text-sky-950"><p className="text-sm font-bold uppercase">Confirmed strikes</p><p className="mt-2 text-4xl font-black">{confirmed.length}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm font-bold uppercase text-slate-400">Awaiting review</p><p className="mt-2 text-4xl font-black">{reports.filter((r) => r.status === "candidate").length}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm font-bold uppercase text-slate-400">Last scan</p><p className="mt-2 text-lg font-bold">Daily at 9 a.m. ET*</p><p className="mt-1 text-xs text-slate-500">*Vercel Hobby timing may vary.</p></div>
      </section>

      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-widest text-sky-300">History</p><h2 className="mt-1 text-3xl font-black">Latest reports</h2></div><a href="/admin" className="text-sm font-semibold text-slate-400 hover:text-white">Admin review</a></div>
        <ReportList reports={reports} />
      </section>

      <footer className="mt-16 border-t border-white/10 py-8 text-sm leading-6 text-slate-500">This is an unofficial community project. Automated matches can be wrong; only entries marked “confirmed” affect the daily strike status.</footer>
    </main>
  );
}
