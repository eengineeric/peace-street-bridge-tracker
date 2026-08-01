import { recordSkippedReport, registerAutomaticReport } from "@/lib/reports";
import { ScanResult, StructuredIncidentFields } from "@/lib/types";

const TIME_ZONE = "America/New_York";
const MIN_CONFIDENCE = 0.82;
const STRIKE_WORDS = /\b(hit|hits|hitting|struck|strike|strikes|crash|crashed|collision|collided|wedged|stuck)\b/i;
const TRUCK_WORDS = /\b(truck|tractor[- ]trailer|semi|box truck|dump truck|vehicle)\b/i;

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function getTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() ?? "";
}

function stripHtml(html: string) {
  return decodeXml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function isRelevant(text: string) {
  return /peace street/i.test(text) && /bridge/i.test(text) && TRUCK_WORDS.test(text) && STRIKE_WORDS.test(text);
}

function localDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: map.weekday,
  };
}

function zonedDateTimeToUtc(year: number, month: number, day: number, hour: number, minute: number) {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(new Date(guess));
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour) % 24,
      Number(map.minute),
    );
    guess += Date.UTC(year, month - 1, day, hour, minute) - represented;
  }
  return new Date(guess);
}

function parseClock(rawHour: string, rawMinute: string | undefined, meridiem: string | undefined) {
  let hour = Number(rawHour);
  const minute = Number(rawMinute ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return null;
  if (meridiem) {
    const lower = meridiem.toLowerCase().replace(/\./g, "");
    if (hour < 1 || hour > 12) return null;
    if (lower === "pm" && hour !== 12) hour += 12;
    if (lower === "am" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return { hour, minute };
}

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11,
  december: 12, dec: 12,
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function recentWeekdayDate(published: Date, weekdayText: string, forcePreviousWeek: boolean) {
  const local = localDateParts(published);
  const base = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const target = WEEKDAYS.findIndex((day) => weekdayText.toLowerCase().startsWith(day));
  if (target < 0) return null;
  let delta = (base.getUTCDay() - target + 7) % 7;
  if (forcePreviousWeek && delta === 0) delta = 7;
  base.setUTCDate(base.getUTCDate() - delta);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() };
}

function relevantSentences(text: string) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length < 700);
  const direct = sentences.filter((sentence) => isRelevant(sentence));
  if (direct.length > 0) return direct;
  return sentences.filter((sentence) => /peace street|bridge|truck|struck|crash/i.test(sentence));
}

type Extraction = { incidentAt: string; confidence: number; method: string; excerpt: string };

function extractIncidentDateTime(text: string, published: Date): Extraction | null {
  const candidates = relevantSentences(text);
  const publishLocal = localDateParts(published);

  for (const sentence of candidates) {
    let match = sentence.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Sept\.?|Oct\.?|Nov\.?|Dec\.?)\s+(\d{1,2})(?:,\s*(\d{4}))?[^.!?]{0,45}?\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*([ap]\.?(?:m)\.?)\b/i);
    if (match) {
      const month = MONTHS[match[1].toLowerCase().replace(".", "")];
      const clock = parseClock(match[4], match[5], match[6]);
      if (month && clock) {
        const year = Number(match[3] ?? publishLocal.year);
        return { incidentAt: zonedDateTimeToUtc(year, month, Number(match[2]), clock.hour, clock.minute).toISOString(), confidence: 0.98, method: "absolute-month-date-time", excerpt: sentence.slice(0, 800) };
      }
    }

    match = sentence.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?[^.!?]{0,35}?\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*([ap]\.?(?:m)\.?)\b/i);
    if (match) {
      const clock = parseClock(match[4], match[5], match[6]);
      if (clock) {
        let year = Number(match[3] ?? publishLocal.year);
        if (year < 100) year += 2000;
        return { incidentAt: zonedDateTimeToUtc(year, Number(match[1]), Number(match[2]), clock.hour, clock.minute).toISOString(), confidence: 0.97, method: "numeric-date-time", excerpt: sentence.slice(0, 800) };
      }
    }

    match = sentence.match(/\b(?:(last)\s+)?(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)[^.!?]{0,45}?\b(?:at|around|about)\s+(\d{1,2})(?::(\d{2}))?\s*([ap]\.?(?:m)\.?)\b/i);
    if (match) {
      const date = recentWeekdayDate(published, match[2], Boolean(match[1]));
      const clock = parseClock(match[3], match[4], match[5]);
      if (date && clock) {
        return { incidentAt: zonedDateTimeToUtc(date.year, date.month, date.day, clock.hour, clock.minute).toISOString(), confidence: 0.9, method: "weekday-time", excerpt: sentence.slice(0, 800) };
      }
    }

    match = sentence.match(/\b(today|yesterday|this morning|this afternoon|this evening|tonight)[^.!?]{0,45}?\b(?:at|around|about)\s+(\d{1,2})(?::(\d{2}))?\s*([ap]\.?(?:m)\.?)\b/i);
    if (match) {
      const clock = parseClock(match[2], match[3], match[4]);
      if (clock) {
        const base = new Date(Date.UTC(publishLocal.year, publishLocal.month - 1, publishLocal.day));
        if (match[1].toLowerCase() === "yesterday") base.setUTCDate(base.getUTCDate() - 1);
        return { incidentAt: zonedDateTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), clock.hour, clock.minute).toISOString(), confidence: 0.86, method: "relative-day-time", excerpt: sentence.slice(0, 800) };
      }
    }
  }

  return null;
}


function extractStructuredFields(text: string): StructuredIncidentFields {
  const normalized = text.replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();
  const location = /(?:peace street (?:railroad )?bridge|bridge (?:over|at|near) peace street|peace and (?:north )?west streets|peace street at mcclure drive)/i.test(normalized)
    ? "Peace Street railroad bridge, Raleigh, NC"
    : "Peace Street bridge, Raleigh, NC";

  const directionMatch = normalized.match(/\b(eastbound|westbound|northbound|southbound)\b/i);
  const truckPatterns = [
    /\btractor[- ]trailer\b/i, /\b18[- ]wheeler\b/i, /\bbox truck\b/i,
    /\bdump truck\b/i, /\bbeer truck\b/i, /\bsemi(?:-truck)?\b/i, /\bmoving truck\b/i, /\blarge truck\b/i, /\btruck\b/i,
  ];
  const truck = truckPatterns.map((pattern) => normalized.match(pattern)?.[0]).find(Boolean) ?? null;

  let damageSummary: string | null = null;
  if (/roof[^.]{0,80}(?:ripped|peeled|torn|sheared|removed)/i.test(normalized) || /(?:ripped|peeled|torn|sheared)[^.]{0,80}roof/i.test(normalized)) {
    damageSummary = "Truck roof was ripped, peeled, torn, or sheared.";
  } else if (/minor damage/i.test(normalized)) {
    damageSummary = "Minor vehicle damage reported.";
  } else if (/no (?:visible )?damage (?:to )?(?:the )?bridge/i.test(normalized)) {
    damageSummary = "No visible bridge damage reported.";
  } else if (/stuck|wedged|lodged/i.test(normalized)) {
    damageSummary = "Vehicle became stuck or wedged beneath the bridge.";
  }

  let injurySummary: string | null = null;
  if (/no injuries|no one was injured|nobody was injured/i.test(lower)) injurySummary = "No injuries reported.";
  else if (/injur(?:y|ies|ed)/i.test(normalized)) injurySummary = "Injuries were mentioned; see sources for details.";

  return {
    location,
    travelDirection: directionMatch?.[1]?.toLowerCase() ?? null,
    truckType: truck ? truck.toLowerCase() : null,
    damageSummary,
    injurySummary,
  };
}

function getAtomLink(block: string) {
  return block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? "";
}
async function fetchArticleText(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 PeaceStreetBridgeTracker/2.0" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return "";
    return stripHtml((await response.text()).slice(0, 1_500_000)).slice(0, 60_000);
  } catch {
    return "";
  }
}

export async function scanNews(): Promise<ScanResult> {
  const queries = [
    '"Peace Street" bridge Raleigh truck',
    '"Peace Street bridge" struck Raleigh',
    '"Peace Street bridge" crash Raleigh',
  ];
  const itemsByUrl = new Map<string, { title: string; link: string; source: string; sourceKind: "news" | "reddit"; description: string; published: Date }>();
  const errors: string[] = [];

  for (const query of queries) {
    try {
      const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const response = await fetch(feedUrl, { headers: { "User-Agent": "PeaceStreetBridgeTracker/2.0" }, cache: "no-store" });
      if (!response.ok) throw new Error(`News feed returned HTTP ${response.status}`);
      const xml = await response.text();
      for (const block of [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]).slice(0, 25)) {
        const title = decodeXml(getTag(block, "title"));
        const link = decodeXml(getTag(block, "link"));
        const source = decodeXml(getTag(block, "source")) || "Google News";
        const description = stripHtml(getTag(block, "description"));
        const published = new Date(getTag(block, "pubDate") || Date.now());
        if (link) itemsByUrl.set(link, { title, link, source, sourceKind: "news", description, published });
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown feed error");
    }
  }

  try {
    const redditUrl = "https://www.reddit.com/r/raleigh/search.rss?q=" + encodeURIComponent('"Peace Street" bridge truck OR stuck OR struck') + "&restrict_sr=on&sort=new&t=all";
    const response = await fetch(redditUrl, { headers: { "User-Agent": "PeaceStreetBridgeTracker/2.3 (public incident monitor)" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Reddit feed returned HTTP ${response.status}`);
    const xml = await response.text();
    for (const block of [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => match[1]).slice(0, 35)) {
      const title = decodeXml(getTag(block, "title"));
      const link = decodeXml(getAtomLink(block));
      const description = stripHtml(getTag(block, "content"));
      const published = new Date(getTag(block, "published") || getTag(block, "updated") || Date.now());
      if (link) itemsByUrl.set(link, { title, link, source: "r/raleigh", sourceKind: "reddit", description, published });
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unknown Reddit feed error");
  }

  const newsItems = [...itemsByUrl.values()].filter((item) => item.sourceKind === "news").length;
  const redditItems = [...itemsByUrl.values()].filter((item) => item.sourceKind === "reddit").length;

  let relevant = 0;
  let accepted = 0;
  let newIncidents = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const item of [...itemsByUrl.values()].slice(0, 45)) {
    const summaryText = `${item.title}. ${item.description}`;
    if (!isRelevant(summaryText)) continue;
    relevant += 1;

    const articleText = await fetchArticleText(item.link);
    const combined = `${item.title}. ${item.description}. ${articleText}`;
    if (!isRelevant(combined)) continue;

    let extraction = extractIncidentDateTime(combined, item.published);
    if (!extraction && item.sourceKind === "reddit") {
      const ageHours = (Date.now() - item.published.getTime()) / 3_600_000;
      const looksLive = /\b(just|again|right now|police|on the scene|currently|this morning|today|stuck|wedged)\b/i.test(combined)
        && !/\b(1956|1988|throwback|history|historical|old photo|years ago)\b/i.test(combined);
      if (ageHours >= 0 && ageHours <= 48 && looksLive) {
        extraction = { incidentAt: item.published.toISOString(), confidence: 0.84, method: "reddit-live-post-time", excerpt: relevantSentences(combined)[0]?.slice(0, 800) ?? item.title };
      }
    }
    if (!extraction || extraction.confidence < MIN_CONFIDENCE) {
      skipped += 1;
      await recordSkippedReport({
        title: item.title,
        source_url: item.link,
        source_name: item.source,
        published_at: item.published.toISOString(),
        reason: "Automatic update skipped: no sufficiently reliable explicit strike date and time was found.",
        excerpt: relevantSentences(combined)[0],
      });
      continue;
    }

    try {
      const fields = extractStructuredFields(combined);
      const result = await registerAutomaticReport({
        title: item.title,
        source_url: item.link,
        source_name: item.source,
        published_at: item.published.toISOString(),
        detected_incident_at: extraction.incidentAt,
        confidence: extraction.confidence,
        extraction_method: extraction.method,
        excerpt: extraction.excerpt,
        source_kind: item.sourceKind,
        location: fields.location,
        travel_direction: fields.travelDirection,
        truck_type: fields.truckType,
        damage_summary: fields.damageSummary,
        injury_summary: fields.injurySummary,
      });
      if (!result.duplicate_source) {
        accepted += 1;
        if (result.created_incident) newIncidents += 1;
        else duplicates += 1;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown registration error");
    }
  }

  return { found: itemsByUrl.size, relevant, accepted, newIncidents, duplicates, skipped, newsItems, redditItems, errors };
}
