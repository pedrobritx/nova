import "server-only";
import type { Db } from "./db/types";
import { FetchRefused, safeFetch, type FetchOptions } from "./feeds/net";
import { parseFeedText, type ParsedFeed } from "./feeds/parse";

export type FeedRow = { id: string; url: string; etag: string | null; last_modified: string | null };

export type FeedOutcome = { feedId: string; ok: boolean; newItems: number; error?: string };

/**
 * Run a database write again when Postgres aborted it to break a deadlock or a serialisation
 * conflict with another refresh. Merges lock story rows, and two feeds can reach the same
 * stories in opposite orders; the second attempt finds them free.
 */
export async function retryOnConflict<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (attempt >= attempts || (code !== "40P01" && code !== "40001")) throw err;
      await new Promise((r) => setTimeout(r, 50 * attempt + Math.random() * 100));
    }
  }
}

/** Items as nova_ingest_items expects them. */
export function toIngestPayload(feed: ParsedFeed) {
  return feed.items.map((i) => ({
    guid: i.guid, url: i.url, linkKey: i.linkKey, title: i.title, excerpt: i.excerpt, contentHtml: i.contentHtml,
    author: i.author, imageUrl: i.imageUrl, publishedAt: i.publishedAt, contentHash: i.contentHash,
  }));
}

function describe(err: unknown): string {
  if (err instanceof FetchRefused) return err.message;
  if (err instanceof Error && err.name === "NotAFeed") return "The address no longer serves a feed";
  if (err instanceof Error && err.name === "TimeoutError") return "The site took too long to answer";
  return "Nova could not read the feed";
}

/** Fetch one feed, store what is new and schedule its next fetch. Never throws. */
export async function refreshFeed(service: Db, feed: FeedRow, fetchOptions: FetchOptions = {}): Promise<FeedOutcome> {
  try {
    const res = await safeFetch(feed.url, { ...fetchOptions, etag: feed.etag, lastModified: feed.last_modified });
    if (res.notModified) {
      await recordFetch(service, feed.id, { ok: true, etag: res.etag, lastModified: res.lastModified });
      return { feedId: feed.id, ok: true, newItems: 0 };
    }
    if (res.status === 429 || res.status === 503) {
      const error = "The site asked Nova to slow down";
      await recordFetch(service, feed.id, { ok: false, error, retryAfter: res.retryAfter ?? 3600 });
      return { feedId: feed.id, ok: false, newItems: 0, error };
    }
    if (res.status >= 400) {
      const error = res.status === 404 || res.status === 410 ? "The feed is gone from this address" : `The site answered with an error (${res.status})`;
      await recordFetch(service, feed.id, { ok: false, error });
      return { feedId: feed.id, ok: false, newItems: 0, error };
    }
    const parsed = parseFeedText(res.text, res.url);
    const [row] = await retryOnConflict(() => service.rpc<{ nova_ingest_items: number }>("nova_ingest_items", { p_feed_id: feed.id, p_items: toIngestPayload(parsed) }));
    await recordFetch(service, feed.id, { ok: true, etag: res.etag, lastModified: res.lastModified, title: parsed.title, siteUrl: parsed.siteUrl, retryAfter: res.retryAfter });
    return { feedId: feed.id, ok: true, newItems: row?.nova_ingest_items ?? 0 };
  } catch (err) {
    const error = describe(err);
    await recordFetch(service, feed.id, { ok: false, error }).catch(() => {});
    return { feedId: feed.id, ok: false, newItems: 0, error };
  }
}

async function recordFetch(
  service: Db,
  feedId: string,
  r: { ok: boolean; error?: string; etag?: string | null; lastModified?: string | null; title?: string; siteUrl?: string | null; retryAfter?: number | null },
) {
  await service.rpc("nova_feed_fetched", {
    p_feed_id: feedId, p_ok: r.ok, p_error: r.error ?? null, p_etag: r.etag ?? null, p_last_modified: r.lastModified ?? null,
    p_title: r.title ?? null, p_site_url: r.siteUrl ?? null, p_retry_after_seconds: r.retryAfter ?? null,
  });
}

/** Run tasks with a concurrency limit, stopping new work when the time budget runs out. */
export async function pool<T, R>(items: T[], limit: number, deadline: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && Date.now() < deadline) {
      const item = items[next++];
      out.push(await run(item));
    }
  });
  await Promise.all(workers);
  return out;
}

/** Claim the feeds that are due and refresh them, within a time budget. */
export async function refreshDue(service: Db, opts: { limit?: number; budgetMs?: number; concurrency?: number } = {}) {
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  const due = await service.rpc<FeedRow>("nova_claim_due_feeds", { p_limit: opts.limit ?? 40 });
  const outcomes = await pool(due, opts.concurrency ?? 6, deadline, (f) => refreshFeed(service, f));
  return {
    claimed: due.length,
    fetched: outcomes.length,
    failed: outcomes.filter((o) => !o.ok).length,
    newItems: outcomes.reduce((n, o) => n + o.newItems, 0),
  };
}
