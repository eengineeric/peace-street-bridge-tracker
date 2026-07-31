export type ReportStatus = "candidate" | "confirmed" | "rejected";

export type BridgeReport = {
  id: string;
  title: string;
  source_url: string;
  source_name: string;
  published_at: string;
  incident_date: string;
  status: ReportStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
