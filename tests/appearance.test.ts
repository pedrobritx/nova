import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { APPEARANCE_SCRIPT, applyAppearance } from "@/lib/appearance";

// A minimal browser: one <html> element, saved settings and a device theme that can change.
let dark: boolean;
let store: Map<string, string>;
let listeners: (() => void)[];
const root = { dataset: {} as Record<string, string> };

function setDevice(isDark: boolean) {
  dark = isDark;
  listeners.forEach((fn) => fn());
}

function load(saved: Record<string, string>, isDark: boolean) {
  store = new Map(Object.entries(saved));
  dark = isDark;
  listeners = [];
  root.dataset = {};
  Object.assign(globalThis, {
    document: { documentElement: root, cookie: "" },
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    matchMedia: () => ({ get matches() { return dark; }, addEventListener: (_: string, fn: () => void) => listeners.push(fn) }),
  });
  new Function(APPEARANCE_SCRIPT)();
}

const shown = () => root.dataset.appearance;

describe("appearance", () => {
  beforeEach(() => load({}, false));
  afterEach(() => {
    for (const k of ["document", "localStorage", "matchMedia"]) delete (globalThis as Record<string, unknown>)[k];
  });

  test("System follows the device", () => {
    load({}, true);
    expect(shown()).toBe("dusk");
    setDevice(false);
    expect(shown()).toBe("dawn");
  });

  test("Dawn or Dusk chosen in Settings survives a device change", () => {
    load({}, false);
    applyAppearance("dawn", "on");
    setDevice(true);
    expect(shown()).toBe("dawn");
  });

  test("System chosen after a saved Dusk still follows the device", () => {
    load({ "nova-appearance": "dusk" }, false);
    expect(shown()).toBe("dusk");
    applyAppearance("system", "on");
    expect(shown()).toBe("dawn");
    setDevice(true);
    expect(shown()).toBe("dusk");
  });

  test("an unknown saved value counts as System", () => {
    load({ "nova-appearance": "purple" }, true);
    expect(shown()).toBe("dusk");
  });

  test("the texture setting is applied", () => {
    load({ "nova-texture": "off" }, false);
    expect(root.dataset.texture).toBe("off");
  });
});
