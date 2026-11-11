import { getSources } from "@/lib/data";
import { writeOpml } from "@/lib/feeds/opml";
import { context } from "@/lib/server";

export async function GET() {
  const { db } = await context();
  const sources = await getSources(db);
  const xml = writeOpml(
    "Nova sources",
    sources.map((s) => ({ url: s.url, title: s.title, siteUrl: s.siteUrl, folder: s.folder })),
  );
  return new Response(xml, {
    headers: {
      "content-type": "text/x-opml; charset=utf-8",
      "content-disposition": 'attachment; filename="nova-sources.opml"',
      "cache-control": "private, no-store",
    },
  });
}
