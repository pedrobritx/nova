import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/guest/feeds/route";

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  fetch: vi.fn(),
  parse: vi.fn(),
}));

vi.mock("@/lib/feeds/discover", () => ({ discoverFeeds: mocks.discover }));
vi.mock("@/lib/feeds/net", () => ({ safeFetch: mocks.fetch }));
vi.mock("@/lib/feeds/parse", () => ({
  looksLikeFeed: () => true,
  parseFeedText: mocks.parse,
  NotAFeed: class NotAFeed extends Error {},
}));

function post(body: unknown, origin = "https://nova.example", ip = "203.0.113.23") {
  return POST(new Request("https://nova.example/api/guest/feeds", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  }));
}

describe("unauthenticated guest feed endpoint", () => {
  it("rejects cross-site browser posts", async () => {
    const response = await post({ action: "feed", url: "https://example.org/rss" }, "https://other.example");
    expect(response.status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects non-web schemes", async () => {
    const response = await post({ action: "feed", url: "file:///etc/passwd" });
    expect(response.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns feed discovery results without using private databases", async () => {
    mocks.discover.mockResolvedValueOnce([{ url: "https://example.org/feed", title: "Example", siteUrl: "https://example.org" }]);
    const response = await post({ action: "discover", url: "https://example.org" });
    expect(response.status).toBe(200);
    expect((await response.json()).feeds).toHaveLength(1);
  });

  it("returns sanitised parsed feed data", async () => {
    mocks.fetch.mockResolvedValueOnce({ url: "https://example.org/feed", status: 200, contentType: "application/rss+xml", text: "<rss />" });
    mocks.parse.mockReturnValueOnce({ title: "Example", items: [] });
    const response = await post({ action: "feed", url: "https://example.org/feed" });
    expect(response.status).toBe(200);
    expect((await response.json()).feed.items).toEqual([]);
  });

  it("rejects oversized bodies", async () => {
    const response = await post({ action: "feed", url: "https://example.org/feed", filler: "x".repeat(5000) });
    expect(response.status).toBe(413);
  });
});