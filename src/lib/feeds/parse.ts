import { createHash } from "node:crypto";
import { parseFeed } from "feedsmith";
import { contentHash, excerpt, firstImage, sanitizeContent } from "./content";
import { cleanUrl, linkKey } from "./url";

export type FeedFormat = "rss" | "atom" | "json" | "rdf";

export type ParsedItem = {
  guid: string;
  url: string | null;
  linkKey: string | null;
  title: string;
  excerpt: string | null;
  contentHtml: string | null;
  author: string | null;
  imageUrl: string | null;
  publishedAt: string;
  contentHash: string | null;
};

export type ParsedFeed = {
  format: FeedFormat;
  title: string;
  siteUrl: string | null;
  description: string | null;
  items: ParsedItem[];
};

export class NotAFeed extends Error {
  constructor(message = "This address is not a feed") {
    super(message);
    this.name = "NotAFeed";
  }
}

type Loose = Record<string, unknown> | undefined;

/** Feed libraries hand back strings, { value } objects or arrays of either: take the text. */
function text(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    return text(v.value ?? v.name ?? v.text ?? v["#text"]);
  }
  return null;
}

function date(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    const t = text(c);
    if (!t) continue;
    const ms = Date.parse(t);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return null;
}

function isImage(type: unknown, url: unknown): boolean {
  const t = text(type) ?? "";
  return t.startsWith("image/") || (!t && /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(text(url) ?? ""));
}

type Draft = Omit<ParsedItem, "guid" | "linkKey" | "excerpt" | "contentHash" | "publishedAt" | "contentHtml"> & {
  guid: string | null;
  summaryHtml: string | null;
  contentHtml: string | null;
  publishedAt: string | null;
};

function rssItem(item: Record<string, unknown>, base: string | null): Draft {
  const enclosures = (item.enclosures as Loose[] | undefined) ?? [];
  const media = item.media as Loose;
  const mediaImage =
    text((media?.thumbnails as Loose[] | undefined)?.[0]?.url) ??
    text(((media?.contents as Loose[] | undefined) ?? []).find((c) => c?.medium === "image" || isImage(c?.type, c?.url))?.url);
  const dc = item.dc as Loose;
  const guid = item.guid as Loose | string | undefined;
  const guidValue = typeof guid === "string" ? guid : text(guid?.value);
  const link = text(item.link) ?? (typeof guid === "object" && guid?.isPermaLink !== false ? text(guidValue) : null);
  return {
    guid: guidValue,
    url: cleanUrl(link, base),
    title: text(item.title) ?? "",
    summaryHtml: text(item.description),
    contentHtml: text((item.content as Loose)?.encoded),
    author: text(item.authors) ?? text(item.author) ?? text(dc?.creator) ?? text(dc?.creators),
    imageUrl: cleanUrl(text(enclosures.find((e) => isImage(e?.type, e?.url))?.url) ?? mediaImage, base),
    publishedAt: date(item.pubDate, dc?.date, dc?.dates),
  };
}

function atomItem(entry: Record<string, unknown>, base: string | null): Draft {
  const links = (entry.links as Loose[] | undefined) ?? [];
  const alternate = links.find((l) => !l?.rel || l.rel === "alternate") ?? links[0];
  const enclosure = links.find((l) => l?.rel === "enclosure" && isImage(l.type, l.href));
  const media = entry.media as Loose;
  return {
    guid: text(entry.id),
    url: cleanUrl(text(alternate?.href), base),
    title: text(entry.title) ?? "",
    summaryHtml: text(entry.summary),
    contentHtml: text(entry.content),
    author: text((entry.authors as Loose[] | undefined)?.[0]?.name),
    imageUrl: cleanUrl(text(enclosure?.href) ?? text((media?.thumbnails as Loose[] | undefined)?.[0]?.url), base),
    publishedAt: date(entry.published, entry.updated),
  };
}

function jsonItem(item: Record<string, unknown>, base: string | null): Draft {
  const authors = (item.authors as Loose[] | undefined) ?? (item.author ? [item.author as Loose] : []);
  const html = text(item.content_html) ?? (text(item.content_text) ? `<p>${escapeHtml(text(item.content_text)!)}</p>` : null);
  return {
    guid: text(item.id),
    url: cleanUrl(text(item.url) ?? text(item.external_url), base),
    title: text(item.title) ?? "",
    summaryHtml: text(item.summary),
    contentHtml: html,
    author: text(authors[0]?.name),
    imageUrl: cleanUrl(text(item.image) ?? text(item.banner_image), base),
    publishedAt: date(item.date_published, item.date_modified),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function finish(d: Draft, feedUrl: string, fetchedAt: Date): ParsedItem | null {
  const base = d.url ?? feedUrl;
  const contentHtml = sanitizeContent(d.contentHtml ?? d.summaryHtml, base);
  const summary = d.summaryHtml && d.contentHtml ? sanitizeContent(d.summaryHtml, base) : null;
  const title = d.title ? (excerpt(d.title, 300) ?? "") : excerpt(contentHtml, 90) ?? "";
  if (!title && !d.url) return null;
  // Dates in the future are publishing mistakes; they would pin an item to the top for days.
  const published = d.publishedAt && Date.parse(d.publishedAt) <= fetchedAt.getTime() + 60_000 ? d.publishedAt : fetchedAt.toISOString();
  const guid = d.guid ?? d.url ?? createHash("sha256").update(`${title}|${d.publishedAt ?? ""}`).digest("hex");
  return {
    guid: guid.slice(0, 1000),
    url: d.url,
    linkKey: linkKey(d.url),
    title: title || (d.url ?? ""),
    excerpt: excerpt(summary ?? contentHtml),
    contentHtml,
    author: d.author ? d.author.slice(0, 200) : null,
    imageUrl: d.imageUrl ?? firstImage(contentHtml),
    publishedAt: published,
    contentHash: contentHash(title, contentHtml),
  };
}

/** Parse RSS, Atom, RDF or JSON Feed text into one shape, sanitised and ready to store. */
export function parseFeedText(body: string, feedUrl: string, fetchedAt = new Date()): ParsedFeed {
  let parsed: { format: string; feed: unknown };
  try {
    parsed = parseFeed(body.trim()) as { format: string; feed: unknown };
  } catch {
    throw new NotAFeed();
  }
  const feed = parsed.feed as Record<string, unknown>;
  const format = parsed.format as FeedFormat;
  let siteUrl: string | null;
  let drafts: Draft[];
  if (format === "atom") {
    const links = (feed.links as Loose[] | undefined) ?? [];
    siteUrl = cleanUrl(text((links.find((l) => !l?.rel || l.rel === "alternate") ?? {})?.href), feedUrl);
    drafts = ((feed.entries as Record<string, unknown>[] | undefined) ?? []).map((e) => atomItem(e, siteUrl ?? feedUrl));
  } else if (format === "json") {
    siteUrl = cleanUrl(text(feed.home_page_url), feedUrl);
    drafts = ((feed.items as Record<string, unknown>[] | undefined) ?? []).map((i) => jsonItem(i, siteUrl ?? feedUrl));
  } else {
    siteUrl = cleanUrl(text(feed.link), feedUrl);
    drafts = ((feed.items as Record<string, unknown>[] | undefined) ?? []).map((i) => rssItem(i, siteUrl ?? feedUrl));
  }
  const seen = new Set<string>();
  const items: ParsedItem[] = [];
  for (const d of drafts.slice(0, 200)) {
    const item = finish(d, feedUrl, fetchedAt);
    if (item && !seen.has(item.guid)) {
      seen.add(item.guid);
      items.push(item);
    }
  }
  const title = text(feed.title) ?? (siteUrl ? new URL(siteUrl).hostname.replace(/^www\./, "") : new URL(feedUrl).hostname);
  return {
    format,
    title: excerpt(title, 120) ?? title,
    siteUrl,
    description: excerpt(text(feed.description) ?? text(feed.subtitle), 300),
    items,
  };
}

/** True when a response looks like a feed rather than a web page. */
export function looksLikeFeed(contentType: string, body: string): boolean {
  if (/(rss|atom|feed)\+(xml|json)|\/(xml|rss)/i.test(contentType)) return true;
  const head = body.trimStart().slice(0, 600);
  return /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)\b/i.test(head) || /"version"\s*:\s*"https:\/\/jsonfeed\.org/.test(head);
}
