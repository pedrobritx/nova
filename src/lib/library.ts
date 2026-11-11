import "server-only";
import type { Db } from "./db/types";
import { discoverFeeds, type FoundFeed } from "./feeds/discover";
import { FetchRefused, safeFetch } from "./feeds/net";
import { readOpml } from "./feeds/opml";
import { NotAFeed, parseFeedText } from "./feeds/parse";
import { normaliseInputUrl } from "./feeds/url";
import { pool, refreshFeed, toIngestPayload } from "./refresh";

export type Found = { ok: true; feeds: FoundFeed[] } | { ok: false; error: string };

/** Look for feeds behind whatever someone pasted: a feed URL, a site, or a bare domain. */
export async function findFeeds(input: string): Promise<Found> {
  const address = normaliseInputUrl(input);
  if (!address) return { ok: false, error: "Enter a web address, like typeandgrid.example" };
  try {
    const feeds = await discoverFeeds(address);
    return feeds.length ? { ok: true, feeds } : { ok: false, error: "No feed found on that page. Try the site's home page or its feed address." };
  } catch (err) {
    if (err instanceof FetchRefused || err instanceof NotAFeed) return { ok: false, error: err.message };
    return { ok: false, error: "Nova could not reach that address" };
  }
}

async function registerFeed(service: Db, url: string, title: string | null, siteUrl: string | null, format: string | null): Promise<string> {
  const [row] = await service.rpc<{ nova_upsert_feed: string }>("nova_upsert_feed", {
    p_url: url, p_title: title ?? "", p_site_url: siteUrl, p_format: format, p_description: null,
  });
  return row.nova_upsert_feed;
}

/** Follow one feed: register it, store its current items, then add it to the person's library. */
export async function follow(user: Db, service: Db, feedUrl: string, folder: string | null): Promise<{ ok: true; feedId: string } | { ok: false; error: string }> {
  try {
    const res = await safeFetch(feedUrl);
    if (res.status >= 400) return { ok: false, error: `The feed answered with an error (${res.status})` };
    const parsed = parseFeedText(res.text, res.url);
    const feedId = await registerFeed(service, res.url, parsed.title, parsed.siteUrl, parsed.format);
    await user.rpc("nova_follow", { p_feed: feedId, p_folder_name: folder });
    await service.rpc("nova_ingest_items", { p_feed_id: feedId, p_items: toIngestPayload(parsed) });
    await service.rpc("nova_feed_fetched", {
      p_feed_id: feedId, p_ok: true, p_error: null, p_etag: res.etag, p_last_modified: res.lastModified,
      p_title: parsed.title, p_site_url: parsed.siteUrl, p_retry_after_seconds: res.retryAfter,
    });
    return { ok: true, feedId };
  } catch (err) {
    if (err instanceof FetchRefused || err instanceof NotAFeed) return { ok: false, error: err.message };
    throw err;
  }
}

export type ImportResult = { added: number; folders: string[]; fetched: number; failed: { title: string; error: string }[]; queued: number };

/**
 * Import an OPML file: every feed is registered and followed at once (folders included), the
 * first ones are fetched straight away, and the scheduled refresh picks up the rest.
 */
export async function importOpml(user: Db, service: Db, xml: string, budgetMs = 25_000): Promise<ImportResult> {
  const { sources } = readOpml(xml);
  if (!sources.length) throw new Error("The file has no feeds in it");
  if (sources.length > 500) throw new Error("Nova imports up to 500 feeds at a time");
  const rows: { id: string; url: string; title: string }[] = [];
  for (const s of sources) {
    const id = await registerFeed(service, s.url, s.title, s.siteUrl, null);
    await user.rpc("nova_follow", { p_feed: id, p_folder_name: s.folder });
    rows.push({ id, url: s.url, title: s.title ?? s.url });
  }
  const outcomes = await pool(rows, 6, Date.now() + budgetMs, async (r) => ({ ...(await refreshFeed(service, { id: r.id, url: r.url, etag: null, last_modified: null })), title: r.title }));
  return {
    added: rows.length,
    folders: [...new Set(sources.map((s) => s.folder).filter((f): f is string => !!f))],
    fetched: outcomes.filter((o) => o.ok).length,
    failed: outcomes.filter((o) => !o.ok).map((o) => ({ title: o.title, error: o.error ?? "Could not read" })),
    queued: rows.length - outcomes.length,
  };
}
