import { expect, test } from "vitest";
import { createPglite, ensureUser, pgliteDb } from "@/lib/db/pglite";
import { assertPublicAddress, FetchRefused } from "@/lib/feeds/net";
import { importOpml } from "@/lib/library";

const USER = "dddddddd-0000-4000-8000-000000000004";

test.each(["http://10.0.0.1/feed", "http://127.0.0.1/rss", "http://[::1]/", "http://router.local/rss", "http://metadata.internal/"])(
  "%s is refused before anything is recorded",
  async (url) => {
    await expect(assertPublicAddress(url)).rejects.toBeInstanceOf(FetchRefused);
  },
);

test("an import never writes refused addresses or the file's names to shared feeds", async () => {
  const pg = await createPglite();
  await ensureUser(pg, USER, "d@example.com");
  const opml = `<?xml version="1.0"?><opml version="2.0"><head><title>x</title></head><body>
    <outline text="Inside"><outline type="rss" text="Router" xmlUrl="http://192.168.1.1/feed"/>
    <outline type="rss" text="Loopback" xmlUrl="http://127.0.0.1:8080/rss"/></outline></body></opml>`;
  const result = await importOpml(pgliteDb(pg, USER), pgliteDb(pg, null), opml, 1_000);
  expect(result).toMatchObject({ added: 0, fetched: 0, queued: 0 });
  expect(result.failed.map((f) => f.title)).toEqual(["Router", "Loopback"]);
  const { rows } = await pg.query("select url from public.feeds");
  expect(rows).toEqual([]);
});
