"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "07:12" today, "Yesterday", "Mon" this week, "3 Nov" before that, in the reader's time zone. */
export function when(iso: string, now = new Date(), timeZone?: string): string {
  const d = new Date(iso);
  const local = (x: Date) => (timeZone ? new Date(x.toLocaleString("en-US", { timeZone })) : x);
  const days = Math.round((startOfDay(local(now)) - startOfDay(local(d))) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "short", timeZone });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone });
}

/**
 * Times are written on the server in the time zone the browser reported (UTC on a first visit)
 * and corrected to the device's own as soon as the page is live.
 */
export function Time({ iso, tz }: { iso: string; tz?: string }) {
  const text = useSyncExternalStore(subscribe, () => when(iso), () => when(iso, new Date(), tz ?? "UTC"));
  return <time dateTime={iso}>{text}</time>;
}
