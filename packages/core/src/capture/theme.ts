export type CaptureTheme = "light" | "dark";

// Mirrors the canvas mode tokens in apps/desktop/src/styles/canvas.css.
export const CAPTURE_THEMES = {
  light: {
    background: "#f6f4ee",
    body: "#fffdf8",
    edge: "#596366",
    interference: "#335c67",
  },
  dark: {
    background: "#15191b",
    body: "#1f2427",
    edge: "#a3adb1",
    interference: "#5fb4c7",
  },
} as const satisfies Readonly<
  Record<
    CaptureTheme,
    {
      background: string;
      body: string;
      edge: string;
      interference: string;
    }
  >
>;
