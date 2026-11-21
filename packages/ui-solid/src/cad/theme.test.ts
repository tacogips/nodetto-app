import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CAD_THEME_TOKENS,
  contrastRatio,
  parseCssColor,
  readCadTheme,
} from "./theme.ts";

function rules(file: string): Map<string, string> {
  const css = readFileSync(
    new URL(`../../../../apps/desktop/src/styles/${file}`, import.meta.url),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");
  return new Map(
    Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), ([, selector, body]) => [
      selector.trim(),
      body,
    ]),
  );
}

function variables(body: string): Map<string, string> {
  return new Map(
    Array.from(
      body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g),
      ([, token, value]) => [token, value.trim()],
    ),
  );
}

test("all viewport tokens are declared per canvas mode and never on chrome roots", () => {
  const canvas = rules("canvas.css");
  const chrome = rules("base.css");
  const tokens = Object.values(CAD_THEME_TOKENS);
  // Chrome and canvas modes are independent. Since no CAD token comes from
  // a chrome root, all four combinations reduce to these two canvas rules.
  for (const token of tokens) {
    expect(token.startsWith("--nodetto-canvas-")).toBe(true);
  }
  for (const [selector, body] of chrome) {
    if (selector.startsWith(":root")) {
      const declarations = variables(body);
      for (const token of tokens) expect(declarations.has(token)).toBe(false);
    }
  }

  for (const selector of [
    ".nodetto-canvas",
    ".nodetto-canvas.nodetto-canvas-dark",
  ]) {
    const body = canvas.get(selector);
    if (body === undefined) throw new Error(`Missing canvas rule ${selector}`);
    const declarations = variables(body);
    const theme = readCadTheme((token) => declarations.get(token) ?? "");
    expect(contrastRatio(theme.line, theme.background)).toBeGreaterThanOrEqual(
      3,
    );
    expect(
      contrastRatio(theme.highlight, theme.background),
    ).toBeGreaterThanOrEqual(3);
    expect(
      new Set(
        [theme.line, theme.highlight, theme.body].map((color) =>
          color.join(","),
        ),
      ).size,
    ).toBe(3);
  }
});

test("parses opaque CSS hex and both numeric RGB syntaxes", () => {
  expect(parseCssColor(" #f09 ")).toEqual([255, 0, 153]);
  expect(parseCssColor("#1f24FF")).toEqual([31, 36, 255]);
  expect(parseCssColor("rgb(31 36 255)")).toEqual([31, 36, 255]);
  expect(parseCssColor("RGB(31, 36, 255)")).toEqual([31, 36, 255]);
  expect(parseCssColor("rgb(.5 1e2 255)")).toEqual([0.5, 100, 255]);
  for (const value of [
    "",
    "#1234",
    "#01234567",
    "#fffZ",
    "rgb(1, 2 3)",
    "rgb(1 2)",
    "rgb(1% 2% 3%)",
    "rgb(1 2 3 / 1)",
    "rgb(1 256 3)",
    "rgb(-1 2 3)",
  ]) {
    expect(parseCssColor(value)).toBeNull();
  }
});

test("missing and invalid tokens throw with the token name", () => {
  for (const value of ["", "unparseable"]) {
    expect(() =>
      readCadTheme((token) =>
        token === CAD_THEME_TOKENS.highlight ? value : "#fff",
      ),
    ).toThrow(CAD_THEME_TOKENS.highlight);
  }
});

test("contrast matches the WCAG endpoints and is symmetric", () => {
  const black = [0, 0, 0] as const;
  const white = [255, 255, 255] as const;
  expect(contrastRatio(black, white)).toBe(21);
  expect(contrastRatio(white, black)).toBe(21);
  expect(contrastRatio(white, white)).toBe(1);
});
