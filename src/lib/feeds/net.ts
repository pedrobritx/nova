import "server-only";
import { lookup as dnsLookup, promises as dns, type LookupAddress } from "node:dns";
import { BlockList, isIP } from "node:net";
import { Agent, fetch } from "undici";

// Nova fetches addresses that people type in. Every request goes through this module so it
// can never reach private networks, loopback or cloud metadata services, even through a
// redirect or a DNS answer that changes between checks.

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32], ["2002::", 16],
  ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(net, prefix, "ipv6");

/** True when an IP address is private, loopback, link-local, reserved or otherwise not public. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) {
    const mapped = address.match(/^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return blocked.check(mapped[1], "ipv4");
    const hexMapped = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return blocked.check(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`, "ipv4");
    }
    return blocked.check(address, "ipv6");
  }
  return true;
}

export class FetchRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchRefused";
  }
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

function guardedLookup(hostname: string, options: { all?: boolean; family?: number }, callback: LookupCallback) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const list = addresses as LookupAddress[];
    if (!list.length || list.some((a) => isBlockedAddress(a.address))) {
      const refused = Object.assign(new Error(`${hostname} resolves to an address Nova will not contact`), { code: "ENOTPUBLIC" });
      return callback(refused, []);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

const publicAgent = new Agent({
  connect: { lookup: guardedLookup as never, timeout: 8_000 },
  headersTimeout: 10_000,
  bodyTimeout: 15_000,
});

const plainAgent = new Agent({ connect: { timeout: 8_000 } });

export const USER_AGENT = "Nova/0.1 (feed reader; +https://github.com/pedrobritx/nova)";
const ACCEPT =
  "application/rss+xml, application/atom+xml, application/feed+json, application/xml;q=0.9, text/xml;q=0.9, application/json;q=0.8, text/html;q=0.7, */*;q=0.5";

export type FetchOptions = {
  etag?: string | null;
  lastModified?: string | null;
  maxBytes?: number;
  /** Tests only: allow loopback so a local server can stand in for the web. */
  allowPrivate?: boolean;
  /** Abort early, for example when a scheduled refresh reaches its time budget. */
  signal?: AbortSignal;
};

export type FetchResult = {
  status: number;
  url: string;
  notModified: boolean;
  contentType: string;
  etag: string | null;
  lastModified: string | null;
  retryAfter: number | null;
  text: string;
};

function checkUrl(raw: string, allowPrivate: boolean): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchRefused("That is not a web address");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchRefused("Only http and https addresses are supported");
  if (url.username || url.password) throw new FetchRefused("Addresses with a user name or password are not supported");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!allowPrivate && (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local"))) {
    throw new FetchRefused("Nova only reads public websites");
  }
  if (!allowPrivate && isIP(host) && isBlockedAddress(host)) throw new FetchRefused("Nova only reads public websites");
  return url;
}

function charsetOf(contentType: string, head: Uint8Array): string {
  const fromHeader = contentType.match(/charset="?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader;
  const prolog = new TextDecoder("ascii").decode(head.subarray(0, 256));
  return prolog.match(/<\?xml[^>]*encoding=["']([\w-]+)["']/i)?.[1] ?? prolog.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
}

function decode(bytes: Uint8Array, contentType: string): string {
  const charset = charsetOf(contentType, bytes);
  try {
    return new TextDecoder(charset).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
  }
}

/**
 * Check an address before Nova records it anywhere: a public http(s) URL whose host resolves
 * only to public addresses. Fetching checks again at connection time, so a DNS answer that
 * changes later is still caught.
 */
export async function assertPublicAddress(raw: string): Promise<URL> {
  const url = checkUrl(raw, false);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return url;
  let addresses: LookupAddress[];
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw new FetchRefused(`${host} could not be found`);
  }
  if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) throw new FetchRefused("Nova only reads public websites");
  return url;
}

/** GET a public URL with redirects re-checked, a size cap, timeouts and conditional headers. */
export async function safeFetch(raw: string, options: FetchOptions = {}): Promise<FetchResult> {
  const allowPrivate = options.allowPrivate ?? false;
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  let url = checkUrl(raw, allowPrivate);
  const signal = options.signal ? AbortSignal.any([AbortSignal.timeout(20_000), options.signal]) : AbortSignal.timeout(20_000);

  for (let hop = 0; hop <= 5; hop++) {
    const headers: Record<string, string> = { "user-agent": USER_AGENT, accept: ACCEPT, "accept-encoding": "gzip, deflate, br" };
    if (hop === 0 && options.etag) headers["if-none-match"] = options.etag;
    if (hop === 0 && options.lastModified) headers["if-modified-since"] = options.lastModified;

    const res = await fetch(url, { headers, redirect: "manual", signal, dispatcher: allowPrivate ? plainAgent : publicAgent }).catch((err: unknown) => {
      const cause = (err as { cause?: { code?: string; message?: string } }).cause;
      if (cause?.code === "ENOTPUBLIC") throw new FetchRefused("Nova only reads public websites");
      if (cause?.code === "ENOTFOUND") throw new FetchRefused(`${url.hostname} could not be found`);
      throw new FetchRefused(`${url.hostname} did not respond`);
    });

    if (res.status >= 300 && res.status < 400 && res.status !== 304) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) throw new FetchRefused("The site redirected without saying where");
      url = checkUrl(new URL(location, url).toString(), allowPrivate);
      continue;
    }

    const retryAfterRaw = res.headers.get("retry-after");
    const retryAfter = retryAfterRaw ? (/^\d+$/.test(retryAfterRaw) ? Number(retryAfterRaw) : Math.max(0, (Date.parse(retryAfterRaw) - Date.now()) / 1000)) : null;
    const base = {
      status: res.status,
      url: url.toString(),
      contentType: res.headers.get("content-type") ?? "",
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
      retryAfter: retryAfter !== null && Number.isFinite(retryAfter) ? Math.round(retryAfter) : null,
    };
    if (res.status === 304) {
      await res.body?.cancel();
      return { ...base, notModified: true, text: "" };
    }

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) {
      await res.body?.cancel();
      throw new FetchRefused("The page is too large to read");
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (res.body) {
      for await (const chunk of res.body) {
        size += chunk.byteLength;
        if (size > maxBytes) throw new FetchRefused("The page is too large to read");
        chunks.push(chunk);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ...base, notModified: false, text: decode(bytes, base.contentType) };
  }
  throw new FetchRefused("The site redirected too many times");
}
