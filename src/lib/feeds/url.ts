// Link handling shared by parsing, discovery and duplicate detection.

const TRACKING_PARAM =
  /^(utm_[a-z_]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|yclid|mc_cid|mc_eid|igshid|_hsenc|_hsmi|mkt_tok|ref|ref_src|ref_url|cmpid|ocid|spm|share|smid|cid)$/i;

/** An absolute http(s) URL with tracking parameters and the fragment removed, or null. */
export function cleanUrl(raw: string | null | undefined, base?: string | null): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim(), base ?? undefined);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  url.username = "";
  url.password = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

/**
 * The key two links share when they point at the same article: scheme, "www.", default
 * ports, trailing slashes, tracking parameters and parameter order no longer matter.
 */
export function linkKey(raw: string | null | undefined, base?: string | null): string | null {
  const clean = cleanUrl(raw, base);
  if (!clean) return null;
  const url = new URL(clean);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const port = url.port && url.port !== "80" && url.port !== "443" ? `:${url.port}` : "";
  const path = url.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  return `${host}${port}${path}${query}`;
}

/** True for absolute http(s) URLs a person could reasonably paste as a source. */
export function isHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Accepts "example.com/feed" as well as full URLs; returns null when it cannot be a web address. */
export function normaliseInputUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isHttpUrl(withScheme)) return null;
  const url = new URL(withScheme);
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
  return url.toString();
}
