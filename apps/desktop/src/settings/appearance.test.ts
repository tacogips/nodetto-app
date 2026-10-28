import { expect, test } from "bun:test";
import {
  CANVAS_BACKGROUND_OPTIONS,
  PCB_CANVAS_BACKGROUND_OPTIONS,
  SYSTEM_DARK_QUERY,
  THEME_OPTIONS,
  applyTheme,
  isCanvasBackgroundPreference,
  isThemePreference,
  resolveCanvasMode,
  resolveTheme,
  watchSystemTheme,
} from "./appearance.ts";
import type { ResolvedTheme } from "./appearance.ts";

test("theme preference resolves against the system appearance", () => {
  expect(resolveTheme("system", true)).toBe("dark");
  expect(resolveTheme("system", false)).toBe("light");
  expect(resolveTheme("light", true)).toBe("light");
  expect(resolveTheme("dark", false)).toBe("dark");
  expect(SYSTEM_DARK_QUERY).toBe("(prefers-color-scheme: dark)");
});

test("canvas mode resolves every preference and theme combination", () => {
  const cases: ["light" | "dark" | "match", ResolvedTheme, ResolvedTheme][] = [
    ["light", "light", "light"],
    ["light", "dark", "light"],
    ["dark", "light", "dark"],
    ["dark", "dark", "dark"],
    ["match", "light", "light"],
    ["match", "dark", "dark"],
  ];
  for (const [preference, theme, result] of cases) {
    expect(resolveCanvasMode(preference, theme)).toBe(result);
  }
  expect(cases).toHaveLength(6);
});

test("theme options and preference guards match dialog order", () => {
  expect(THEME_OPTIONS).toEqual([
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ]);
  expect(CANVAS_BACKGROUND_OPTIONS).toEqual([
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "match", label: "Match theme" },
  ]);
  expect(PCB_CANVAS_BACKGROUND_OPTIONS).toEqual([
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "match", label: "Match theme" },
  ]);
  expect(isThemePreference("system")).toBe(true);
  expect(isThemePreference("match")).toBe(false);
  expect(isCanvasBackgroundPreference("match")).toBe(true);
});

test("applyTheme updates the root dataset and color scheme", () => {
  const root = {
    dataset: {} as DOMStringMap,
    style: { colorScheme: "" },
  };
  applyTheme(root, "dark");
  expect(root.dataset.nodettoTheme).toBe("dark");
  expect(root.style.colorScheme).toBe("dark");
  applyTheme(root, "light");
  expect(root.dataset.nodettoTheme).toBe("light");
  expect(root.style.colorScheme).toBe("light");
});

test("watchSystemTheme forwards changes and disposes its listener", () => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    matches: false,
    addEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      listeners.add(listener);
    },
    removeEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      listeners.delete(listener);
    },
  } as unknown as Pick<
    MediaQueryList,
    "matches" | "addEventListener" | "removeEventListener"
  >;
  const changes: boolean[] = [];
  const dispose = watchSystemTheme(media, (dark) => changes.push(dark));
  expect(changes).toEqual([]);
  expect(listeners.size).toBe(1);
  for (const listener of listeners) {
    listener({ matches: true } as MediaQueryListEvent);
  }
  expect(changes).toEqual([true]);
  dispose();
  expect(listeners.size).toBe(0);
  for (const listener of listeners) {
    listener({ matches: false } as MediaQueryListEvent);
  }
  expect(changes).toEqual([true]);
});
