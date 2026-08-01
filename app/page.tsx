import Image from "next/image";
import Link from "next/link";
import { ReportList } from "@/components/report-list";
import { NotificationButton } from "@/components/notification-button";
import { getIncidents, getMilestones, getOfficialStats } from "@/lib/reports";
import { isSupabaseConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

function localDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function daysSince(iso?: string) {
  if (!iso) return "—";
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function HeaderNav() {
  const links = [
    ["Home", "#top", "⌂"],
    ["Incidents", "#incidents", "▣"],
    ["Stats", "#stats", "▥"],
    ["Gallery", "#gallery", "▧"],
    ["About", "#history", "ⓘ"],
  ] as const;

  return (
    <nav aria-label="Main navigation" className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
      {links.map(([label, href, icon]) => (
        <a
          key={label}
          href={href}
          className="rounded-lg px-2.5 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 hover:text-amber-300 sm:px-3 sm:text-sm"
        >
          <span aria-hidden="true" className="mr-1.5 text-amber-400">{icon}</span>
          {label}
        </a>
      ))}
      <Link
        href="/admin"
        className="rounded-lg border border-sky-400/60 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-400/20 sm:text-sm"
      >
        <span aria-hidden="true" className="mr-1.5">🔒</span>
        Admin access
      </Link>
    </nav>
  );
}

export default async function HomePage() {
  const [incidents, officialStats, milestones] = await Promise.all([
    getIncidents(1000),
    getOfficialStats(),
    getMilestones(),
  ]);
  const year = new Date().getFullYear();
  const thisYear = incidents.filter((i) => localDate(i.incident_at).startsWith(String(year))).length;
  const latest = incidents[0];
  const earliest = incidents[incidents.length - 1];
  const galleryItems = incidents
    .map((incident) => ({
      incident,
      image: incident.image_url || incident.sources?.find((source) => source.image_url)?.image_url,
    }))
    .filter((item): item is typeof item & { image: string } => Boolean(item.image))
    .slice(0, 8);

  let allTimeCount = incidents.length;
  const stat = officialStats[0];
  let adjusted = false;
  if (stat) {
    const before = incidents.filter((i) => localDate(i.incident_at) < stat.window_start).length;
    const inside = incidents.filter((i) => {
      const d = localDate(i.incident_at);
      return d >= stat.window_start && d <= stat.window_end;
    }).length;
    const after = incidents.filter((i) => localDate(i.incident_at) > stat.window_end).length;
    const reconciled = before + Math.max(inside, stat.crash_count) + after;
    if (reconciled > allTimeCount) adjusted = true;
    allTimeCount = Math.max(allTimeCount, reconciled);
  }

  return (
    <main id="top" className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <Image
                  src="/clearance-sign.svg"
                  alt="12 foot 4 inch clearance sign"
                  width={76}
                  height={76}
                  className="h-14 w-14 shrink-0 sm:h-[72px] sm:w-[72px]"
                  priority
                />
                <div className="min-w-0">
                  <p className="truncate text-lg font-black tracking-wide sm:text-2xl">PEACE STREET BRIDGE TRACKER</p>
                  <p className="text-xs font-black uppercase tracking-[.17em] text-amber-400 sm:text-sm">Raleigh, North Carolina</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
              <HeaderNav />
              <NotificationButton />
            </div>
          </div>
        </div>
      </header>

      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
            <Image
              src="/peace-street-can-opener-hero.png"
              alt="Illustration of Raleigh's Peace Street railroad bridge with 12 foot 4 inch clearance and an opened sardine can beneath the bridge"
              width={1339}
              height={705}
              priority
              className="h-auto w-full object-cover"
            />
            <a
              href="#incidents"
              aria-label="View all documented incidents"
              className="absolute bottom-[3.5%] left-[2.3%] h-[10%] w-[29%] rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-300/80"
            />
          </div>

          <section id="stats" className="scroll-mt-32 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Days since last strike"
                value={String(daysSince(latest?.incident_at))}
                detail={latest ? new Date(latest.incident_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) : "No incident loaded"}
              />
              <Metric label={`Strikes in ${year}`} value={String(thisYear)} detail="Individually documented events" />
              <Metric
                label="All-time incidents"
                value={String(allTimeCount)}
                detail={adjusted && stat ? `Reconciled with RPD's ${stat.crash_count}-crash lower bound for ${stat.window_start}–${stat.window_end}` : "Best-supported public record"}
              />
              <Metric
                label="Earliest documented strike found"
                value={earliest ? new Date(earliest.incident_at).getFullYear().toString() : "—"}
                detail="The current bridge was built in 1954"
              />
            </div>
          </section>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-7 text-slate-950 sm:px-6">
        {!isSupabaseConfigured && (
          <div className="rounded-2xl bg-amber-100 p-4 text-amber-900">Demo mode: connect Supabase to load live and historical data.</div>
        )}

        <section id="gallery" className="scroll-mt-32 rounded-3xl bg-white p-5 shadow-xl sm:p-7">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Photo gallery</p>
              <h2 className="text-2xl font-black sm:text-3xl">Documented incident photos</h2>
              <p className="mt-1 text-sm text-slate-600">Photos are shown only when an archived image is associated with a documented incident.</p>
            </div>
            <a href="#incidents" className="text-sm font-bold text-sky-700 hover:text-sky-900">View incident details ↓</a>
          </div>
          {galleryItems.length ? (
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {galleryItems.map(({ incident, image }) => (
                <a key={incident.id} href={`#incident-${incident.id}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  <div className="aspect-[4/3] bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.03]" style={{ backgroundImage: `url(${image})` }} />
                  <div className="p-3">
                    <p className="text-xs font-black text-amber-700">{new Date(incident.incident_at).toLocaleDateString("en-US", { timeZone: "America/New_York", dateStyle: "medium" })}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-800">{incident.title}</p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-100 p-5 text-sm text-slate-600">No archived incident photos are loaded yet.</p>
          )}
        </section>

        <section id="history" className="grid scroll-mt-32 gap-5 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
            <p className="text-xs font-black uppercase tracking-[.18em] text-amber-400">About the bridge</p>
            <h2 className="mt-2 text-3xl font-black">Built in 1954</h2>
            <p className="mt-3 leading-7 text-slate-300">Public WRAL reporting identifies the current Peace Street railroad bridge as a 1954 structure with 12 ft 4 in clearance. The tracker starts its historical coverage at construction and distinguishes individually documented strikes from official aggregate crash counts.</p>
            <p className="mt-4 text-sm text-slate-400">Historical gaps are shown honestly: an aggregate police count can raise the all-time minimum without inventing dates or photos for incidents that are not individually documented.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-black">Bridge history milestones</h2>
            <div className="mt-4 space-y-4">
              {milestones.map((m) => (
                <div key={m.id} className="border-l-4 border-amber-400 pl-4">
                  <p className="text-sm font-black text-amber-700">{m.milestone_date}</p>
                  <h3 className="font-black">{m.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{m.details}</p>
                  {m.source_url && <a href={m.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-bold text-sky-700">{m.source_name || "Source"} ↗</a>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <ReportList incidents={[...incidents].reverse()} />

        <section className="rounded-3xl bg-slate-900 p-6 text-sm leading-6 text-slate-300"><strong className="text-white">Historical coverage note.</strong> The tracker searches and seeds individually supportable records going back toward the bridge&apos;s 1954 construction. It does not claim a complete lifetime police ledger where source records are unavailable. Current scanning continues to monitor news and Reddit and can add multiple distinct strikes on the same day.</section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-lg">
      <p className="text-xs font-black uppercase tracking-[.14em] text-slate-300">{label}</p>
      <p className="mt-2 text-4xl font-black text-amber-400">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}
