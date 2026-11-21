import { NextResponse } from "next/server";
import { discoverFeeds } from "@/lib/feeds/discover";
import { safeFetch } from "@/lib/feeds/net";
import { looksLikeFeed, NotAFeed, parseFeedText } from "@/lib/feeds/parse";

// Additional best-effort protection against bursts on the same server instance.
// This is NOT a distributed limit: production also needs a platform-level per-IP rule.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 90;
const requestsByIp = new Map<string, { count: number; resetAt: number }>();

function rateLimited(request: Request): boolean {
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for");
  const key = forwarded?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  if (requestsByIp.size > 2_000) {
    for (const [ip, entry] of requestsByIp) {
      if (entry.resetAt <= now) requestsByIp.delete(ip);
    }
    if (requestsByIp.size > 2_000) requestsByIp.clear();
  }
  const entry = requestsByIp.get(key);
  if (!entry || entry.resetAt <= now) {
    requestsByIp.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

/**
 * A restricted unauthenticated feed-reading endpoint.
 * This NEVER uses a service-role database client or touches private user data.
 * Public production deployments should also apply per-IP rate limits in Vercel WAF.
 */
export async function POST(request: Request) {
  // Browsers outside Nova should never be able to post to the feed proxy.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return json({ error: "Cross-origin access is not allowed" }, 403);
    } catch {
      return json({ error: "Invalid origin" }, 403);
    }
  }
  if (rateLimited(request)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }
  if (Number(request.headers.get("content-length")) > 4096) return json({ error: "Request is too large" }, 413);
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: "Request is too large" }, 413);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object") return json({ error: "Invalid request" }, 400);
    const { action, url } = body as { action?: unknown; url?: unknown };
    if (typeof url !== "string" || url.length > 2048) return json({ error: "Invalid feed address" }, 400);
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return json({ error: "Only web addresses are supported" }, 400);

    if (action === "discover") {
      return json({ feeds: await discoverFeeds(url, { maxBytes: 2 * 1024 * 1024 }) });
    }
    if (action === "feed") {
      const response = await safeFetch(url, { maxBytes: 3 * 1024 * 1024 });
      if (response.status >= 400 || !looksLikeFeed(response.contentType, response.text)) throw new NotAFeed("The address did not return a feed");
      return json({ url: response.url, feed: parseFeedText(response.text, response.url) });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The feed could not be loaded";
    const status = error instanceof SyntaxError || error instanceof TypeError ? 400 : 422;
    return json({ error: message }, status);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}