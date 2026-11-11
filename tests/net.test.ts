import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { FetchRefused, isBlockedAddress, safeFetch } from "@/lib/feeds/net";

describe("address guard", () => {
  test.each([
    "127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe", "not-an-ip",
  ])("blocks %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));

  test.each(["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"])("allows %s", (ip) => expect(isBlockedAddress(ip)).toBe(false));

  test.each([
    "http://127.0.0.1/feed", "http://169.254.169.254/latest/meta-data/", "http://[::1]/", "http://localhost:3000/",
    "http://printer.local/", "file:///etc/passwd", "ftp://ex.com/", "https://user:pw@ex.com/",
  ])("refuses %s before connecting", async (url) => {
    await expect(safeFetch(url)).rejects.toBeInstanceOf(FetchRefused);
  });
});

describe("fetching", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/latin1") {
        res.writeHead(200, { "content-type": "application/rss+xml; charset=ISO-8859-1" });
        return res.end(Buffer.from('<?xml version="1.0"?><rss><channel><title>Caf\xe9</title></channel></rss>', "latin1"));
      }
      if (req.url === "/cached") {
        if (req.headers["if-none-match"] === '"v1"') {
          res.writeHead(304);
          return res.end();
        }
        res.writeHead(200, { etag: '"v1"', "content-type": "text/xml" });
        return res.end("<rss/>");
      }
      if (req.url === "/moved") {
        res.writeHead(301, { location: "/cached" });
        return res.end();
      }
      if (req.url === "/huge") {
        res.writeHead(200, { "content-type": "text/xml" });
        return res.end("x".repeat(2048));
      }
      if (req.url === "/slowdown") {
        res.writeHead(429, { "retry-after": "120" });
        return res.end();
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  test("decodes the declared charset", async () => {
    const res = await safeFetch(`${base}/latin1`, { allowPrivate: true });
    expect(res.text).toContain("Café");
  });

  test("follows redirects and sends conditional headers", async () => {
    const first = await safeFetch(`${base}/moved`, { allowPrivate: true });
    expect(first).toMatchObject({ status: 200, url: `${base}/cached`, etag: '"v1"', notModified: false });
    const again = await safeFetch(`${base}/cached`, { allowPrivate: true, etag: first.etag });
    expect(again).toMatchObject({ status: 304, notModified: true, text: "" });
  });

  test("stops reading past the size limit", async () => {
    await expect(safeFetch(`${base}/huge`, { allowPrivate: true, maxBytes: 1024 })).rejects.toThrow(/too large/);
  });

  test("reports Retry-After", async () => {
    const res = await safeFetch(`${base}/slowdown`, { allowPrivate: true });
    expect(res).toMatchObject({ status: 429, retryAfter: 120 });
  });
});
