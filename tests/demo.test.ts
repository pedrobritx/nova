import { expect, test } from "vitest";
import { getFolders, getLatest, getSources, getStory, getToday } from "@/lib/data";
import { createPglite, pgliteDb } from "@/lib/db/pglite";
import { DEMO_USER, seedDemo } from "@/lib/demo/db";

test("the demo library runs through the real parser and merge rules", async () => {
  const pg = await createPglite();
  await seedDemo(pg);
  const db = pgliteDb(pg, DEMO_USER.id);

  const today = await getToday(db);
  const ctl = today.find((s) => s.title.startsWith("Common Type Licence 2.0"))!;
  expect(ctl).toMatchObject({ sourceCount: 3, leadSource: "Open Web Dispatch", folder: "Web & design" });
  expect(today[0].id).toBe(ctl.id);

  const story = (await getStory(db, ctl.id))!;
  expect(story.items.map((i) => [i.source, i.mergedBy])).toEqual([
    ["Open Web Dispatch", null], ["Kernel Weekly", "link"], ["Planet Fonts", "copy"],
  ]);

  for (const pair of [["Antitrust Ledger", "Policy Brief"], ["Fieldwork", "Lexicon Notes"], ["Kernel Weekly", "Open Web Dispatch"]]) {
    expect(today.some((s) => s.sourceCount === 2 && pair.every((p) => s.sources.includes(p)))).toBe(true);
  }

  const { folders, unreadTotal } = await getFolders(db);
  expect(folders.map((f) => f.name)).toEqual(["Web & design", "Competition policy", "Languages", "Local"]);
  expect(unreadTotal).toBe((await getLatest(db)).length);

  const sources = await getSources(db);
  expect(sources).toHaveLength(9);
  expect(sources.every((s) => s.errorCount === 0 && s.lastSuccessAt)).toBe(true);
  const { rows } = await pg.query<{ due: number }>("select count(*)::int as due from public.feeds where next_fetch_at <> 'infinity'");
  expect(rows[0].due).toBe(0);
});
