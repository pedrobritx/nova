"use client";

import { useEffect, useRef } from "react";

/** Scrolls its row sideways so the current chip is visible, without moving the page. */
export function KeepCurrentInView() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const row = ref.current?.parentElement;
    const chip = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !chip) return;
    const r = row.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    if (c.left < r.left || c.right > r.right) row.scrollLeft += c.left - r.left - (r.width - c.width) / 2;
  }, []);
  return <span ref={ref} hidden />;
}
