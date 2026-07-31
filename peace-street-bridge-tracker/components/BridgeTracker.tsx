"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  FileUp,
  RotateCcw,
  Truck,
} from "lucide-react";
import { exportRecords, loadRecords, saveRecords } from "@/lib/storage";
import type { DailyRecord, StrikeStatus } from "@/lib/types";

const today = () => new Date().toLocaleDateString("en-CA");

const statusCopy: Record<StrikeStatus, { label: string; detail: string; classes: string }> = {
  clear: {
    label: "No strike reported",
    detail: "The bridge appears to have survived another day.",
    classes: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  struck: {
    label: "Bridge struck",
    detail: "A vehicle strike has been recorded for this date.",
    classes: "border-red-200 bg-red-50 text-red-900",
  },
  unknown: {
    label: "Status unknown",
    detail: "No one has logged a status for this date yet.",
    classes: "border-amber-200 bg-amber-50 text-amber-900",
  },
};

function sortRecords(records: DailyRecord[]) {
  return [...records].sort((a, b) => b.date.localeCompare(a.date));
}

export default function BridgeTracker() {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [status, setStatus] = useState<StrikeStatus>("unknown");
  const [time, setTime] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRecords(sortRecords(loadRecords()));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveRecords(records);
  }, [records, hydrated]);

  useEffect(() => {
    const existing = records.find((record) => record.date === selectedDate);
    setStatus(existing?.status ?? "unknown");
    setTime(existing?.time ?? "");
    setVehicle(existing?.vehicle ?? "");
    setNotes(existing?.notes ?? "");
    setSourceUrl(existing?.sourceUrl ?? "");
  }, [selectedDate, records]);

  const todayRecord = records.find((record) => record.date === today());
  const todayStatus = todayRecord?.status ?? "unknown";

  const stats = useMemo(() => {
    const strikes = records.filter((record) => record.status === "struck").length;
    const clearDays = records.filter((record) => record.status === "clear").length;
    const knownDays = strikes + clearDays;
    return { strikes, clearDays, knownDays };
  }, [records]);

  function saveRecord() {
    const record: DailyRecord = {
      date: selectedDate,
      status,
      time: time || undefined,
      vehicle: vehicle.trim() || undefined,
      notes: notes.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    setRecords((current) =>
      sortRecords([record, ...current.filter((item) => item.date !== selectedDate)]),
    );
  }

  function deleteRecord() {
    setRecords((current) => current.filter((record) => record.date !== selectedDate));
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as DailyRecord[];
      if (!Array.isArray(parsed)) throw new Error("Invalid data");
      setRecords(sortRecords(parsed));
    } catch {
      window.alert("That file is not a valid Peace Street Bridge Tracker export.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-card sm:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-orange-300">Raleigh, North Carolina</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Peace Street Bridge Tracker</h1>
            <p className="mt-3 max-w-2xl text-slate-300">A lightweight community log for answering one important question: did a truck hit the bridge today?</p>
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-orange-400 text-slate-950">
            <Truck size={44} strokeWidth={2.4} />
          </div>
        </div>
      </header>

      <section className={`mb-8 rounded-3xl border p-6 shadow-card ${statusCopy[todayStatus].classes}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            {todayStatus === "struck" ? <AlertTriangle size={34} /> : <CheckCircle2 size={34} />}
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">Today · {new Date().toLocaleDateString()}</p>
              <h2 className="mt-1 text-2xl font-black">{statusCopy[todayStatus].label}</h2>
              <p className="mt-1 opacity-80">{statusCopy[todayStatus].detail}</p>
            </div>
          </div>
          <button onClick={() => setSelectedDate(today())} className="rounded-xl bg-white/80 px-4 py-2 text-sm font-bold shadow-sm transition hover:bg-white">Update today</button>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl bg-white p-6 shadow-card sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <CalendarDays className="text-orange-500" />
            <h2 className="text-2xl font-black">Log a day</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              Date
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none ring-orange-400 focus:ring-2" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value as StrikeStatus)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none ring-orange-400 focus:ring-2">
                <option value="unknown">Unknown</option>
                <option value="clear">No strike reported</option>
                <option value="struck">Bridge struck</option>
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Approximate time
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none ring-orange-400 focus:ring-2" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Vehicle
              <input value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="Box truck, moving van…" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none ring-orange-400 focus:ring-2" />
            </label>
          </div>

          <label className="mt-5 block text-sm font-bold text-slate-700">
            Source link
            <input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none ring-orange-400 focus:ring-2" />
          </label>

          <label className="mt-5 block text-sm font-bold text-slate-700">
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Add details, road closures, damage, or witness notes." className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 outline-none ring-orange-400 focus:ring-2" />
          </label>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={saveRecord} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-slate-800">Save record</button>
            <button onClick={deleteRecord} className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50">Delete date</button>
          </div>
        </section>

        <aside className="space-y-8">
          <section className="grid grid-cols-3 gap-3">
            {[{ label: "Logged", value: stats.knownDays }, { label: "Clear", value: stats.clearDays }, { label: "Strikes", value: stats.strikes }].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white p-4 text-center shadow-card">
                <div className="text-3xl font-black">{stat.value}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{stat.label}</div>
              </div>
            ))}
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-card">
            <h2 className="text-xl font-black">Data tools</h2>
            <p className="mt-2 text-sm text-slate-600">Records are stored in this browser. Export a backup or move your data to another device.</p>
            <div className="mt-5 grid gap-3">
              <button onClick={() => exportRecords(records)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-bold hover:bg-slate-50"><Download size={18} /> Export JSON</button>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-bold hover:bg-slate-50"><FileUp size={18} /> Import JSON<input type="file" accept="application/json" onChange={importData} className="hidden" /></label>
              <button onClick={() => { if (window.confirm("Delete every saved record?")) setRecords([]); }} className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 font-bold text-red-700 hover:bg-red-50"><RotateCcw size={18} /> Reset all data</button>
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-8 rounded-3xl bg-white p-6 shadow-card sm:p-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">History</h2>
            <p className="text-sm text-slate-500">Newest entries first</p>
          </div>
        </div>
        {records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No records yet. Log today’s status above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Time</th><th className="px-3 py-3">Vehicle</th><th className="px-3 py-3">Notes</th><th className="px-3 py-3">Source</th></tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.date} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-4 font-bold">{new Date(`${record.date}T12:00:00`).toLocaleDateString()}</td>
                    <td className="px-3 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${record.status === "struck" ? "bg-red-100 text-red-800" : record.status === "clear" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{statusCopy[record.status].label}</span></td>
                    <td className="px-3 py-4 text-slate-600">{record.time || "—"}</td>
                    <td className="px-3 py-4 text-slate-600">{record.vehicle || "—"}</td>
                    <td className="max-w-xs px-3 py-4 text-slate-600">{record.notes || "—"}</td>
                    <td className="px-3 py-4">{record.sourceUrl ? <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline">Open <ExternalLink size={14} /></a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="py-8 text-center text-sm text-slate-500">Unofficial community tracker. Verify incidents through local news or official Raleigh sources.</footer>
    </main>
  );
}
