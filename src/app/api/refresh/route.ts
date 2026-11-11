import { timingSafeEqual } from "node:crypto";
import { refreshDue } from "@/lib/refresh";
import { fetcherDb } from "@/lib/server";

// Called every 15 minutes by Supabase Cron (pg_cron + pg_net); see supabase/schedule.sql.
// Vercel's Hobby plan only runs its own cron jobs once a day, which is too slow for feeds.
export const maxDuration = 60;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length < 32) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const result = await refreshDue(await fetcherDb(), { limit: 60, budgetMs: 50_000, concurrency: 8 });
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
