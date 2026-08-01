import Image from "next/image";
import Link from "next/link";
import { ReportList } from "@/components/report-list";
import { NotificationButton } from "@/components/notification-button";
import { getIncidents, getMilestones, getOfficialStats } from "@/lib/reports";
import { isSupabaseConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

function localDate(iso: string) { return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" }); }
function daysSince(iso?: string) { if (!iso) return "—"; return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)); }

export default async function HomePage() {
  const [incidents, officialStats, milestones] = await Promise.all([getIncidents(1000), getOfficialStats(), getMilestones()]);
  const year = new Date().getFullYear();
  const thisYear = incidents.filter(i => localDate(i.incident_at).startsWith(String(year))).length;
  const latest = incidents[0];
  const earliest = incidents[incidents.length - 1];

  let allTimeCount = incidents.length;
  const stat = officialStats[0];
  let adjusted = false;
  if (stat) {
    const before = incidents.filter(i => localDate(i.incident_at) < stat.window_start).length;
    const inside = incidents.filter(i => { const d = localDate(i.incident_at); return d >= stat.window_start && d <= stat.window_end; }).length;
    const after = incidents.filter(i => localDate(i.incident_at) > stat.window_end).length;
    const reconciled = before + Math.max(inside, stat.crash_count) + after;
    if (reconciled > allTimeCount) adjusted = true;
    allTimeCount = Math.max(allTimeCount, reconciled);
  }

  return <main className="min-h-screen bg-slate-100 text-slate-950">
    <nav className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div><p className="font-black tracking-wide">PEACE STREET BRIDGE TRACKER</p><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-400">Raleigh, North Carolina</p></div>
        <div className="hidden gap-6 text-sm font-bold md:flex"><a href="#incidents">Incidents</a><a href="#history">History</a><Link href="/admin">Scanner</Link></div>
        <NotificationButton />
      </div>
    </nav>

    <section className="bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1.65fr_.75fr]">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
          <Image
            src="/peace-street-can-opener-hero.png"
            alt="Stylized Peace Street Bridge Tracker hero showing the 12 foot 4 inch clearance and an opened sardine can beneath the bridge"
            width={1536}
            height={1024}
            priority
            className="h-auto w-full object-cover"
          />
          <a
            href="#incidents"
            aria-label="View all documented incidents"
            className="absolute bottom-[7%] left-[7%] h-[8%] w-[33%] rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-300/80"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Metric label="Days since last strike" value={String(daysSince(latest?.incident_at))} detail={latest ? new Date(latest.incident_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) : "No incident loaded"} />
          <Metric label={`Strikes in ${year}`} value={String(thisYear)} detail="Individually documented events" />
          <Metric label="All-time incidents" value={String(allTimeCount)} detail={adjusted && stat ? `Reconciled with RPD's ${stat.crash_count}-crash lower bound for ${stat.window_start}–${stat.window_end}` : "Best-supported public record"} />
          <Metric label="Earliest documented strike found" value={earliest ? new Date(earliest.incident_at).getFullYear().toString() : "—"} detail="The bridge itself was built in 1954" />
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6">
      {!isSupabaseConfigured && <div className="rounded-2xl bg-amber-100 p-4 text-amber-900">Demo mode: connect Supabase to load live and historical data.</div>}
      <section id="history" className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.18em] text-amber-400">About the bridge</p>
          <h2 className="mt-2 text-3xl font-black">Built in 1954</h2>
          <p className="mt-3 leading-7 text-slate-300">Public WRAL reporting identifies the current Peace Street railroad bridge as a 1954 structure with 12 ft 4 in clearance. The tracker starts its historical coverage at construction and distinguishes individually documented strikes from official aggregate crash counts.</p>
          <p className="mt-4 text-sm text-slate-400">Historical gaps are shown honestly: an aggregate police count can raise the all-time minimum without inventing dates or photos for incidents that are not individually documented.</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-xl">
          <h2 className="text-2xl font-black">Bridge history milestones</h2>
          <div className="mt-4 space-y-4">
            {milestones.map(m => <div key={m.id} className="border-l-4 border-amber-400 pl-4"><p className="text-sm font-black text-amber-700">{m.milestone_date}</p><h3 className="font-black">{m.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{m.details}</p>{m.source_url && <a href={m.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-bold text-sky-700">{m.source_name || "Source"} ↗</a>}</div>)}
          </div>
        </div>
      </section>
      <ReportList incidents={[...incidents].reverse()} />
      <section className="rounded-3xl bg-slate-900 p-6 text-sm leading-6 text-slate-300"><strong className="text-white">Historical coverage note.</strong> Version 2.5 searches and seeds individually supportable records going back toward the bridge&apos;s 1954 construction. It does not claim a complete lifetime police ledger where source records are unavailable. Current scanning continues to monitor news and Reddit and can add multiple distinct strikes on the same day.</section>
    </div>
  </main>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-white/15 bg-white/5 p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-300">{label}</p><p className="mt-2 text-4xl font-black text-amber-400">{value}</p><p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p></div>;
}
