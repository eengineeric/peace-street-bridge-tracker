import Link from "next/link";
import { AdminPanel } from "@/components/admin-panel";

export default function AdminPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-12">
      <Link href="/" className="text-sm font-bold text-sky-300 hover:text-sky-200">← Back to tracker</Link>
      <h1 className="mt-6 text-4xl font-black tracking-tight">Scanner status</h1>
      <p className="mt-3 text-slate-400">The tracker updates automatically. This page shows extraction and deduplication diagnostics; no human confirmation is required.</p>
      <div className="mt-8"><AdminPanel /></div>
    </main>
  );
}
