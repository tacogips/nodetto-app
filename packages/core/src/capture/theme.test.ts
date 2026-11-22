import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CAPTURE_THEMES } from "../index.ts";

const canvasCss = readFileSync(
  new URL("../../../../apps/desktop/src/styles/canvas.css", import.meta.url),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

function luminance(hex: string): number {
  const linear = (offset: number) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

function contrast(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const [theme, selector] of [
  ["light", ".nodetto-canvas"],
  ["dark", ".nodetto-canvas.nodetto-canvas-dark"],
] as const) {
  test(`${theme} capture colors mirror the canvas tokens and meet 3:1 contrast`, () => {
    const rule = [...canvasCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
      ([, candidate]) => candidate?.trim() === selector,
    );
    const tokens = new Map<string, string>();
    for (const [, name, value] of (rule?.[2] ?? "").matchAll(
      /(--nodetto-canvas-[\w-]+)\s*:\s*(#[\da-f]{6})\s*;/gi,
    )) {
      if (name && value) tokens.set(name, value.toLowerCase());
    }
    const colors = CAPTURE_THEMES[theme];
    expect({
      background: tokens.get("--nodetto-canvas-bg"),
      body: tokens.get("--nodetto-canvas-ruler-surface"),
      edge: tokens.get("--nodetto-canvas-ruler-text"),
      interference: tokens.get("--nodetto-canvas-overlay"),
    }).toEqual(colors);
    expect(contrast(colors.interference, colors.body)).toBeGreaterThanOrEqual(
      3,
    );
    expect(contrast(colors.edge, colors.background)).toBeGreaterThanOrEqual(3);
  });
}
