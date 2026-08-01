export type ReportStatus = "auto_confirmed" | "duplicate" | "skipped" | "candidate" | "confirmed" | "rejected";

export type BridgeIncident = {
  id: string;
  incident_at: string;
  title: string;
  confidence: number;
  created_at: string;
  updated_at: string;
  source_count?: number;
  sources?: BridgeReport[];
};

export type BridgeReport = {
  id: string;
  incident_id: string | null;
  title: string;
  source_url: string;
  source_name: string;
  published_at: string;
  incident_date: string;
  detected_incident_at: string | null;
  status: ReportStatus;
  confidence: number | null;
  extraction_method: string | null;
  excerpt: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ScanResult = {
  found: number;
  relevant: number;
  accepted: number;
  newIncidents: number;
  duplicates: number;
  skipped: number;
  errors: string[];
};
