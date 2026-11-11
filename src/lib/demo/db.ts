import "server-only";
import type { PGlite } from "@electric-sql/pglite";
import { createPglite, ensureUser, pgliteDb } from "../db/pglite";
import { parseFeedText } from "../feeds/parse";
import { toIngestPayload } from "../refresh";
import type { Context } from "../server";
import { DEMO_FEEDS, renderDemoFeed } from "./fixtures";

// Demo mode runs Nova without Supabase: an in-memory Postgres with the real migrations,
// seeded through the real parser and merge rules. Nothing persists between restarts.

export const DEMO_USER = { id: "de000000-0000-4000-8000-000000000000", email: "demo@nova.example" };

export function demoMode(): boolean {
  return process.env.NOVA_DEMO === "1";
}

export async function seedDemo(pg: PGlite, now = Date.now()): Promise<void> {
  await ensureUser(pg, DEMO_USER.id, DEMO_USER.email);
  const service = pgliteDb(pg, null);
  const user = pgliteDb(pg, DEMO_USER.id);
  for (const feed of DEMO_FEEDS) {
    const parsed = parseFeedText(renderDemoFeed(feed, now), feed.url, new Date(now));
    const [{ nova_upsert_feed: feedId }] = await service.rpc<{ nova_upsert_feed: string }>("nova_upsert_feed", {
      p_url: feed.url, p_title: parsed.title, p_site_url: parsed.siteUrl, p_format: parsed.format, p_description: parsed.description,
    });
    await user.rpc("nova_follow", { p_feed: feedId, p_folder_name: feed.folder });
    await service.rpc("nova_ingest_items", { p_feed_id: feedId, p_items: toIngestPayload(parsed) });
    await service.rpc("nova_feed_fetched", { p_feed_id: feedId, p_ok: true, p_error: null, p_etag: null, p_last_modified: null, p_title: parsed.title, p_site_url: parsed.siteUrl, p_retry_after_seconds: null });
  }
  // The sample feeds live on .example domains, which do not resolve: never try to fetch them.
  await pg.query("update public.feeds set next_fetch_at = 'infinity' where url like 'https://%.example/%'");
}

const globalDemo = globalThis as unknown as { __novaDemo?: Promise<PGlite> };

export async function demoContext(): Promise<Context> {
  globalDemo.__novaDemo ??= createPglite().then(async (pg) => {
    await seedDemo(pg);
    return pg;
  });
  const pg = await globalDemo.__novaDemo;
  return { db: pgliteDb(pg, DEMO_USER.id), service: pgliteDb(pg, null), viewer: DEMO_USER, demo: true };
}
