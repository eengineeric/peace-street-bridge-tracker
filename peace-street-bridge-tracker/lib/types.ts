export type ReportStatus = "candidate" | "confirmed" | "rejected";

export interface BridgeReport {
  id: string;
  title: string;
  source_url: string;
  source_name: string | null;
  published_at: string | null;
  discovered_at: string;
  status: ReportStatus;
  notes: string | null;
}
