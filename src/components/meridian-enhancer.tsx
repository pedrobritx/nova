"use client";

import { useEffect } from "react";

type Idle = (cb: () => void, opts?: { timeout: number }) => number;

/**
 * Meridian's fluid behaviour (presses that sink and rebound, travelling indicators) comes from
 * its script, which also inserts a few nodes into segmented controls and switches. Those
 * insertions must wait until React has hydrated the part of the page they sit in, or the two
 * disagree about the markup. React's hydration runs as queued tasks, so the script only runs
 * when the browser is idle: after the first render, and again after new content streams in.
 */
export function MeridianEnhancer() {
  useEffect(() => {
    const idle: Idle = (window as unknown as { requestIdleCallback?: Idle }).requestIdleCallback ?? ((cb) => window.setTimeout(cb, 250));
    let pending = false;
    let stop = false;
    let observer: MutationObserver | null = null;
    import("@pedrobritx/meridian/src/material.js").then(({ enhance }) => {
      const run = () => {
        if (pending || stop) return;
        pending = true;
        idle(() => {
          pending = false;
          if (!stop) enhance(document);
        }, { timeout: 1500 });
      };
      run();
      observer = new MutationObserver(run);
      observer.observe(document.body, { childList: true, subtree: true });
    });
    return () => {
      stop = true;
      observer?.disconnect();
    };
  }, []);
  return null;
}
