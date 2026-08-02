import { requireServerConfig } from "@/lib/config";

export type RpdImportResult = {
  total: number;
  imported: number;
  duplicates: number;
  linked: number;
  created: number;
  skipped: number;
  errors: string[];
};

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      field = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function first(row: CsvRow, names: string[]) {
  for (const name of names) {
    const value = row[name];
    if (value?.trim()) return value.trim();
  }
  return "";
}

function normalizeDate(raw: string) {
  if (!raw) return "";
  const direct = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (direct) return `${direct[1]}-${direct[2].padStart(2, "0")}-${direct[3].padStart(2, "0")}`;
  const us = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (us) {
    const year = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${year}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function normalizeTime(raw: string) {
  if (!raw) return "";
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return "";
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = Number(m[3] ?? "0");
  const suffix = m[4]?.toLowerCase();
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59 || second > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

function likelyPeaceStreetBridge(row: CsvRow) {
  const location = first(row, ["location", "address", "street", "crash_location", "roadway", "primary_street"]);
  const narrative = first(row, ["narrative", "description", "crash_description", "remarks", "notes"]);
  const haystack = `${location} ${narrative}`.toLowerCase();
  const peace = haystack.includes("peace");
  const bridge = haystack.includes("bridge") || haystack.includes("overpass") || haystack.includes("railroad") || haystack.includes("railway");
  return peace && bridge;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = requireServerConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase RPD request failed (${response.status}): ${await response.text()}`);
  return (await response.json()) as T;
}

export async function importRpdCsv(csv: string, sourceFile = "RPD export.csv"): Promise<RpdImportResult> {
  const rows = parseCsv(csv);
  const result: RpdImportResult = { total: rows.length, imported: 0, duplicates: 0, linked: 0, created: 0, skipped: 0, errors: [] };

  const [batch] = await request<Array<{ id: string }>>("rpd_data_imports", {
    method: "POST",
    body: JSON.stringify({ source_name: "Raleigh Police Department", source_file: sourceFile, row_count: rows.length }),
  });

  for (const [index, row] of rows.entries()) {
    try {
      if (!likelyPeaceStreetBridge(row)) {
        result.skipped += 1;
        continue;
      }

      const reportNumber = first(row, ["report_number", "report_no", "case_number", "case_no", "incident_number", "crash_number"]);
      const date = normalizeDate(first(row, ["incident_date", "crash_date", "date", "occurred_date", "event_date"]));
      if (!date) {
        result.skipped += 1;
        result.errors.push(`Row ${index + 2}: no usable incident date.`);
        continue;
      }

      const time = normalizeTime(first(row, ["incident_time", "crash_time", "time", "occurred_time", "event_time"]));
      const occurredAt = time ? `${date}T${time}-04:00` : null;
      const timePrecision = time ? "exact" : "day";
      const location = first(row, ["location", "address", "street", "crash_location", "roadway", "primary_street"]) || "Peace Street railroad bridge, Raleigh, NC";
      const vehicleType = first(row, ["vehicle_type", "body_style", "vehicle_body_type", "truck_type", "vehicle_description"]);
      const narrative = first(row, ["narrative", "description", "crash_description", "remarks", "notes"]);
      const contributing = first(row, ["contributing_circumstances", "contributing_factor", "contributing_factors", "cause", "driver_contributing"]);

      const response = await request<{ record_id: string; incident_id: string; duplicate: boolean; created_incident: boolean; match_method: string }>(
        "rpc/register_rpd_crash_record",
        {
          method: "POST",
          body: JSON.stringify({
            p_import_id: batch.id,
            p_report_number: reportNumber || null,
            p_occurred_at: occurredAt,
            p_incident_date: date,
            p_time_precision: timePrecision,
            p_location: location || null,
            p_vehicle_type: vehicleType || null,
            p_narrative: narrative || null,
            p_contributing_circumstances: contributing || null,
            p_source_file: sourceFile,
            p_raw_row: row,
          }),
        },
      );

      if (response.duplicate) result.duplicates += 1;
      else result.imported += 1;
      if (response.created_incident) result.created += 1;
      else if (!response.duplicate) result.linked += 1;
    } catch (error) {
      result.errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  await request(`rpd_data_imports?id=eq.${batch.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      imported_count: result.imported,
      linked_count: result.linked,
      created_count: result.created,
      skipped_count: result.skipped,
      notes: result.errors.slice(0, 20).join("\n") || null,
    }),
  });

  return result;
}
