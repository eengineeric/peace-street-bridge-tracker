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

function HeaderNav({ mobile = false }: { mobile?: boolean }) {
  const links = [
    ["Home", "#top", "⌂"],
    ["Incidents", "#incidents", "▱"],
    ["Stats", "#stats", "▥"],
    ["Gallery", "#gallery", "▧"],
    ["About", "#history", "ⓘ"],
  ] as const;

  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Main navigation"}
      className={mobile ? "grid gap-1" : "hidden items-center justify-center gap-1 lg:flex xl:gap-2"}
    >
      {links.map(([label, href, icon], index) => (
        <a
          key={label}
          href={href}
          className={
            mobile
              ? "rounded-lg px-3 py-2.5 text-sm font-bold text-slate-100 hover:bg-white/10 hover:text-amber-300"
              : `rounded-md px-2.5 py-2 text-xs font-bold transition hover:bg-white/10 hover:text-amber-300 xl:px-3 xl:text-sm ${
                  index === 0 ? "border-b-2 border-amber-400 text-white" : "text-slate-200"
                }`
          }
        >
          <span aria-hidden="true" className="mr-1.5 text-amber-400">{icon}</span>
          {label}
        </a>
      ))}
    </nav>
  );
}

function MobileMenu() {
  return (
    <details className="relative lg:hidden">
      <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-sky-400/60 bg-sky-400/5 text-xl text-sky-200 marker:hidden [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true">☰</span>
        <span className="sr-only">Open navigation</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-white/10 bg-[#071124] p-2 shadow-2xl">
        <HeaderNav mobile />
        <Link href="/admin" className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-bold text-sky-200 hover:bg-sky-400/10">
          <span aria-hidden="true" className="mr-1.5">🔒</span>Admin access
        </Link>
      </div>
    </details>
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
    <main id="top" className="min-h-screen bg-[#020817] text-white">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#020817]/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:static lg:bg-[#020817] lg:pt-0">
        <div className="mx-auto max-w-[1400px] px-3 py-3 sm:px-5 sm:py-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(330px,1fr)_auto_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <Image
                src="/clearance-sign.svg"
                alt="12 foot 4 inch clearance sign"
                width={78}
                height={78}
                className="h-14 w-14 shrink-0 sm:h-[68px] sm:w-[68px] xl:h-[76px] xl:w-[76px]"
                priority
              />
              <div className="min-w-0 flex-1">
                <p className="max-w-[16rem] text-[1.05rem] font-black leading-[1.05] tracking-wide text-white sm:max-w-none sm:text-xl lg:text-2xl">
                  PEACE STREET BRIDGE TRACKER
                </p>
                <p className="mt-1 text-[0.66rem] font-black uppercase leading-tight tracking-[.14em] text-amber-400 sm:text-xs lg:text-sm">
                  Raleigh, North Carolina
                </p>
              </div>
            </div>

            <HeaderNav />

            <div className="hidden items-center justify-end gap-2 lg:flex">
              <NotificationButton />
              <Link
                href="/admin"
                className="rounded-xl border border-sky-400/70 bg-sky-400/5 px-4 py-3 text-xs font-bold text-sky-200 transition hover:bg-sky-400/15 xl:text-sm"
              >
                <span aria-hidden="true" className="mr-1.5">🔒</span>
                Admin access
              </Link>
            </div>

            <div className="grid gap-2 lg:hidden">
              <div className="flex items-center justify-end">
                <MobileMenu />
              </div>
              <div className="flex w-full justify-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] px-2 py-1.5">
                <NotificationButton prominent />
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="bg-[#020817]">
        <div className="mx-auto max-w-[1400px] px-4 pb-4 sm:px-5">
          <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-slate-900 shadow-2xl sm:rounded-[26px]">
            <Image
              src="/peace-street-can-opener-hero.png"
              alt="Raleigh's Peace Street railroad bridge with 12 foot 4 inch clearance, an opened sardine can, and an acorn beneath the bridge"
              width={1361}
              height={692}
              priority
              className="h-auto w-full object-cover"
              sizes="(max-width: 640px) 100vw, 1400px"
            />
            <a
              href="#incidents"
              aria-label="View all documented incidents"
              className="absolute bottom-[2%] left-[2%] h-[18%] w-[44%] rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-300/80 sm:bottom-[4%] sm:left-[6.5%] sm:h-[10%] sm:w-[27%]"
            />
          </div>

          <section id="stats" className="scroll-mt-24 pt-3">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
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

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-7 text-slate-950 sm:px-5">
        {!isSupabaseConfigured && (
          <div className="rounded-2xl bg-amber-100 p-4 text-amber-900">Demo mode: connect Supabase to load live and historical data.</div>
        )}

        <section id="gallery" className="scroll-mt-28 rounded-3xl bg-white p-5 shadow-xl sm:p-7">
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

        <section id="history" className="grid scroll-mt-28 gap-5 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
            <p className="text-xs font-black uppercase tracking-[.18em] text-amber-400">About the bridge</p>
            <h2 className="mt-2 text-3xl font-black">Built in 1954</h2>
            <p className="mt-3 leading-7 text-slate-300">Public reporting identifies the current Peace Street railroad bridge as a 1954 structure with 12 ft 4 in clearance. The tracker starts its historical coverage at construction and distinguishes individually documented strikes from official aggregate crash counts.</p>
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
    <div className="min-w-0 rounded-2xl border border-white/15 bg-[#0b1529] p-3.5 shadow-lg sm:p-5">
      <p className="text-[0.68rem] font-black uppercase leading-4 tracking-[.1em] text-slate-200 sm:text-xs sm:tracking-[.14em]">{label}</p>
      <p className="mt-1.5 text-3xl font-black text-amber-400 sm:mt-2 sm:text-4xl">{value}</p>
      <p className="mt-1 text-[0.68rem] leading-4 text-slate-300 sm:text-xs sm:leading-5">{detail}</p>
    </div>
  );
}
