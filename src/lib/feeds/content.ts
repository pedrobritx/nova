import { createHash } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { cleanUrl } from "./url";

// Everything Nova shows from a feed passes through here once, at ingest. Feed HTML is
// untrusted: scripts, styles, frames, forms, event handlers and tracking pixels are removed,
// links open safely in a new tab and images load lazily without a referrer.

const ALLOWED_TAGS = [
  "p", "br", "hr", "a", "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup",
  "blockquote", "q", "cite", "abbr", "code", "pre", "kbd",
  "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "dl", "dt", "dd",
  "figure", "figcaption", "img", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
];

export function sanitizeContent(html: string | null | undefined, base: string | null): string | null {
  if (!html || !html.trim()) return null;
  const clean = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      // rel, target, loading, decoding and referrerpolicy are only ever set by the transforms below.
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding", "referrerpolicy"],
      abbr: ["title"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed", "form", "svg", "math"],
    transformTags: {
      h1: "h2",
      a: (tagName, attribs) => {
        const href = attribs.href?.startsWith("mailto:") ? attribs.href : cleanUrl(attribs.href, base);
        return {
          tagName,
          attribs: { ...(href ? { href } : {}), ...(attribs.title ? { title: attribs.title } : {}), rel: "noopener noreferrer nofollow ugc", target: "_blank" },
        };
      },
      img: (tagName, attribs) => {
        const src = cleanUrl(attribs.src, base);
        return {
          tagName,
          attribs: {
            ...(src ? { src } : {}),
            alt: attribs.alt ?? "",
            ...(attribs.width ? { width: attribs.width } : {}),
            ...(attribs.height ? { height: attribs.height } : {}),
            loading: "lazy",
            decoding: "async",
            referrerpolicy: "no-referrer",
          },
        };
      },
    },
    exclusiveFilter: (frame) => {
      if (frame.tag === "img") {
        if (!frame.attribs.src) return true;
        const w = Number(frame.attribs.width);
        const h = Number(frame.attribs.height);
        return (w > 0 && w <= 2) || (h > 0 && h <= 2);
      }
      if (frame.tag === "p" || frame.tag === "figure") return !frame.text.trim() && !frame.mediaChildren?.length;
      return false;
    },
  });
  return clean.trim() || null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

/** Plain text from HTML: tags removed, entities decoded, whitespace collapsed. */
export function plainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|blockquote)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** A short plain-text excerpt that ends on a word. */
export function excerpt(html: string | null | undefined, max = 280): string | null {
  const text = plainText(html);
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).replace(/[\s,.;:–—-]+$/, "")}…`;
}

/** The first image in sanitised HTML, used when a feed gives no image of its own. */
export function firstImage(html: string | null): string | null {
  return html?.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? null;
}

/**
 * Two items with the same fingerprint carry the same words: syndicated copies and reposts.
 * Title and body are compared as plain lower-case text, so markup and spacing differences
 * do not matter.
 */
export function contentHash(title: string, body: string | null): string | null {
  const text = plainText(body);
  // Too little text to tell two articles apart ("Weekly links"): no fingerprint, no merge.
  if (text.length < 120) return null;
  const normal = `${title}\n${text}`.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return createHash("sha256").update(normal).digest("hex");
}
