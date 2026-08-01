import Link from "next/link";
import { AdminPanel } from "@/components/admin-panel";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <Link href="/" className="text-sm font-bold text-sky-600 hover:text-sky-700">← Back to tracker</Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">Scanner status</h1>
        <p className="mt-3 max-w-4xl text-lg leading-7 text-slate-500">The tracker updates automatically. This page shows extraction and deduplication diagnostics; no human confirmation is required.</p>
        <div className="mt-8"><AdminPanel /></div>
      </div>
    </main>
  );
}
