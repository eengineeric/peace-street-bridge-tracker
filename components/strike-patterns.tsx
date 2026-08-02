import { BridgeIncident } from "@/lib/types";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function raleighHour(iso: string) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso)).find((item) => item.type === "hour");
  return Number(part?.value ?? 0);
}

function dayIndex(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function BarRows({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3 text-sm">
          <span className="font-bold text-slate-600">{row.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
          <span className="text-right font-black text-slate-900">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function StrikePatterns({ incidents }: { incidents: BridgeIncident[] }) {
  const days = dayNames.map((label) => ({ label, value: 0 }));
  for (const incident of incidents) {
    if (incident.incident_date) days[dayIndex(incident.incident_date)].value += 1;
  }

  const timeBuckets = [
    { label: "12–6 AM", value: 0 },
    { label: "6 AM–Noon", value: 0 },
    { label: "Noon–6 PM", value: 0 },
    { label: "6 PM–Midnight", value: 0 },
  ];

  const precise = incidents.filter((incident) => !["day", "month", "year"].includes(incident.date_precision ?? ""));
  for (const incident of precise) {
    const hour = raleighHour(incident.incident_at);
    if (hour < 6) timeBuckets[0].value += 1;
    else if (hour < 12) timeBuckets[1].value += 1;
    else if (hour < 18) timeBuckets[2].value += 1;
    else timeBuckets[3].value += 1;
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-xl sm:p-7">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Strike patterns</p>
        <h2 className="text-2xl font-black sm:text-3xl">When do trucks hit the bridge?</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
          Day-of-week uses every documented incident with a date. Time-of-day uses only records with sufficiently precise timestamps, so archival placeholder times do not distort the chart.
        </p>
      </div>

      <div className="mt-6 grid gap-7 lg:grid-cols-2">
        <div>
          <h3 className="mb-4 text-lg font-black">Day of week <span className="text-sm font-semibold text-slate-400">({incidents.length} dated strikes)</span></h3>
          <BarRows rows={days} />
        </div>
        <div>
          <h3 className="mb-4 text-lg font-black">Time of day <span className="text-sm font-semibold text-slate-400">({precise.length} precise-time strikes)</span></h3>
          <BarRows rows={timeBuckets} />
        </div>
      </div>
    </section>
  );
}
