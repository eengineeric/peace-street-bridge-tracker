import { AdminPanel } from "@/components/admin-panel";
import { getReports } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const reports = await getReports(100);
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-12"><a href="/" className="text-sm font-bold text-sky-300">← Public tracker</a><h1 className="mt-5 text-4xl font-black">Admin review</h1><p className="mb-8 mt-3 text-slate-300">Confirm only when the linked source clearly reports a truck striking the Peace Street railroad bridge.</p><AdminPanel reports={reports} /></main>;
}
