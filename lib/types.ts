export type ReportStatus = "auto_confirmed" | "duplicate" | "skipped" | "candidate" | "confirmed" | "rejected";

export type BridgeIncident = {
  id: string;
  incident_at: string;
  incident_date: string;
  title: string;
  confidence: number;
  location: string | null;
  travel_direction: string | null;
  truck_type: string | null;
  damage_summary: string | null;
  injury_summary: string | null;
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
  source_kind: string;
  published_at: string;
  incident_date: string;
  detected_incident_at: string | null;
  status: ReportStatus;
  confidence: number | null;
  extraction_method: string | null;
  excerpt: string | null;
  location: string | null;
  travel_direction: string | null;
  truck_type: string | null;
  damage_summary: string | null;
  injury_summary: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StructuredIncidentFields = {
  location: string | null;
  travelDirection: string | null;
  truckType: string | null;
  damageSummary: string | null;
  injurySummary: string | null;
};

export type ScanResult = {
  found: number;
  relevant: number;
  accepted: number;
  newIncidents: number;
  duplicates: number;
  skipped: number;
  newsItems: number;
  redditItems: number;
  errors: string[];
};
