export interface NewsItem {
  title: string;
  link: string;
  publishedAt: string | null;
  sourceName: string | null;
}

const QUERY = '"Peace Street" bridge Raleigh truck OR struck OR hit';
const FEED_URL = `https://news.google.com/rss/search?q=${encodeURIComponent(QUERY)}&hl=en-US&gl=US&ceid=US:en`;

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function extract(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : null;
}

export async function scanNews(): Promise<NewsItem[]> {
  const response = await fetch(FEED_URL, {
    headers: { "User-Agent": "peace-street-bridge-tracker/2.0" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`News feed returned ${response.status}`);
  const xml = await response.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

  return blocks
    .map((block) => {
      const title = extract(block, "title");
      const link = extract(block, "link");
      const pubDate = extract(block, "pubDate");
      const source = extract(block, "source");
      if (!title || !link) return null;
      return {
        title,
        link,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
        sourceName: source,
      };
    })
    .filter((item): item is NewsItem => item !== null)
    .filter((item) => /peace street/i.test(item.title) && /(bridge|truck|struck|hit|collision)/i.test(item.title));
}
