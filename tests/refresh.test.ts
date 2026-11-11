import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createPglite, ensureUser, pgliteDb } from "@/lib/db/pglite";
import { refreshFeed, type FeedRow } from "@/lib/refresh";

const USER = "cccccccc-0000-4000-8000-000000000003";
let server: Server;
let base: string;
let mode: "ok" | "gone" | "busy" = "ok";
const rss = (titles: string[]) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Local</title><link>http://local.test/</link>${titles
    .map((t, i) => `<item><title>${t}</title><link>http://local.test/${i}</link><guid>${t}</guid><pubDate>${new Date(Date.now() - i * 60_000).toUTCString()}</pubDate></item>`)
    .join("")}</channel></rss>`;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (mode === "gone") return res.writeHead(404).end();
    if (mode === "busy") return res.writeHead(429, { "retry-after": "3600" }).end();
    if (req.headers["if-none-match"] === '"v2"') return res.writeHead(304).end();
    res.writeHead(200, { "content-type": "application/rss+xml", etag: '"v2"' });
    res.end(rss(["Second", "First"]));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

test("a refresh stores new items, honours ETags and records failures", async () => {
  const pg = await createPglite();
  await ensureUser(pg, USER, "c@example.com");
  const service = pgliteDb(pg, null);
  const user = pgliteDb(pg, USER);
  const [{ nova_upsert_feed: id }] = await service.rpc<{ nova_upsert_feed: string }>("nova_upsert_feed", {
    p_url: `${base}/feed`, p_title: "", p_site_url: null, p_format: null, p_description: null,
  });
  await user.rpc("nova_follow", { p_feed: id });
  const feedRow = async () => (await pg.query<FeedRow & { title: string; error_count: number; last_error: string | null }>("select * from public.feeds where id = $1", [id])).rows[0];

  expect(await refreshFeed(service, await feedRow(), { allowPrivate: true })).toMatchObject({ ok: true, newItems: 2 });
  expect(await feedRow()).toMatchObject({ title: "Local", etag: '"v2"', error_count: 0 });
  expect(await refreshFeed(service, await feedRow(), { allowPrivate: true })).toMatchObject({ ok: true, newItems: 0 });

  mode = "gone";
  expect(await refreshFeed(service, await feedRow(), { allowPrivate: true })).toMatchObject({ ok: false, error: "The feed is gone from this address" });
  mode = "busy";
  await refreshFeed(service, await feedRow(), { allowPrivate: true });
  const row = await feedRow();
  expect(row).toMatchObject({ error_count: 2, last_error: "The site asked Nova to slow down" });
  const { rows } = await pg.query<{ h: number }>("select round(extract(epoch from next_fetch_at - now()) / 3600) as h from public.feeds where id = $1", [id]);
  expect(Number(rows[0].h)).toBe(1);

  // Without the test-only switch, the fetcher refuses to touch loopback at all.
  mode = "ok";
  expect(await refreshFeed(service, await feedRow())).toMatchObject({ ok: false, error: "Nova only reads public websites" });
  expect((await user.rpc("nova_latest")).length).toBe(2);
});
