import { CircleCheck, Inbox } from "lucide-react";
import Link from "next/link";
import type { ItemRow } from "@/lib/data";
import { dayNumber } from "@/lib/tz";
import { ItemLine } from "./stories";
import { Empty } from "./ui";

function dayLabel(iso: string, now: Date, tz: string): string {
  const d = new Date(iso);
  const diff = dayNumber(now, tz) - dayNumber(d, tz);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
}

/** Items grouped by day, newest first, with a link to the next page of older items. */
export function ItemList({ items, olderHref, tz, showFolder = true, unreadOnly = false }: { items: ItemRow[]; olderHref: string | null; tz: string; showFolder?: boolean; unreadOnly?: boolean }) {
  if (!items.length) {
    return unreadOnly ? (
      <Empty icon={CircleCheck} title="No unread items">
        <p className="t-body t-muted">Everything here has been read.</p>
      </Empty>
    ) : (
      <Empty icon={Inbox} title="No items yet">
        <p className="t-body t-muted">Items appear here as soon as your sources publish.</p>
      </Empty>
    );
  }
  const now = new Date();
  const groups: { label: string; items: ItemRow[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.publishedAt, now, tz);
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1)!.items.push(item);
  }
  return (
    <>
      {groups.map((g) => (
        <section key={g.label} className="section" aria-label={g.label} style={{ gap: "var(--s2)" }}>
          <h2 className="t-kicker">{g.label}</h2>
          <div className="list nv2-tile">
            {g.items.map((i) => (
              <ItemLine key={i.id} item={i} showFolder={showFolder} tz={tz} />
            ))}
          </div>
        </section>
      ))}
      {olderHref && (
        <p style={{ textAlign: "center" }}>
          <Link className="nv2-link" href={olderHref}>
            Older items
          </Link>
        </p>
      )}
    </>
  );
}
