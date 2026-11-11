"use client";

import { CheckCheck, RefreshCw } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { markAllRead, markRead, refreshNow, type RefreshState } from "@/app/actions";
import { Body, Icon } from "./ui";

export function RefreshButton() {
  const [state, action, pending] = useActionState<RefreshState>(refreshNow, null);
  return (
    <form action={action} className="nv2-line" style={{ gap: "var(--s2)" }}>
      <span className="t-meta" role="status" aria-live="polite">
        {pending ? "Checking your sources…" : state?.message}
      </span>
      <button type="submit" className="m-mat m-glass m-icon" aria-label="Check for new items" title="Check for new items" aria-busy={pending || undefined}>
        <Body />
        <span className="m-label">
          <Icon icon={RefreshCw} />
        </span>
      </button>
    </form>
  );
}

/** Marks everything in a scope as read: a folder, a feed, a story, or the whole library. */
export function MarkAllRead({ folder, feed, story, label = "Mark all read" }: { folder?: string; feed?: string; story?: string; label?: string }) {
  return (
    <form action={markAllRead}>
      {folder && <input type="hidden" name="folder" value={folder} />}
      {feed && <input type="hidden" name="feed" value={feed} />}
      {story && <input type="hidden" name="story" value={story} />}
      <button type="submit" className="m-mat m-glass">
        <Body />
        <span className="m-label">
          <Icon icon={CheckCheck} />
          {label}
        </span>
      </button>
    </form>
  );
}

/**
 * Opening an item marks it read, but only once the page is really showing: prefetching a
 * link must never count as reading it.
 */
export function MarkReadOnOpen({ itemId, already }: { itemId: string; already: boolean }) {
  const done = useRef(already);
  useEffect(() => {
    if (done.current) return;
    // The guard is set when the timer fires, not when it is scheduled: React may run this
    // effect, clean it up and run it again, and the second run must still schedule it.
    const timer = setTimeout(() => {
      done.current = true;
      void markRead([itemId]);
    }, 1200);
    return () => clearTimeout(timer);
  }, [itemId]);
  return null;
}
