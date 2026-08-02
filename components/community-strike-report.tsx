"use client";

import { useState } from "react";

export function CommunityStrikeReport() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setStatus("");
    const data = new FormData(form);
    const when = String(data.get("incidentWhen") ?? "");
    if (when) data.set("incidentWhen", new Date(when).toISOString());

    const response = await fetch("/api/community-report", { method: "POST", body: data });
    const result = (await response.json()) as { ok?: boolean; error?: string };
    setBusy(false);

    if (!response.ok) return setStatus(result.error ?? "Unable to submit this report.");
    form.reset();
    setStatus("Report received. It will not appear publicly until an admin reviews and approves it.");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 shadow-lg hover:bg-amber-300"
      >
        📷 Report a strike / upload a photo
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/75 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Report a truck strike">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 text-slate-950 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Community report</p>
                <h2 className="mt-1 text-2xl font-black">Report a new truck strike</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Submissions and photos stay pending until an admin verifies and approves them.</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-xl font-bold text-slate-500 hover:bg-slate-100" aria-label="Close">×</button>
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(event.currentTarget);
              }}
            >
              <div>
                <label htmlFor="incidentWhen" className="block text-sm font-bold">When did it happen?</label>
                <input id="incidentWhen" name="incidentWhen" type="datetime-local" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3" />
              </div>

              <div>
                <label htmlFor="strikeDescription" className="block text-sm font-bold">What did you see?</label>
                <textarea id="strikeDescription" name="description" minLength={10} maxLength={3000} required rows={5} placeholder="Truck type, direction, damage, whether it was stuck, etc." className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3" />
              </div>

              <div>
                <label htmlFor="strikePhoto" className="block text-sm font-bold">Incident photo (optional)</label>
                <input id="strikePhoto" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm" />
                <p className="mt-1 text-xs text-slate-500">Maximum 12 MB. Only upload a photo you have permission to share.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="reporterName" className="block text-sm font-bold">Name (optional)</label>
                  <input id="reporterName" name="reporterName" maxLength={120} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3" />
                </div>
                <div>
                  <label htmlFor="reporterContact" className="block text-sm font-bold">Email/phone (optional)</label>
                  <input id="reporterContact" name="reporterContact" maxLength={200} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3" />
                </div>
              </div>

              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

              {status ? <p className="rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">{status}</p> : null}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 px-4 py-3 font-bold">Close</button>
                <button disabled={busy} type="submit" className="rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{busy ? "Submitting…" : "Submit for admin review"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
