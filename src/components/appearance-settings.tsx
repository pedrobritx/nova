"use client";

import { useSyncExternalStore } from "react";
import { type Appearance, applyAppearance as apply } from "@/lib/appearance";

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  listeners.forEach((fn) => fn());
}

/** Dawn, Dusk or the system's choice, and the ground texture. Saved on this device. */
export function AppearanceSettings() {
  const appearance = useSyncExternalStore(subscribe, () => read("nova-appearance", "system") as Appearance, () => "system" as Appearance);
  const texture = useSyncExternalStore(subscribe, () => read("nova-texture", "on"), () => "on");

  const options: { value: Appearance; label: string }[] = [
    { value: "system", label: "System" },
    { value: "dawn", label: "Dawn" },
    { value: "dusk", label: "Dusk" },
  ];

  return (
    <div className="nv2-stack" style={{ gap: "var(--s4)" }}>
      <fieldset className="m-seg">
        <legend>Appearance</legend>
        {options.map((o) => (
          <label key={o.value} className="m-seg-opt">
            <input
              type="radio"
              name="appearance"
              value={o.value}
              checked={appearance === o.value}
              onChange={() => {
                write("nova-appearance", o.value);
                apply(o.value, texture);
              }}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>
      <label className="m-switch">
        <span>Ground texture</span>
        <input
          type="checkbox"
          role="switch"
          checked={texture === "on"}
          onChange={(e) => {
            const next = e.target.checked ? "on" : "off";
            write("nova-texture", next);
            apply(appearance, next);
          }}
        />
        <span className="m-switch-track" aria-hidden="true">
          <span className="m-mat m-thumb">
            <span className="m-body" aria-hidden="true"><span className="m-refract" /><span className="m-light" /></span>
          </span>
        </span>
      </label>
      <p className="t-meta">Turn the texture off for a plain background behind text.</p>
    </div>
  );
}
