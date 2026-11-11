import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, test } from "vitest";
import { createPglite, ensureUser, pgliteDb } from "@/lib/db/pglite";
import type { Db } from "@/lib/db/types";

const ANA = "aaaaaaaa-0000-4000-8000-000000000001";
const BEN = "bbbbbbbb-0000-4000-8000-000000000002";
const LONG = "The draft says automated subsetting for delivery does not create a modified version, which settles a question foundries have argued about for years.";
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let pg: PGlite;
let svc: Db;
let ana: Db;
let ben: Db;

async function feed(url: string, title: string): Promise<string> {
  const [row] = await svc.rpc<{ nova_upsert_feed: string }>("nova_upsert_feed", {
    p_url: url, p_title: title, p_site_url: null, p_format: "rss", p_description: null,
  });
  return row.nova_upsert_feed;
}

type Item = { guid: string; title: string; url?: string; linkKey?: string | null; contentHash?: string | null; publishedAt?: string; contentHtml?: string };
async function ingest(feedId: string, items: Item[]): Promise<number> {
  const [row] = await svc.rpc<{ nova_ingest_items: number }>("nova_ingest_items", {
    p_feed_id: feedId,
    p_items: items.map((i) => ({ publishedAt: hoursAgo(1), linkKey: null, contentHash: null, url: null, ...i })),
  });
  return row.nova_ingest_items;
}

beforeEach(async () => {
  pg = await createPglite();
  await ensureUser(pg, ANA, "ana@example.com");
  await ensureUser(pg, BEN, "ben@example.com");
  svc = pgliteDb(pg, null);
  ana = pgliteDb(pg, ANA);
  ben = pgliteDb(pg, BEN);
});

describe("merging into stories", () => {
  test("the same link from two feeds becomes one story; an exact copy joins it too", async () => {
    const ow = await feed("https://ow.example/atom.xml", "Open Web Dispatch");
    const tg = await feed("https://tg.example/feed.xml", "Type & Grid");
    const pf = await feed("https://pf.example/rss", "Planet Fonts");
    for (const f of [ow, tg, pf]) await ana.rpc("nova_follow", { p_feed: f, p_folder_name: "Web & design" });

    await ingest(ow, [{ guid: "ow-1", title: "CTL 2.0 draft opens", linkKey: "ow.example/ctl", contentHash: "h-ow", publishedAt: hoursAgo(5) }]);
    await ingest(tg, [{ guid: "tg-1", title: "What CTL 2.0 means", linkKey: "ow.example/ctl", contentHash: "h-tg", publishedAt: hoursAgo(4) }]);
    await ingest(pf, [{ guid: "pf-1", title: "CTL 2.0 draft opens", linkKey: "pf.example/copy", contentHash: "h-ow", publishedAt: hoursAgo(3) }]);

    const today = await ana.rpc<{ story_id: string; title: string; source_count: number; lead_feed_title: string }>("nova_today");
    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({ title: "CTL 2.0 draft opens", source_count: 3, lead_feed_title: "Open Web Dispatch" });

    const story = await ana.rpc<{ feed_title: string; merged_by: string | null }>("nova_story", { p_story: today[0].story_id });
    expect(story.map((s) => [s.feed_title, s.merged_by])).toEqual([
      ["Open Web Dispatch", null], ["Type & Grid", "link"], ["Planet Fonts", "copy"],
    ]);
  });

  test("items without a shared link or text stay apart, and so do old ones", async () => {
    const a = await feed("https://a.example/rss", "A");
    const b = await feed("https://b.example/rss", "B");
    for (const f of [a, b]) await ana.rpc("nova_follow", { p_feed: f });
    await ingest(a, [{ guid: "1", title: "Weekly links", linkKey: "a.example/1" }]);
    await ingest(b, [{ guid: "1", title: "Weekly links", linkKey: "b.example/1" }]);
    await ingest(b, [{ guid: "old", title: "Late repost", linkKey: "a.example/1", publishedAt: hoursAgo(24 * 9) }]);
    const latest = await ana.rpc<{ story_id: string }>("nova_latest");
    expect(new Set(latest.map((l) => l.story_id)).size).toBe(3);
  });

  test("a feed re-sending an item updates it instead of adding another", async () => {
    const a = await feed("https://a.example/rss", "A");
    await ana.rpc("nova_follow", { p_feed: a });
    expect(await ingest(a, [{ guid: "1", title: "Draft title" }])).toBe(1);
    expect(await ingest(a, [{ guid: "1", title: "Final title", contentHtml: `<p>${LONG}</p>` }])).toBe(0);
    const [item] = await ana.rpc<{ title: string }>("nova_latest");
    expect(item.title).toBe("Final title");
  });
});

describe("privacy", () => {
  test("people only see feeds, items and stories they follow", async () => {
    const mine = await feed("https://mine.example/rss", "Mine");
    const theirs = await feed("https://theirs.example/rss", "Theirs");
    await ana.rpc("nova_follow", { p_feed: mine, p_folder_name: "Private" });
    await ben.rpc("nova_follow", { p_feed: theirs });
    await ingest(mine, [{ guid: "1", title: "Ana's item" }]);
    await ingest(theirs, [{ guid: "1", title: "Ben's item" }]);

    expect((await ana.rpc<{ title: string }>("nova_latest")).map((i) => i.title)).toEqual(["Ana's item"]);
    expect((await ben.rpc<{ title: string }>("nova_latest")).map((i) => i.title)).toEqual(["Ben's item"]);
    expect(await ben.rpc("nova_folders")).toEqual([]);

    const [anaItem] = await ana.rpc<{ item_id: string; story_id: string }>("nova_latest");
    expect(await ben.rpc("nova_item", { p_item: anaItem.item_id })).toEqual([]);
    expect(await ben.rpc("nova_story", { p_story: anaItem.story_id })).toEqual([]);

    // Marking someone else's item read does nothing.
    await ben.rpc("nova_mark_read", { p_items: [anaItem.item_id] });
    const states = await pg.query("select * from public.item_states");
    expect(states.rows).toEqual([]);
  });

  test("people cannot call the fetcher's functions", async () => {
    await expect(ana.rpc("nova_upsert_feed", { p_url: "https://x.example/rss", p_title: "X", p_site_url: null, p_format: null, p_description: null })).rejects.toThrow(/permission denied/);
    await expect(ana.rpc("nova_claim_due_feeds", { p_limit: 5 })).rejects.toThrow(/permission denied/);
  });
});

describe("reading state and library", () => {
  test("marking read updates counts, Today and Latest", async () => {
    const a = await feed("https://a.example/rss", "A");
    await ana.rpc("nova_follow", { p_feed: a, p_folder_name: "News" });
    await ingest(a, [{ guid: "1", title: "One" }, { guid: "2", title: "Two" }]);
    const [folder] = await ana.rpc<{ folder_id: string; name: string; unread: number; sources: number }>("nova_folders");
    expect(folder).toMatchObject({ name: "News", unread: 2, sources: 1 });

    const latest = await ana.rpc<{ item_id: string }>("nova_latest");
    await ana.rpc("nova_mark_read", { p_items: [latest[0].item_id] });
    expect((await ana.rpc<{ unread: number }>("nova_folders"))[0].unread).toBe(1);
    expect(await ana.rpc("nova_latest", { p_unread_only: true })).toHaveLength(1);

    const [{ nova_mark_all_read: n }] = await ana.rpc<{ nova_mark_all_read: number }>("nova_mark_all_read", { p_folder: folder.folder_id });
    expect(n).toBe(1);
    expect((await ana.rpc<{ nova_unread_total: number }>("nova_unread_total"))[0].nova_unread_total).toBe(0);

    await ana.rpc("nova_mark_unread", { p_items: [latest[0].item_id] });
    expect((await ana.rpc<{ nova_unread_total: number }>("nova_unread_total"))[0].nova_unread_total).toBe(1);
  });

  test("following twice keeps one subscription and can move it to a folder", async () => {
    const a = await feed("https://a.example/rss", "A");
    await ana.rpc("nova_follow", { p_feed: a });
    await ana.rpc("nova_follow", { p_feed: a, p_folder_name: "Later" });
    const sources = await ana.rpc<{ folder_name: string }>("nova_sources");
    expect(sources).toHaveLength(1);
    expect(sources[0].folder_name).toBe("Later");
  });
});

describe("fetch schedule", () => {
  test("only followed, due feeds are claimed, once", async () => {
    const followed = await feed("https://a.example/rss", "A");
    await feed("https://orphan.example/rss", "Nobody follows this");
    await ana.rpc("nova_follow", { p_feed: followed });
    const first = await svc.rpc<{ id: string }>("nova_claim_due_feeds", { p_limit: 10 });
    expect(first.map((f) => f.id)).toEqual([followed]);
    expect(await svc.rpc("nova_claim_due_feeds", { p_limit: 10 })).toEqual([]);
  });

  test("errors back off and Retry-After is respected", async () => {
    const a = await feed("https://a.example/rss", "A");
    const minutesUntilNext = async () => {
      const { rows } = await pg.query<{ m: number }>("select extract(epoch from next_fetch_at - now()) / 60 as m from public.feeds where id = $1", [a]);
      return Math.round(Number(rows[0].m));
    };
    const fetched = (ok: boolean, retry: number | null = null) =>
      svc.rpc("nova_feed_fetched", { p_feed_id: a, p_ok: ok, p_error: ok ? null : "timeout", p_etag: '"e1"', p_last_modified: null, p_title: "A", p_site_url: null, p_retry_after_seconds: retry });

    await fetched(true);
    expect(await minutesUntilNext()).toBe(15);
    await fetched(false);
    expect(await minutesUntilNext()).toBe(30);
    await fetched(false);
    expect(await minutesUntilNext()).toBe(60);
    await fetched(true, 7200);
    expect(await minutesUntilNext()).toBe(120);
    const { rows } = await pg.query<{ etag: string; error_count: number }>("select etag, error_count from public.feeds where id = $1", [a]);
    expect(rows[0]).toEqual({ etag: '"e1"', error_count: 0 });
  });
});

describe("organising sources", () => {
  test("moving and unfollowing a source, with empty folders tidied away", async () => {
    const a = await feed("https://a.example/rss", "A");
    await ana.rpc("nova_follow", { p_feed: a, p_folder_name: "Old" });
    const [source] = await ana.rpc<{ subscription_id: string }>("nova_sources");
    await ana.rpc("nova_move_source", { p_subscription: source.subscription_id, p_folder_name: "New" });
    expect((await ana.rpc<{ name: string }>("nova_folders")).map((f) => f.name)).toEqual(["New"]);
    await ben.rpc("nova_unfollow", { p_subscription: source.subscription_id });
    expect(await ana.rpc("nova_sources")).toHaveLength(1);
    await ana.rpc("nova_unfollow", { p_subscription: source.subscription_id });
    expect(await ana.rpc("nova_sources")).toHaveLength(0);
  });
});

describe("review fixes", () => {
  test("Latest pages through items that share a timestamp without skipping any", async () => {
    const a = await feed("https://a.example/rss", "A");
    await ana.rpc("nova_follow", { p_feed: a });
    const t = hoursAgo(2);
    await ingest(a, ["1", "2", "3", "4", "5"].map((g) => ({ guid: g, title: `Item ${g}`, publishedAt: t })));
    const seen: string[] = [];
    let cursor: { before: string | null; id: string | null } = { before: null, id: null };
    for (let page = 0; page < 5; page++) {
      const rows = await ana.rpc<{ item_id: string; published_at: Date }>("nova_latest", { p_limit: 2, p_before: cursor.before, p_before_id: cursor.id });
      if (!rows.length) break;
      seen.push(...rows.map((r) => r.item_id));
      const last = rows.at(-1)!;
      cursor = { before: new Date(last.published_at).toISOString(), id: last.item_id };
    }
    expect(new Set(seen).size).toBe(5);
  });

  test("a story's size counts only the sources you follow", async () => {
    const a = await feed("https://a.example/rss", "A");
    const b = await feed("https://b.example/rss", "B");
    await ana.rpc("nova_follow", { p_feed: a });
    await ben.rpc("nova_follow", { p_feed: a });
    await ben.rpc("nova_follow", { p_feed: b });
    await ingest(a, [{ guid: "1", title: "Shared", linkKey: "news.example/x" }]);
    await ingest(b, [{ guid: "1", title: "Shared too", linkKey: "news.example/x" }]);
    const [anaItem] = await ana.rpc<{ item_id: string; story_size: number }>("nova_latest");
    expect(anaItem.story_size).toBe(1);
    expect((await ana.rpc<{ story_size: number }>("nova_item", { p_item: anaItem.item_id }))[0].story_size).toBe(1);
    expect((await ben.rpc<{ story_size: number }>("nova_latest")).map((r) => r.story_size)).toEqual([2, 2]);
  });

  test("your name for a source stays on your subscription", async () => {
    const a = await feed("https://a.example/rss", "Feed's own title");
    await ana.rpc("nova_follow", { p_feed: a, p_title: "My name for it" });
    await ben.rpc("nova_follow", { p_feed: a });
    expect((await ana.rpc<{ title: string }>("nova_sources"))[0].title).toBe("My name for it");
    expect((await ben.rpc<{ title: string }>("nova_sources"))[0].title).toBe("Feed's own title");
  });
});

describe("corrections", () => {
  test("a corrected item gets a new fingerprint, so copies of the correction merge", async () => {
    const a = await feed("https://a.example/rss", "A");
    const b = await feed("https://b.example/rss", "B");
    for (const f of [a, b]) await ana.rpc("nova_follow", { p_feed: f });
    await ingest(a, [{ guid: "1", title: "Draft", contentHash: "old-text", contentHtml: "<p>old</p>" }]);
    await ingest(a, [{ guid: "1", title: "Corrected", contentHash: "new-text", contentHtml: "<p>new</p>" }]);
    const { rows } = await pg.query<{ content_hash: string }>("select content_hash from public.items where feed_id = $1", [a]);
    expect(rows[0].content_hash).toBe("new-text");
    await ingest(b, [{ guid: "x", title: "Corrected", contentHash: "new-text" }]);
    const latest = await ana.rpc<{ story_id: string; merged_by: string | null; feed_title: string }>("nova_latest");
    expect(new Set(latest.map((l) => l.story_id)).size).toBe(1);
    expect(latest.find((l) => l.feed_title === "B")?.merged_by).toBe("copy");
  });
});
