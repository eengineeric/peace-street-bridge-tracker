"use client";

import { useState } from "react";

export function BetaFeedback() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (message.trim().length < 3) return setStatus("Please add a little detail.");
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        message,
        contact,
        pageUrl: window.location.href,
        website: "",
      }),
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!response.ok) return setStatus(data.error ?? "Unable to send feedback.");
    setMessage("");
    setContact("");
    setStatus("Thanks — feedback received.");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 rounded-full border border-sky-300/60 bg-[#071124]/95 px-4 py-3 text-sm font-black text-sky-100 shadow-2xl backdrop-blur hover:bg-[#0b1930]"
      >
        Beta · Report a problem
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Beta feedback">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 text-slate-950 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-sky-700">Friends & family beta</p>
                <h2 className="mt-1 text-2xl font-black">Report a problem or suggestion</h2>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-xl font-bold text-slate-500 hover:bg-slate-100" aria-label="Close">×</button>
            </div>

            <label className="mt-5 block text-sm font-bold">Type</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3">
              <option value="bug">Something is broken</option>
              <option value="incident">Incident data looks wrong</option>
              <option value="notification">Strike alert / notification issue</option>
              <option value="design">Design / phone layout</option>
              <option value="idea">Suggestion</option>
              <option value="general">Other</option>
            </select>

            <label className="mt-4 block text-sm font-bold">What happened?</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={4000}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3"
              placeholder="Tell me what you expected and what you saw."
            />

            <label className="mt-4 block text-sm font-bold">Your name/email (optional)</label>
            <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={300} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3" />

            <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            {status ? <p className="mt-3 text-sm font-semibold text-slate-600">{status}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 px-4 py-3 font-bold">Close</button>
              <button disabled={busy} onClick={submit} className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white disabled:opacity-50">
                {busy ? "Sending…" : "Send feedback"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
