// Sample feeds for demo mode (NOVA_DEMO=1): fictional sources on reserved .example domains,
// written for Nova. Times are relative to when the demo starts, so Today always has stories.
// The set exercises merging: two items share a link, one is a word-for-word copy.

type Entry = { id: string; title: string; link: string; hoursAgo: number; author?: string; html: string; summary?: string };
export type DemoFeed = { url: string; folder: string | null; format: "rss" | "atom" | "json"; title: string; site: string; entries: Entry[] };

const p = (...paras: string[]) => paras.map((t) => `<p>${t}</p>`).join("");

const CTL_LINK = "https://openweb.example/2026/11/ctl-2-draft";
const CTL_TEXT = p(
  "The foundries behind the Common Type Licence have published a draft of version 2.0 and opened it for public comment until 15 December.",
  "The headline change is a clause on web delivery: tools that subset a font for a page, keeping only the characters it uses, no longer count as making a modified version. Under 1.1 that reading was disputed, and several foundries asked licensees to stop subsetting.",
  "The draft also shortens the attribution notice and adds a plain-language summary at the top. Comments go through the licence's public tracker, and the working group says it will publish every response.",
);
const PRICING_LINK = "https://ledger.example/joint-guidance-algorithmic-pricing";
const SLEEP_LINK = "https://fieldwork.example/notes/sleep-and-vocabulary";
const TESSERA_LINK = "https://kernelweekly.example/tessera-3";

export const DEMO_FEEDS: DemoFeed[] = [
  {
    url: "https://openweb.example/atom.xml", folder: "Web & design", format: "atom", title: "Open Web Dispatch", site: "https://openweb.example/",
    entries: [
      { id: "ow-ctl", title: "Common Type Licence 2.0 draft opens for public comment", link: CTL_LINK, hoursAgo: 5, author: "Sam Reyes", html: CTL_TEXT },
      { id: "ow-tessera", title: "Tessera 3.0 brings incremental sync to offline-first apps", link: TESSERA_LINK, hoursAgo: 2.2, author: "Sam Reyes",
        html: p("A short note: Kernel Weekly has the details on Tessera 3.0, whose incremental sync sends only the rows that changed since a device last connected.") },
      { id: "ow-anchor", title: "Anchor positioning reaches every major engine", link: "https://openweb.example/2026/11/anchor-positioning", hoursAgo: 27, author: "Mina Cho",
        html: p("With the last engine shipping it this week, CSS anchor positioning now works everywhere. Tooltips, menus and popovers can sit next to the element that opened them without a line of script.", "The specification also covers what happens near the edge of the screen: a fallback list lets the browser try another side when the first choice would be cut off.") },
    ],
  },
  {
    url: "https://typeandgrid.example/journal/feed.xml", folder: "Web & design", format: "rss", title: "Type & Grid", site: "https://typeandgrid.example/",
    entries: [
      { id: "tg-subset", title: "Common Type Licence revision: what changes for web subsetting", link: "https://typeandgrid.example/journal/ctl-subsetting", hoursAgo: 4.4, author: "Ines Okafor",
        summary: "A close reading of the subsetting clause.",
        html: p("Under the 1.1 wording, a subset could be read as a modified font, and a modified font must carry a new name. Nobody renames a font because a page dropped the glyphs it did not need, so most of the web was quietly out of step with the text.",
          "The 2.0 draft settles it: automated subsetting for delivery does not create a modified version. Hand-editing outlines still does, and so does merging two fonts into one file.",
          "Two details are worth checking before the team call. First, the clause covers subsetting “for delivery”, so a subset you then sell or redistribute is still a modified version. Second, the attribution notice can now live in the page's licence file rather than inside the font.") },
      { id: "tg-variable", title: "A field guide to variable fonts in long-form reading", link: "https://typeandgrid.example/journal/variable-long-form", hoursAgo: 3.0, author: "Ines Okafor",
        html: p("Variable fonts promise one file for every weight, but long-form reading asks for less than that: a comfortable text weight, a slightly heavier one for small sizes, and an optical size axis that the browser can drive on its own.", "Set font-optical-sizing to auto, keep the weight range narrow, and test at the sizes people actually read at: 17 to 20 pixels on a laptop, larger on a phone held further away.") },
      { id: "tg-optical", title: "Setting optical sizes for screen reading", link: "https://typeandgrid.example/journal/optical-sizes", hoursAgo: 75, author: "Ines Okafor",
        html: p("Optical sizes change letter shapes as text gets smaller: wider spacing, sturdier hairlines, larger counters. On screens they matter most below 14 pixels, where captions and labels live.") },
    ],
  },
  {
    url: "https://kernelweekly.example/feed.json", folder: "Web & design", format: "json", title: "Kernel Weekly", site: "https://kernelweekly.example/",
    entries: [
      { id: "kw-ctl", title: "CTL 2.0 draft is out; comments close 15 December", link: CTL_LINK, hoursAgo: 4.1,
        html: p("The Common Type Licence draft is open for comment. The useful part for developers: subsetting fonts for the web is explicitly allowed.") },
      { id: "kw-tessera", title: "Tessera 3.0 ships incremental sync for offline-first apps", link: TESSERA_LINK, hoursAgo: 2.5, author: "KW staff",
        html: p("Tessera 3.0 replaces whole-table sync with incremental sync. A device that reconnects after a week now downloads the rows that changed rather than the whole table, which the maintainers say cuts sync time on large tables by an order of magnitude.", "Conflict handling is unchanged: the last write wins per field, and apps can register a merge function for fields that need one.") },
    ],
  },
  {
    url: "https://planetfonts.example/rss", folder: "Web & design", format: "rss", title: "Planet Fonts", site: "https://planetfonts.example/",
    entries: [
      { id: "pf-ctl", title: "Common Type Licence 2.0 draft opens for public comment", link: "https://planetfonts.example/p/ctl-2-draft-opens", hoursAgo: 4.0, html: CTL_TEXT },
    ],
  },
  {
    url: "https://ledger.example/feed", folder: "Competition policy", format: "rss", title: "Antitrust Ledger", site: "https://ledger.example/",
    entries: [
      { id: "al-pricing", title: "Competition agencies publish joint guidance on algorithmic pricing", link: PRICING_LINK, hoursAgo: 3.4, author: "R. Almeida",
        html: p("Six competition agencies have published joint guidance on pricing software. The core message: using the same pricing tool as your competitors is not unlawful in itself, but feeding it competitors' non-public data, or agreeing to follow its recommendations, can amount to coordination.", "The guidance lists warning signs, including tools that pool confidential data across clients and contracts that penalise users for departing from suggested prices.") },
    ],
  },
  {
    url: "https://policybrief.example/rss.xml", folder: "Competition policy", format: "rss", title: "Policy Brief", site: "https://policybrief.example/",
    entries: [
      { id: "pb-pricing", title: "What the joint pricing guidance means for marketplaces", link: PRICING_LINK, hoursAgo: 1.5,
        html: p("A reading of this week's joint guidance from the marketplace side: platforms that recommend prices to their sellers should check where the recommendation's data comes from.") },
      { id: "pb-merger", title: "Merger review thresholds to be updated in the new year", link: "https://policybrief.example/merger-thresholds", hoursAgo: 52,
        html: p("Turnover thresholds for merger notification are due for their periodic update, with the consultation expected in January.") },
    ],
  },
  {
    url: "https://fieldwork.example/notes/rss", folder: "Languages", format: "rss", title: "Fieldwork", site: "https://fieldwork.example/",
    entries: [
      { id: "fw-sleep", title: "Sleep consolidates new vocabulary better than an extra review", link: SLEEP_LINK, hoursAgo: 2.9, author: "Fieldwork",
        html: p("Learners who studied a list of new words in the evening and slept before the test remembered more of them than learners who used the same time for one more review session.", "The gap was largest for words learned last, which suggests the night does more than rest: it strengthens what was still fragile.") },
    ],
  },
  {
    url: "https://lexicon.example/feed.xml", folder: "Languages", format: "rss", title: "Lexicon Notes", site: "https://lexicon.example/",
    entries: [
      { id: "ln-sleep", title: "Study, then sleep: the case for evening vocabulary", link: SLEEP_LINK, hoursAgo: 1.1,
        html: p("Fieldwork's summary of the sleep study is worth a read before you plan your next week of lessons.") },
    ],
  },
  {
    url: "https://cerradotimes.example/rss", folder: "Local", format: "rss", title: "Cerrado Times", site: "https://cerradotimes.example/",
    entries: [
      { id: "ct-bus", title: "Night bus routes return to the central axis from March", link: "https://cerradotimes.example/city/night-buses", hoursAgo: 20,
        html: p("Three night routes along the central axis will run again from March, every 40 minutes between midnight and five.") },
      { id: "ct-lake", title: "The lake path reopens after repairs", link: "https://cerradotimes.example/city/lake-path", hoursAgo: 30,
        html: p("The southern stretch of the lake path is open again after two months of repairs to the boardwalk.") },
    ],
  },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const at = (now: number, hours: number) => new Date(now - hours * 3_600_000);

/** Render a demo feed as the format it claims to be, so demo mode runs the real parser. */
export function renderDemoFeed(feed: DemoFeed, now = Date.now()): string {
  if (feed.format === "json") {
    return JSON.stringify({
      version: "https://jsonfeed.org/version/1.1", title: feed.title, home_page_url: feed.site, feed_url: feed.url,
      items: feed.entries.map((e) => ({ id: e.id, url: e.link, title: e.title, content_html: e.html, summary: e.summary, date_published: at(now, e.hoursAgo).toISOString(), authors: e.author ? [{ name: e.author }] : undefined })),
    });
  }
  if (feed.format === "atom") {
    const entries = feed.entries.map((e) => `<entry><id>${e.id}</id><title>${esc(e.title)}</title><link rel="alternate" href="${e.link}"/><published>${at(now, e.hoursAgo).toISOString()}</published>${e.author ? `<author><name>${esc(e.author)}</name></author>` : ""}<content type="html">${esc(e.html)}</content></entry>`).join("");
    return `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${esc(feed.title)}</title><link href="${feed.site}"/><id>${feed.url}</id>${entries}</feed>`;
  }
  const items = feed.entries.map((e) => `<item><title>${esc(e.title)}</title><link>${e.link}</link><guid isPermaLink="false">${e.id}</guid><pubDate>${at(now, e.hoursAgo).toUTCString()}</pubDate>${e.author ? `<dc:creator>${esc(e.author)}</dc:creator>` : ""}${e.summary ? `<description>${esc(e.summary)}</description>` : ""}<content:encoded><![CDATA[${e.html}]]></content:encoded></item>`).join("");
  return `<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>${esc(feed.title)}</title><link>${feed.site}</link>${items}</channel></rss>`;
}
