"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/data";
import { supabaseConfigured, supabaseForRequest } from "@/lib/db/supabase";
import type { FoundFeed } from "@/lib/feeds/discover";
import { findFeeds, follow, importOpml, type ImportResult } from "@/lib/library";
import { MAX_OPML_BYTES, OPML_TOO_LARGE } from "@/lib/limits";
import { refreshDue } from "@/lib/refresh";
import { context } from "@/lib/server";

// Every action re-reads the session through context(): the client is never trusted to say who
// it is, and the database's row-level security checks every change again.

const ids = (list: unknown): string[] => (Array.isArray(list) ? list.filter((v): v is string => typeof v === "string" && isUuid(v)).slice(0, 500) : []);

export async function markRead(itemIds: string[]): Promise<void> {
  const { db } = await context();
  const list = ids(itemIds);
  if (list.length) await db.rpc("nova_mark_read", { p_items: list });
  refresh();
}

export async function markUnread(itemIds: string[]): Promise<void> {
  const { db } = await context();
  const list = ids(itemIds);
  if (list.length) await db.rpc("nova_mark_unread", { p_items: list });
  refresh();
}

export async function markAllRead(formData: FormData): Promise<void> {
  const { db } = await context();
  const story = String(formData.get("story") ?? "");
  const folder = String(formData.get("folder") ?? "");
  const feed = String(formData.get("feed") ?? "");
  await db.rpc("nova_mark_all_read", {
    p_story: isUuid(story) ? story : null,
    p_folder: isUuid(folder) ? folder : null,
    p_feed: isUuid(feed) ? feed : null,
  });
  refresh();
}

export type FindState = { input: string; feeds?: FoundFeed[]; error?: string } | null;

export async function findSource(_prev: FindState, formData: FormData): Promise<FindState> {
  await context();
  const input = String(formData.get("address") ?? "").slice(0, 2000);
  const found = await findFeeds(input);
  return found.ok ? { input, feeds: found.feeds } : { input, error: found.error };
}

export type FollowState = { error?: string } | null;

export async function followFeed(_prev: FollowState, formData: FormData): Promise<FollowState> {
  const { db, service } = await context();
  const url = String(formData.get("feed") ?? "");
  const folder = String(formData.get("folder") ?? "").trim().slice(0, 80) || null;
  const result = await follow(db, service, url, folder);
  if (!result.ok) return { error: result.error };
  redirect(`/sources?added=${result.feedId}`);
}

export type ImportState = { result?: ImportResult; error?: string } | null;

export async function importFeeds(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { db, service } = await context();
  const file = formData.get("opml");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an OPML file first" };
  if (file.size > MAX_OPML_BYTES) return { error: OPML_TOO_LARGE };
  try {
    const result = await importOpml(db, service, await file.text());
    refresh();
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nova could not import that file" };
  }
}

export async function moveSource(formData: FormData): Promise<void> {
  const { db } = await context();
  const sub = String(formData.get("subscription") ?? "");
  if (!isUuid(sub)) return;
  const folder = String(formData.get("folder") ?? "").trim().slice(0, 80);
  await db.rpc("nova_move_source", { p_subscription: sub, p_folder_name: folder || null });
  refresh();
}

export async function unfollow(formData: FormData): Promise<void> {
  const { db } = await context();
  const sub = String(formData.get("subscription") ?? "");
  if (isUuid(sub)) await db.rpc("nova_unfollow", { p_subscription: sub });
  redirect("/sources");
}

export type RefreshState = { message: string } | null;

/** Fetch whatever is due now. Only scheduled feeds are fetched, so pressing it often costs nothing. */
export async function refreshNow(): Promise<RefreshState> {
  const { service } = await context();
  const run = await refreshDue(service, { limit: 20, budgetMs: 20_000 });
  refresh();
  if (!run.claimed) return { message: "Everything is up to date" };
  return { message: run.newItems ? `${run.newItems} new ${run.newItems === 1 ? "item" : "items"}` : "No new items" };
}

export async function signOut(): Promise<void> {
  if (supabaseConfigured()) {
    const supabase = await supabaseForRequest();
    await supabase.auth.signOut();
  }
  redirect("/sign-in");
}
