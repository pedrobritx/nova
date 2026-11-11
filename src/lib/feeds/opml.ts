import { generateOpml, parseOpml } from "feedsmith";
import { cleanUrl } from "./url";

export type OpmlSource = { url: string; title: string | null; siteUrl: string | null; folder: string | null };

type Outline = { text?: string; title?: string; type?: string; xmlUrl?: string; htmlUrl?: string; outlines?: Outline[] };

/** Every feed in an OPML file, with the name of the folder it sat in. Duplicates are dropped. */
export function readOpml(xml: string): { title: string | null; sources: OpmlSource[] } {
  let doc: { head?: { title?: string }; body?: { outlines?: Outline[] } };
  try {
    doc = parseOpml(xml.trim()) as typeof doc;
  } catch {
    throw new Error("This file is not OPML. Export it again from your reader.");
  }
  const sources: OpmlSource[] = [];
  const seen = new Set<string>();
  const walk = (outlines: Outline[] | undefined, folder: string | null) => {
    for (const o of outlines ?? []) {
      const url = cleanUrl(o.xmlUrl);
      if (url) {
        if (!seen.has(url)) {
          seen.add(url);
          sources.push({ url, title: (o.title ?? o.text ?? "").trim() || null, siteUrl: cleanUrl(o.htmlUrl), folder });
        }
      } else if (o.outlines?.length) {
        // Nova's folders are flat: a nested group takes its own name, an unnamed one its parent's.
        const name = (o.title ?? o.text ?? "").trim() || folder;
        walk(o.outlines, name ? name.slice(0, 80) : null);
      }
    }
  };
  walk(doc.body?.outlines, null);
  return { title: doc.head?.title ?? null, sources };
}

export function writeOpml(title: string, sources: { url: string; title: string; siteUrl: string | null; folder: string | null }[]): string {
  const loose: Outline[] = [];
  const folders = new Map<string, Outline[]>();
  for (const s of sources) {
    const outline: Outline = { text: s.title, title: s.title, type: "rss", xmlUrl: s.url, ...(s.siteUrl ? { htmlUrl: s.siteUrl } : {}) };
    if (s.folder) {
      if (!folders.has(s.folder)) folders.set(s.folder, []);
      folders.get(s.folder)!.push(outline);
    } else loose.push(outline);
  }
  const outlines = [...[...folders].map(([name, children]) => ({ text: name, title: name, outlines: children })), ...loose];
  return generateOpml({ head: { title, dateCreated: new Date() }, body: { outlines } } as Parameters<typeof generateOpml>[0]);
}
