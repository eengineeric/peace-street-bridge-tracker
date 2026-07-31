import { insertCandidate } from "@/lib/reports";

export type ScanResult = {
  found: number;
  inserted: number;
  errors: string[];
};

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function getTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() ?? "";
}

export async function scanNews(): Promise<ScanResult> {
  const query = encodeURIComponent('"Peace Street" bridge Raleigh truck');
  const feedUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(feedUrl, {
    headers: { "User-Agent": "PeaceStreetBridgeTracker/1.0" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`News feed returned HTTP ${response.status}`);
  }

  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  let inserted = 0;
  const errors: string[] = [];

  for (const item of items.slice(0, 20)) {
    const title = decodeXml(getTag(item, "title"));
    const link = decodeXml(getTag(item, "link"));
    const source = decodeXml(getTag(item, "source")) || "Google News";
    const publishedRaw = getTag(item, "pubDate");
    const published = new Date(publishedRaw || Date.now());
    const haystack = title.toLowerCase();

    const relevant =
      haystack.includes("peace street") &&
      haystack.includes("bridge") &&
      ["truck", "hit", "struck", "collision", "crash"].some((term) => haystack.includes(term));

    if (!relevant || !link) continue;

    try {
      const row = await insertCandidate({
        title,
        source_url: link,
        source_name: source,
        published_at: published.toISOString(),
        incident_date: published.toISOString().slice(0, 10),
      });
      if (row) inserted += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown insert error");
    }
  }

  return { found: items.length, inserted, errors };
}
