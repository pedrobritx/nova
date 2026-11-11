import "server-only";
import { safeFetch, type FetchOptions } from "./net";
import { looksLikeFeed, NotAFeed, parseFeedText, type ParsedFeed } from "./parse";

export type FoundFeed = {
  url: string;
  title: string;
  siteUrl: string | null;
  format: ParsedFeed["format"];
  itemCount: number;
  latest: string[];
  fullText: boolean;
};

const FEED_TYPES = /application\/(rss|atom|feed)\+(xml|json)|application\/(rdf\+)?xml|text\/xml|application\/json/i;
const COMMON_PATHS = ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml", "/index.xml", "/feed.json", "/blog/feed"];

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null;
}

/** <link rel="alternate"> feed links declared by an HTML page, in page order. */
export function feedLinksInHtml(html: string, pageUrl: string): { url: string; title: string | null }[] {
  const head = html.slice(0, 200_000);
  const out: { url: string; title: string | null }[] = [];
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase().split(/\s+/);
    const type = attr(tag, "type") ?? "";
    const href = attr(tag, "href");
    if (!href || !rel.includes("alternate") || !FEED_TYPES.test(type) || /comments/i.test(attr(tag, "title") ?? "")) continue;
    try {
      const url = new URL(href.replace(/&amp;/g, "&"), pageUrl).toString();
      if (!out.some((f) => f.url === url)) out.push({ url, title: attr(tag, "title") });
    } catch {
      /* ignore broken hrefs */
    }
  }
  return out;
}

function summarise(url: string, feed: ParsedFeed): FoundFeed {
  const withText = feed.items.filter((i) => (i.contentHtml?.length ?? 0) > 1500).length;
  return {
    url,
    title: feed.title,
    siteUrl: feed.siteUrl,
    format: feed.format,
    itemCount: feed.items.length,
    latest: feed.items.slice(0, 3).map((i) => i.title),
    fullText: feed.items.length > 0 && withText / feed.items.length >= 0.5,
  };
}

async function tryFeed(url: string, options: FetchOptions): Promise<FoundFeed | null> {
  try {
    const res = await safeFetch(url, { ...options, maxBytes: 3 * 1024 * 1024 });
    if (res.status >= 400 || !looksLikeFeed(res.contentType, res.text)) return null;
    return summarise(res.url, parseFeedText(res.text, res.url));
  } catch {
    return null;
  }
}

/**
 * Find the feeds behind an address: the address itself if it is a feed, otherwise the feeds
 * its page declares, otherwise the usual feed paths on that site.
 */
export async function discoverFeeds(address: string, options: FetchOptions = {}): Promise<FoundFeed[]> {
  const res = await safeFetch(address, options);
  if (res.status >= 400) throw new NotAFeed(`The site answered with an error (${res.status})`);

  if (looksLikeFeed(res.contentType, res.text)) {
    try {
      return [summarise(res.url, parseFeedText(res.text, res.url))];
    } catch {
      /* fall through: some sites send HTML with an XML content type */
    }
  }

  const declared = feedLinksInHtml(res.text, res.url).slice(0, 6);
  const found = (await Promise.all(declared.map((d) => tryFeed(d.url, options)))).filter((f): f is FoundFeed => f !== null);
  if (found.length) return found;

  const origin = new URL(res.url).origin;
  for (const path of COMMON_PATHS) {
    const feed = await tryFeed(origin + path, options);
    if (feed) return [feed];
  }
  return [];
}
