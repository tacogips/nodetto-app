/** A user's preference for the application chrome theme. */
export type ThemePreference = "system" | "light" | "dark";

/** A user's preference for a page canvas background. */
export type CanvasBackgroundPreference = "light" | "dark" | "match";

/** The concrete theme resolved from a preference and system appearance. */
export type ResolvedTheme = "light" | "dark";

/** The media query used to follow the operating system's dark appearance. */
export const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

/** Theme choices in settings dialog order. */
export const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

/** Diagram canvas choices in settings dialog order. */
export const CANVAS_BACKGROUND_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "match", label: "Match theme" },
] as const;

/** PCB canvas choices in settings dialog order. */
export const PCB_CANVAS_BACKGROUND_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "match", label: "Match theme" },
] as const;

/** Checks whether an unknown value is a supported theme preference. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_OPTIONS.some((option) => option.value === value);
}

/** Checks whether an unknown value is a supported canvas preference. */
export function isCanvasBackgroundPreference(
  value: unknown,
): value is CanvasBackgroundPreference {
  return CANVAS_BACKGROUND_OPTIONS.some((option) => option.value === value);
}

/** Resolves the application theme from the preference and system setting. */
export function resolveTheme(
  theme: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (theme === "system") return systemPrefersDark ? "dark" : "light";
  return theme;
}

/** Resolves a canvas preference to a concrete light or dark mode. */
export function resolveCanvasMode(
  pref: CanvasBackgroundPreference,
  resolved: ResolvedTheme,
): ResolvedTheme {
  return pref === "match" ? resolved : pref;
}

/** Applies the resolved theme to a structural document root. */
export function applyTheme(
  root: { dataset: DOMStringMap; style: { colorScheme: string } },
  resolved: ResolvedTheme,
): void {
  root.dataset.nodettoTheme = resolved;
  root.style.colorScheme = resolved;
}

/** Watches system appearance changes and returns a listener disposer. */
export function watchSystemTheme(
  media: Pick<
    MediaQueryList,
    "matches" | "addEventListener" | "removeEventListener"
  >,
  onChange: (dark: boolean) => void,
): () => void {
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
