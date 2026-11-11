import { describe, expect, test } from "vitest";
import { contentHash, excerpt, firstImage, plainText, sanitizeContent } from "@/lib/feeds/content";
import { feedLinksInHtml } from "@/lib/feeds/discover";
import { readOpml, writeOpml } from "@/lib/feeds/opml";
import { looksLikeFeed, NotAFeed, parseFeedText } from "@/lib/feeds/parse";
import { cleanUrl, linkKey, normaliseInputUrl } from "@/lib/feeds/url";

const LONG = "Under the 1.1 wording, a subset could be read as a modified font. The draft says automated subsetting for delivery does not create a modified version.";

describe("links", () => {
  test("cleanUrl drops tracking parameters and fragments, keeps the rest", () => {
    expect(cleanUrl("https://ex.com/a?utm_source=x&id=3&fbclid=y#top")).toBe("https://ex.com/a?id=3");
    expect(cleanUrl("/b", "https://ex.com/a/")).toBe("https://ex.com/b");
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("not a url")).toBeNull();
  });

  test("linkKey treats scheme, www, slashes and parameter order as the same link", () => {
    const a = linkKey("http://www.Ex.com/news/story/?b=2&a=1&utm_medium=rss");
    const b = linkKey("https://ex.com/news/story?a=1&b=2");
    expect(a).toBe(b);
    expect(linkKey("https://ex.com/news/other")).not.toBe(b);
  });

  test("normaliseInputUrl accepts bare domains and rejects junk", () => {
    expect(normaliseInputUrl("typeandgrid.example/journal")).toBe("https://typeandgrid.example/journal");
    expect(normaliseInputUrl("http://ex.com")).toBe("http://ex.com/");
    expect(normaliseInputUrl("two words")).toBeNull();
    expect(normaliseInputUrl("ftp://ex.com")).toBeNull();
    expect(normaliseInputUrl("localhostish")).toBeNull();
  });
});

describe("content", () => {
  test("sanitising removes scripts, handlers, frames and tracking pixels", () => {
    const html = `<p onclick="x()">Hi <script>steal()</script><b>there</b></p><iframe src="https://evil"></iframe>
      <img src="/pixel.gif" width="1" height="1"><img src="/photo.jpg" alt="Photo" onerror="x()">
      <a href="/next?utm_campaign=z" style="color:red">Next</a><a href="javascript:alert(1)">Bad</a><h1>Big</h1>`;
    const out = sanitizeContent(html, "https://ex.com/post/")!;
    expect(out).not.toMatch(/script|steal|onclick|onerror|iframe|pixel|javascript|style=/);
    expect(out).toContain('<img src="https://ex.com/photo.jpg" alt="Photo" loading="lazy" decoding="async" referrerpolicy="no-referrer" />');
    expect(out).toContain('<a href="https://ex.com/next" rel="noopener noreferrer nofollow ugc" target="_blank">Next</a>');
    expect(out).toContain("<h2>Big</h2>");
  });

  test("plain text and excerpts decode entities and end on a word", () => {
    expect(plainText("<p>Fish &amp; chips&nbsp;&#8212; <em>today</em></p>")).toBe("Fish & chips — today");
    const e = excerpt(`<p>${"word ".repeat(100)}</p>`, 50)!;
    expect(e.endsWith("…")).toBe(true);
    expect(e.length).toBeLessThanOrEqual(51);
  });

  test("malformed character references never throw", () => {
    expect(plainText("A &#99999999; B &#x110000; C &#xD800; D &#0; E")).toBe("A \uFFFD B \uFFFD C \uFFFD D \uFFFD E");
    expect(plainText("&amp;#60; stays escaped once")).toBe("&#60; stays escaped once");
  });

  test("the fallback image is the decoded address, not the HTML-encoded one", () => {
    const html = sanitizeContent('<p>Photo</p><img src="https://cdn.example/i.jpg?w=600&signature=abc" alt="">', null)!;
    expect(html).toContain("w=600&amp;signature=abc");
    expect(firstImage(html)).toBe("https://cdn.example/i.jpg?w=600&signature=abc");
  });

  test("fingerprints ignore markup but need enough text", () => {
    expect(contentHash("Title", `<p>${LONG}</p>`)).toBe(contentHash("title", `<div>${LONG.toUpperCase()}</div>`));
    expect(contentHash("Title", `<p>${LONG}</p>`)).not.toBe(contentHash("Other", `<p>${LONG}</p>`));
    expect(contentHash("Weekly links", "<p>Short.</p>")).toBeNull();
  });
});

describe("parsing", () => {
  const now = new Date("2026-11-11T12:00:00Z");

  test("RSS 2.0 with content:encoded, enclosures and relative links", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <channel><title>Type &amp; Grid</title><link>https://typeandgrid.example/</link><description>Notes on type</description>
      <item><title>Subsetting, explained</title><link>/journal/subsetting?utm_source=rss</link><guid isPermaLink="false">tg-42</guid>
        <pubDate>Tue, 10 Nov 2026 07:48:00 GMT</pubDate><dc:creator>Ines Okafor</dc:creator>
        <description>Short summary.</description><content:encoded><![CDATA[<p>${LONG}</p><script>bad()</script>]]></content:encoded>
        <enclosure url="https://typeandgrid.example/cover.jpg" type="image/jpeg" length="1000"/></item>
      <item><title>From the future</title><link>https://typeandgrid.example/future</link><pubDate>Fri, 01 Jan 2027 00:00:00 GMT</pubDate></item>
      </channel></rss>`;
    const feed = parseFeedText(rss, "https://typeandgrid.example/feed.xml", now);
    expect(feed).toMatchObject({ format: "rss", title: "Type & Grid", siteUrl: "https://typeandgrid.example/", description: "Notes on type" });
    const [first, second] = feed.items;
    expect(first).toMatchObject({
      guid: "tg-42",
      url: "https://typeandgrid.example/journal/subsetting",
      linkKey: "typeandgrid.example/journal/subsetting",
      title: "Subsetting, explained",
      excerpt: "Short summary.",
      author: "Ines Okafor",
      imageUrl: "https://typeandgrid.example/cover.jpg",
      publishedAt: "2026-11-10T07:48:00.000Z",
    });
    expect(first.contentHtml).toContain(LONG);
    expect(first.contentHtml).not.toContain("bad()");
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(second.guid).toBe("https://typeandgrid.example/future");
    expect(second.publishedAt).toBe(new Date(now.getTime() - 1).toISOString());
  });

  test("undated items keep the feed's order", () => {
    const rss = `<rss version="2.0"><channel><title>T</title>${["a", "b", "c"].map((g) => `<item><title>${g}</title><guid>${g}</guid></item>`).join("")}</channel></rss>`;
    const times = parseFeedText(rss, "https://ex.com/rss", now).items.map((i) => Date.parse(i.publishedAt));
    expect(times[0]).toBeGreaterThan(times[1]);
    expect(times[1]).toBeGreaterThan(times[2]);
  });

  test("Atom with alternate links and HTML content", () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Open Web Dispatch</title>
      <link rel="self" href="https://ow.example/atom.xml"/><link href="https://ow.example/"/>
      <entry><id>tag:ow.example,2026:ctl</id><title type="html">CTL 2.0 &amp;amp; you</title>
        <link rel="alternate" href="https://ow.example/ctl-2"/><published>2026-11-10T07:12:00Z</published><updated>2026-11-10T09:00:00Z</updated>
        <author><name>Sam Reyes</name></author><content type="html">&lt;p&gt;${LONG}&lt;/p&gt;</content></entry></feed>`;
    const feed = parseFeedText(atom, "https://ow.example/atom.xml", now);
    expect(feed.format).toBe("atom");
    expect(feed.siteUrl).toBe("https://ow.example/");
    expect(feed.items[0]).toMatchObject({ guid: "tag:ow.example,2026:ctl", url: "https://ow.example/ctl-2", author: "Sam Reyes", publishedAt: "2026-11-10T07:12:00.000Z" });
    expect(feed.items[0].title).toContain("CTL 2.0");
  });

  test("JSON Feed 1.1", () => {
    const json = JSON.stringify({
      version: "https://jsonfeed.org/version/1.1", title: "Kernel Weekly", home_page_url: "https://kw.example/",
      items: [{ id: "kw-7", url: "https://kw.example/7", title: "Tessera 3.0", content_text: "Plain & simple", date_published: "2026-11-10T10:15:00Z", authors: [{ name: "KW" }] }],
    });
    const feed = parseFeedText(json, "https://kw.example/feed.json", now);
    expect(feed.format).toBe("json");
    expect(feed.items[0]).toMatchObject({ guid: "kw-7", title: "Tessera 3.0", contentHtml: "<p>Plain &amp; simple</p>", author: "KW" });
  });

  test("one malformed item does not stop the rest of the feed", () => {
    const json = JSON.stringify({
      version: "https://jsonfeed.org/version/1.1", title: "Kernel Weekly", home_page_url: "https://kw.example/",
      items: [
        { id: "bad", url: "https://kw.example/bad", title: "Broken &#99999999; headline", content_html: "<p>Text</p>" },
        { id: "ok", url: "https://kw.example/ok", title: "Fine headline", content_html: '<img src="https://kw.example/a.jpg?w=1&amp;h=2">' },
      ],
    });
    const feed = parseFeedText(json, "https://kw.example/feed.json", now);
    expect(feed.items.map((i) => i.guid)).toEqual(["bad", "ok"]);
    expect(feed.items[0].title).toBe("Broken \uFFFD headline");
    expect(feed.items[1].imageUrl).toBe("https://kw.example/a.jpg?w=1&h=2");
  });

  test("RSS 1.0 (RDF)", () => {
    const rdf = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <channel rdf:about="https://old.example/"><title>Old School</title><link>https://old.example/</link></channel>
      <item rdf:about="https://old.example/1"><title>First</title><link>https://old.example/1</link><dc:date>2026-11-09T08:00:00Z</dc:date></item></rdf:RDF>`;
    const feed = parseFeedText(rdf, "https://old.example/index.rdf", now);
    expect(feed.format).toBe("rdf");
    expect(feed.items[0]).toMatchObject({ url: "https://old.example/1", publishedAt: "2026-11-09T08:00:00.000Z" });
  });

  test("web pages are not feeds", () => {
    expect(() => parseFeedText("<!doctype html><html><body>Hi</body></html>", "https://ex.com/")).toThrow(NotAFeed);
    expect(looksLikeFeed("text/html", "<!doctype html><html>")).toBe(false);
    expect(looksLikeFeed("text/plain", '<?xml version="1.0"?>\n<rss version="2.0">')).toBe(true);
    expect(looksLikeFeed("application/json", "{}")).toBe(false);
  });
});

describe("discovery and OPML", () => {
  test("finds feeds a page declares, ignoring comment feeds", () => {
    const html = `<html><head>
      <link rel="alternate" type="application/rss+xml" title="Journal" href="/journal/feed.xml">
      <link rel="alternate" type="application/rss+xml" title="Comments" href="/comments/feed">
      <link rel='alternate' type='application/atom+xml' href='https://cdn.example/atom.xml'>
      <link rel="stylesheet" href="/a.css"></head></html>`;
    expect(feedLinksInHtml(html, "https://typeandgrid.example/")).toEqual([
      { url: "https://typeandgrid.example/journal/feed.xml", title: "Journal" },
      { url: "https://cdn.example/atom.xml", title: null },
    ]);
  });

  test("reads nested OPML folders and drops duplicates", () => {
    const opml = `<?xml version="1.0"?><opml version="2.0"><head><title>Mine</title></head><body>
      <outline text="Web &amp; design"><outline type="rss" text="OW" xmlUrl="https://ow.example/atom.xml" htmlUrl="https://ow.example/"/>
        <outline text="Type"><outline type="rss" text="TG" xmlUrl="https://typeandgrid.example/feed.xml"/></outline></outline>
      <outline type="rss" text="Solo" xmlUrl="https://solo.example/rss"/><outline type="rss" text="OW again" xmlUrl="https://ow.example/atom.xml"/>
      <outline type="rss" text="Bad" xmlUrl="javascript:x"/></body></opml>`;
    const { title, sources } = readOpml(opml);
    expect(title).toBe("Mine");
    expect(sources).toEqual([
      { url: "https://ow.example/atom.xml", title: "OW", siteUrl: "https://ow.example/", folder: "Web & design" },
      { url: "https://typeandgrid.example/feed.xml", title: "TG", siteUrl: null, folder: "Type" },
      { url: "https://solo.example/rss", title: "Solo", siteUrl: null, folder: null },
    ]);
    expect(() => readOpml("<html></html>")).toThrow(/not OPML/);
  });

  test("writes OPML that reads back the same", () => {
    const sources = [
      { url: "https://ow.example/atom.xml", title: "OW", siteUrl: "https://ow.example/", folder: "Web" },
      { url: "https://solo.example/rss", title: "Solo & Co", siteUrl: null, folder: null },
    ];
    const back = readOpml(writeOpml("Nova", sources)).sources;
    expect(back).toEqual(sources);
  });
});
