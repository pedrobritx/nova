"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Download, Inbox, Layers, Plus, RefreshCw, Rss, Settings, Star, Trash2, Upload } from "lucide-react";
import { NovaMark } from "@/components/mark";
import { deleteRow, readAll, writeMany } from "@/lib/guest/storage";
import type { GuestItem, GuestPreference, GuestSource } from "@/lib/guest/types";

type Tab = "today" | "latest" | "saved" | "sources" | "settings";
type FeedSummary = { url: string; title: string; siteUrl: string | null };
type ParsedFeedResponse = {
  url: string;
  feed: {
    title: string;
    siteUrl: string | null;
    items: Array<{
      guid: string; linkKey: string | null; url: string | null; title: string;
      excerpt: string | null; contentHtml: string | null; author: string | null;
      imageUrl: string | null; publishedAt: string;
    }>;
  };
};

async function requestFeed<T>(action: "discover" | "feed", url: string): Promise<T> {
  const response = await fetch("/api/guest/feeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, url }),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    const error = json as { error?: string };
    throw new Error(error.error || "Could not read the feed");
  }
  return json as T;
}

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]!);
}

function downloadFile(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function opml(sources: GuestSource[]): string {
  const groups = new Map<string, GuestSource[]>();
  for (const source of sources) {
    const key = source.folder || "";
    groups.set(key, [...(groups.get(key) || []), source]);
  }
  const item = (source: GuestSource, indent: string) =>
    `${indent}<outline text="${xmlEscape(source.title)}" title="${xmlEscape(source.title)}" type="rss" xmlUrl="${xmlEscape(source.url)}"${source.siteUrl ? ` htmlUrl="${xmlEscape(source.siteUrl)}"` : ""} />`;
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<opml version="2.0">', '  <head><title>Nova Guest subscriptions</title></head>', '  <body>'];
  for (const [folder, entries] of groups) {
    if (folder) {
      lines.push(`    <outline text="${xmlEscape(folder)}" title="${xmlEscape(folder)}">`);
      entries.forEach((source) => lines.push(item(source, "      ")));
      lines.push('    </outline>');
    } else {
      entries.forEach((source) => lines.push(item(source, "    ")));
    }
  }
  lines.push('  </body>', '</opml>');
  return lines.join("\n");
}

function tabLabel(tab: Tab): string {
  return ({ today: "Today", latest: "Latest", saved: "Read later", sources: "Sources", settings: "Settings" })[tab];
}

export default function GuestPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [sources, setSources] = useState<GuestSource[]>([]);
  const [items, setItems] = useState<GuestItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [ready, setReady] = useState(false);
  const [todayCutoff, setTodayCutoff] = useState(0);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [address, setAddress] = useState("");
  const [discovered, setDiscovered] = useState<FeedSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<GuestItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refreshing = useRef(false);

  const refresh = useCallback(async (selectedSources: GuestSource[]) => {
    if (refreshing.current || !selectedSources.length) return;
    refreshing.current = true;
    setBusy(true);
    setMessage(null);
    let failures = 0;
    try {
      const updatedSources: GuestSource[] = [];
      const downloaded: GuestItem[] = [];
      // Limit parallel unauthenticated fetch requests; avoid a burst for large OPML libraries.
      for (let start = 0; start < selectedSources.length; start += 3) {
        const batch = selectedSources.slice(start, start + 3);
        const responses = await Promise.all(batch.map(async (source) => {
          try {
            const { feed } = await requestFeed<ParsedFeedResponse>("feed", source.url);
            return { source, feed, error: null as string | null };
          } catch (error) {
            return { source, feed: null, error: error instanceof Error ? error.message : "Feed unavailable" };
          }
        }));
        for (const result of responses) {
          if (!result.feed) {
            failures++;
            updatedSources.push({ ...result.source, error: result.error });
            continue;
          }
          updatedSources.push({ ...result.source, title: result.feed.title || result.source.title, siteUrl: result.feed.siteUrl, refreshedAt: new Date().toISOString(), error: null });
          for (const entry of result.feed.items) {
            downloaded.push({
              key: `${result.source.url}::${entry.guid}`, feedUrl: result.source.url,
              guid: entry.guid, linkKey: entry.linkKey, url: entry.url,
              title: entry.title, excerpt: entry.excerpt, contentHtml: entry.contentHtml,
              author: entry.author, imageUrl: entry.imageUrl, publishedAt: entry.publishedAt,
              read: false, saved: false,
            });
          }
        }
      }
      // Re-read flags immediately before writing so a refresh preserves read/saved state.
      const priorItems = await readAll<GuestItem>("items");
      const oldByKey = new Map(priorItems.map((item) => [item.key, item]));
      const merged = downloaded.map((item) => {
        const old = oldByKey.get(item.key);
        return { ...item, read: old?.read ?? false, saved: old?.saved ?? false };
      });
      await writeMany("items", merged);
      await writeMany("sources", updatedSources);
      // Read storage back instead of using stale React closures.
      setSources(await readAll<GuestSource>("sources"));
      setItems(await readAll<GuestItem>("items"));
      if (failures) setMessage(`${failures} source${failures === 1 ? "" : "s"} could not be refreshed. Existing articles are preserved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save downloaded articles");
    } finally {
      refreshing.current = false;
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [loadedSources, loadedItems, preferences] = await Promise.all([
          readAll<GuestSource>("sources"), readAll<GuestItem>("items"), readAll<GuestPreference>("preferences"),
        ]);
        if (!mounted) return;
        setSources(loadedSources);
        setItems(loadedItems);
        setUnreadOnly(preferences.find((entry) => entry.key === "unreadOnly")?.value === "true");
        setReady(true);
        if (loadedSources.length) void refresh(loadedSources);
      } catch (error) {
        if (mounted) { setReady(true); setMessage(error instanceof Error ? error.message : "Local storage is not available"); }
      }
    }
    void load();
    return () => { mounted = false; };
  }, [refresh]);

  useEffect(() => { setTodayCutoff(Date.now() - 48 * 60 * 60 * 1000); }, []);

  const visibleItems = useMemo(() => {
    const followed = new Set(sources.map((source) => source.url));
    const twoDaysAgo = todayCutoff;
    return items.filter((item) =>
      followed.has(item.feedUrl) &&
      (!unreadOnly || !item.read) &&
      (tab !== "saved" || item.saved) &&
      (tab !== "today" || Date.parse(item.publishedAt) >= twoDaysAgo),
    ).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  }, [items, sources, tab, unreadOnly, todayCutoff]);

  const sourceByUrl = useMemo(() => new Map(sources.map((source) => [source.url, source])), [sources]);
  const unreadCount = items.filter((item) => !item.read && sourceByUrl.has(item.feedUrl)).length;

  async function toggleItem(item: GuestItem, field: "read" | "saved", value = !item[field]) {
    const updated = { ...item, [field]: value };
    await writeMany("items", [updated]);
    setItems((all) => all.map((entry) => entry.key === item.key ? updated : entry));
    setSelected((current) => current?.key === item.key ? updated : current);
  }

  async function discover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address.trim()) return;
    setAdding(true);
    setDiscovered([]);
    setMessage(null);
    try {
      const result = await requestFeed<{ feeds: FeedSummary[] }>("discover", address.trim());
      if (!result.feeds.length) throw new Error("No RSS, Atom or JSON feed was found at that address.");
      setDiscovered(result.feeds);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Discovery failed"); }
    finally { setAdding(false); }
  }

  async function follow(feed: FeedSummary) {
    if (sources.some((source) => source.url === feed.url)) {
      setMessage("You already follow this source.");
      return;
    }
    const newSource: GuestSource = {
      url: feed.url, title: feed.title, siteUrl: feed.siteUrl,
      folder: null, addedAt: new Date().toISOString(), refreshedAt: null, error: null,
    };
    await writeMany("sources", [newSource]);
    setSources((old) => [...old, newSource]);
    setDiscovered((old) => old.filter((entry) => entry.url !== feed.url));
    setAddress("");
    setMessage(`Following ${feed.title}.`);
    void refresh([newSource]);
  }

  async function removeSource(source: GuestSource) {
    if (!confirm(`Unfollow ${source.title}? Its local articles will also be deleted.`)) return;
    await deleteRow("sources", source.url);
    const associated = items.filter((item) => item.feedUrl === source.url);
    for (const item of associated) await deleteRow("items", item.key);
    setSources((all) => all.filter((entry) => entry.url !== source.url));
    setItems((all) => all.filter((entry) => entry.feedUrl !== source.url));
  }

  async function changeFolder(source: GuestSource, folder: string) {
    const updated = { ...source, folder: folder.trim() || null };
    await writeMany("sources", [updated]);
    setSources((all) => all.map((entry) => entry.url === source.url ? updated : entry));
  }

  async function changeUnreadOnly(value: boolean) {
    setUnreadOnly(value);
    try { await writeMany("preferences", [{ key: "unreadOnly", value: String(value) }]); }
    catch { setMessage("The display preference could not be saved."); }
  }

  async function importOpml(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(null);
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error("OPML file is too large");
      const xml = new DOMParser().parseFromString(await file.text(), "text/xml");
      if (xml.querySelector("parsererror")) throw new Error("This is not a valid OPML document");
      const current = new Set(sources.map((source) => source.url));
      const incoming: GuestSource[] = [];
      for (const node of Array.from(xml.getElementsByTagName("outline"))) {
        const url = node.getAttribute("xmlUrl");
        if (!url || current.has(url)) continue;
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) continue;
        current.add(url);
        const parent = node.parentElement?.tagName.toLowerCase() === "outline" ? node.parentElement : null;
        incoming.push({ url, title: node.getAttribute("title") || node.getAttribute("text") || parsed.hostname, siteUrl: node.getAttribute("htmlUrl"), folder: parent?.getAttribute("title") || parent?.getAttribute("text") || null, addedAt: new Date().toISOString(), refreshedAt: null, error: null });
      }
      await writeMany("sources", incoming);
      setSources((all) => [...all, ...incoming]);
      setMessage(`Imported ${incoming.length} new source${incoming.length === 1 ? "" : "s"}. Select Refresh to load articles.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import OPML"); }
    finally { event.target.value = ""; }
  }

  return (
    <div className="guest-shell nv2-above">
      <aside className="guest-side nv2-glass" aria-label="Guest library">
        <Link className="guest-brand" href="/guest"><NovaMark size={32} /><strong>Nova</strong><span className="guest-tag">Guest</span></Link>
        <nav className="guest-nav" aria-label="Reading views">
          <GuestNavButton active={tab === "today"} icon={<Layers size={18} />} label="Today" onClick={() => { setTab("today"); setSelected(null); }} />
          <GuestNavButton active={tab === "latest"} icon={<Inbox size={18} />} label={`Latest (${unreadCount})`} onClick={() => { setTab("latest"); setSelected(null); }} />
          <GuestNavButton active={tab === "saved"} icon={<Star size={18} />} label="Read later" onClick={() => { setTab("saved"); setSelected(null); }} />
          <GuestNavButton active={tab === "sources"} icon={<Rss size={18} />} label={`Sources (${sources.length})`} onClick={() => { setTab("sources"); setSelected(null); }} />
          <GuestNavButton active={tab === "settings"} icon={<Settings size={18} />} label="Settings" onClick={() => { setTab("settings"); setSelected(null); }} />
        </nav>
        <div className="guest-side-foot"><Link href="/sign-in">Sign in to sync</Link><small>Local to this browser</small></div>
      </aside>

      <main className="guest-main" id="main">
        <header className="guest-header">
          <div><h1 className="t-page">{selected ? "Reader" : tabLabel(tab)}</h1><p className="t-meta t-muted">Guest mode · Data saved on this device</p></div>
          <div className="guest-tools">
            <button type="button" className="guest-button" disabled={busy || !sources.length} onClick={() => void refresh(sources)}>
              <RefreshCw size={17} aria-hidden="true" /> {busy ? "Refreshing…" : "Refresh"}
            </button>
            <Link className="guest-button" href="/sign-in">Sign in</Link>
          </div>
        </header>
        {message && <div className="guest-message" role="status">{message}</div>}
        {!ready && <p className="t-body">Loading your local library…</p>}

        {ready && selected && (
          <article className="guest-article nv2-tile">
            <button className="guest-button" onClick={() => setSelected(null)}>← Back</button>
            <h2>{selected.title}</h2>
            <p className="t-meta t-muted">{sourceByUrl.get(selected.feedUrl)?.title} · {new Date(selected.publishedAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</p>
            <div className="guest-reader-content" dangerouslySetInnerHTML={{ __html: selected.contentHtml || "" }} />
            {!selected.contentHtml && <p>{selected.excerpt || "The feed did not include the full article."}</p>}
            {selected.url && <a className="guest-button" href={selected.url} target="_blank" rel="noopener noreferrer">Open original article</a>}
          </article>
        )}

        {ready && !selected && tab === "sources" && (
          <section className="guest-section">
            <div className="guest-panel nv2-tile">
              <h2 className="t-section">Follow a website or feed</h2>
              <form className="guest-add" onSubmit={(event) => void discover(event)}>
                <input className="guest-input" type="url" required placeholder="https://example.com/feed.xml" value={address} onChange={(event) => setAddress(event.target.value)} aria-label="Website or feed address" />
                <button className="guest-button guest-primary" type="submit" disabled={adding}><Plus size={17} />{adding ? "Finding…" : "Find feeds"}</button>
              </form>
              {discovered.map((feed) => (
                <div key={feed.url} className="guest-discovered"><span><strong>{feed.title}</strong><small>{feed.url}</small></span><button className="guest-button" onClick={() => void follow(feed)}>Follow</button></div>
              ))}
            </div>
            <div className="guest-section-heading"><h2 className="t-section">Subscriptions</h2><div className="guest-tools"><button className="guest-button" onClick={() => fileRef.current?.click()}><Upload size={16} /> Import OPML</button><button className="guest-button" disabled={!sources.length} onClick={() => downloadFile("nova-guest.opml", opml(sources), "text/xml;charset=utf-8")}><Download size={16} /> Export OPML</button></div></div>
            <input ref={fileRef} className="guest-hidden" type="file" accept=".opml,.xml,text/xml,application/xml" onChange={(event) => void importOpml(event)} aria-label="Choose OPML file" />
            {!sources.length && <p className="t-body t-muted">No subscriptions yet. Add a feed or import an OPML file.</p>}
            {sources.map((source) => (
              <div className="guest-source nv2-tile" key={source.url}>
                <div className="guest-source-details"><strong>{source.title}</strong><small>{source.url}</small>{source.error && <small role="status">Last error: {source.error}</small>}</div>
                <label className="guest-folder">Folder<input className="guest-input" defaultValue={source.folder || ""} key={`${source.url}-${source.folder || ""}`} placeholder="Uncategorised" onBlur={(event) => void changeFolder(source, event.target.value)} /></label>
                <button className="guest-icon-button" aria-label={`Unfollow ${source.title}`} title="Unfollow" onClick={() => void removeSource(source)}><Trash2 size={18} /></button>
              </div>
            ))}
          </section>
        )}

        {ready && !selected && tab === "settings" && (
          <section className="guest-panel nv2-tile guest-settings">
            <h2 className="t-section">Local library</h2>
            <p>Your subscriptions, articles, read history and preferences are saved in this browser using IndexedDB, not in your Supabase account.</p>
            <label className="guest-checkbox"><input type="checkbox" checked={unreadOnly} onChange={(event) => void changeUnreadOnly(event.target.checked)} /> Show only unread articles</label>
            <button className="guest-button" onClick={() => downloadFile("nova-guest.opml", opml(sources), "text/xml;charset=utf-8")}><Download size={16} /> Export subscriptions</button>
            <p className="t-meta t-muted">Clearing this site's data, using private browsing, or removing the browser profile can delete your local library. Export OPML regularly. To sync across devices, sign in and import your OPML file into your account.</p>
            <Link className="guest-button guest-primary" href="/sign-in">Sign in to sync</Link>
          </section>
        )}

        {ready && !selected && (tab === "today" || tab === "latest" || tab === "saved") && (
          <section className="guest-section">
            <div className="guest-section-heading"><h2 className="t-section">{tab === "saved" ? "Saved articles" : tab === "today" ? "Recent stories" : "All articles"}</h2><span className="t-meta">{visibleItems.length} articles</span></div>
            {!sources.length && <div className="guest-panel nv2-tile"><p>No sources yet. Follow your favourite websites to start reading.</p><button className="guest-button guest-primary" onClick={() => setTab("sources")}><Rss size={16} /> Add a source</button></div>}
            {sources.length > 0 && visibleItems.length === 0 && <div className="guest-panel nv2-tile"><p>Nothing to show here yet. Try another view or refresh your sources.</p></div>}
            <div className="guest-list">
              {visibleItems.map((item) => (
                <article className={`guest-story nv2-tile ${item.read ? "guest-read" : ""}`} key={item.key}>
                  <div className="guest-story-main"><p className="t-meta t-muted">{sourceByUrl.get(item.feedUrl)?.title || "Feed"} · {new Date(item.publishedAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</p>
                    <button className="guest-story-title" onClick={() => { setSelected(item); if (!item.read) void toggleItem(item, "read", true); }}>{item.title}</button>
                    {item.excerpt && <p className="guest-excerpt">{item.excerpt}</p>}</div>
                  <div className="guest-story-tools">
                    <button className="guest-button" onClick={() => void toggleItem(item, "read")} aria-label={item.read ? "Mark unread" : "Mark read"}>{item.read ? "Mark unread" : "Mark read"}</button>
                    <button className="guest-button" onClick={() => void toggleItem(item, "saved")} aria-label={item.saved ? "Remove from read later" : "Save for later"}><Star size={16} fill={item.saved ? "currentColor" : "none"} />{item.saved ? "Saved" : "Save"}</button>
                    {item.url && <a className="guest-button" target="_blank" rel="noopener noreferrer" href={item.url} onClick={() => { if (!item.read) void toggleItem(item, "read", true); }}>Original</a>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
      <nav className="guest-bottom nv2-glass" aria-label="Mobile reading views">
        {(["today", "latest", "saved", "sources", "settings"] as const).map((entry) => <button type="button" key={entry} aria-current={tab === entry ? "page" : undefined} onClick={() => { setTab(entry); setSelected(null); }}>{tabLabel(entry)}</button>)}
      </nav>
    </div>
  );
}

function GuestNavButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick(): void }) {
  return <button type="button" className={`guest-nav-button ${active ? "guest-active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}>{icon}<span>{label}</span></button>;
}