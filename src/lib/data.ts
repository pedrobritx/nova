import "server-only";
import type { Db } from "./db/types";

// Typed reads over the nova_* SQL functions. Rows arrive in snake_case; pages get camelCase.

export type StoryCard = {
  id: string;
  title: string;
  lastItemAt: string;
  sourceCount: number;
  unreadCount: number;
  leadItemId: string;
  leadUrl: string | null;
  excerpt: string | null;
  imageUrl: string | null;
  leadSource: string;
  folder: string | null;
  sources: string[];
};

export type ItemRow = {
  id: string;
  storyId: string | null;
  title: string;
  url: string | null;
  excerpt: string | null;
  imageUrl: string | null;
  publishedAt: string;
  feedId: string;
  source: string;
  folder: string | null;
  isRead: boolean;
  storySize: number;
  mergedBy: "link" | "copy" | null;
};

export type StoryDetail = {
  id: string;
  title: string;
  items: (ItemRow & { contentLength: number })[];
};

export type Reading = ItemRow & { author: string | null; contentHtml: string | null; siteUrl: string | null };

export type Source = {
  subscriptionId: string;
  feedId: string;
  title: string;
  url: string;
  siteUrl: string | null;
  folderId: string | null;
  folder: string | null;
  lastSuccessAt: string | null;
  errorCount: number;
  lastError: string | null;
  itemsThisWeek: number;
  unread: number;
};

export type Folder = { id: string; name: string; unread: number; sources: number };

type R = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
const n = (v: unknown) => Number(v ?? 0);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

export async function getToday(db: Db, folderId: string | null = null): Promise<StoryCard[]> {
  const rows = await db.rpc<R>("nova_today", { p_limit: 40, p_folder: folderId });
  return rows.map((r) => ({
    id: String(r.story_id),
    title: String(r.title),
    lastItemAt: iso(r.last_item_at),
    sourceCount: n(r.source_count),
    unreadCount: n(r.unread_count),
    leadItemId: String(r.lead_item_id),
    leadUrl: s(r.lead_url),
    excerpt: s(r.lead_excerpt),
    imageUrl: s(r.lead_image_url),
    leadSource: String(r.lead_feed_title),
    folder: s(r.folder_name),
    sources: ((r.sources as string[] | null) ?? []).filter(Boolean),
  }));
}

function item(r: R): ItemRow {
  return {
    id: String(r.item_id),
    storyId: s(r.story_id),
    title: String(r.title),
    url: s(r.url),
    excerpt: s(r.excerpt),
    imageUrl: s(r.image_url),
    publishedAt: iso(r.published_at),
    feedId: String(r.feed_id),
    source: String(r.feed_title),
    folder: s(r.folder_name),
    isRead: Boolean(r.is_read),
    storySize: n(r.story_size ?? 1),
    mergedBy: (s(r.merged_by) as ItemRow["mergedBy"]) ?? null,
  };
}

export async function getLatest(db: Db, opts: { before?: string | null; folderId?: string | null; feedId?: string | null; unreadOnly?: boolean } = {}): Promise<ItemRow[]> {
  const rows = await db.rpc<R>("nova_latest", {
    p_limit: 60, p_before: opts.before ?? null, p_folder: opts.folderId ?? null, p_feed: opts.feedId ?? null, p_unread_only: opts.unreadOnly ?? false,
  });
  return rows.map(item);
}

export async function getStory(db: Db, storyId: string): Promise<StoryDetail | null> {
  const rows = await db.rpc<R>("nova_story", { p_story: storyId });
  if (!rows.length) return null;
  return { id: storyId, title: String(rows[0].story_title), items: rows.map((r) => ({ ...item(r), contentLength: n(r.content_length) })) };
}

export async function getItem(db: Db, itemId: string): Promise<Reading | null> {
  const [r] = await db.rpc<R>("nova_item", { p_item: itemId });
  if (!r) return null;
  return { ...item(r), author: s(r.author), contentHtml: s(r.content_html), siteUrl: s(r.site_url) };
}

export async function getSources(db: Db): Promise<Source[]> {
  const rows = await db.rpc<R>("nova_sources");
  return rows.map((r) => ({
    subscriptionId: String(r.subscription_id),
    feedId: String(r.feed_id),
    title: String(r.title),
    url: String(r.url),
    siteUrl: s(r.site_url),
    folderId: s(r.folder_id),
    folder: s(r.folder_name),
    lastSuccessAt: r.last_success_at ? iso(r.last_success_at) : null,
    errorCount: n(r.error_count),
    lastError: s(r.last_error),
    itemsThisWeek: n(r.items_this_week),
    unread: n(r.unread),
  }));
}

export async function getFolders(db: Db): Promise<{ folders: Folder[]; unreadTotal: number }> {
  const [rows, total] = await Promise.all([db.rpc<R>("nova_folders"), db.rpc<R>("nova_unread_total")]);
  return {
    folders: rows.map((r) => ({ id: String(r.folder_id), name: String(r.name), unread: n(r.unread), sources: n(r.sources) })),
    unreadTotal: n(total[0]?.nova_unread_total),
  };
}

export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
