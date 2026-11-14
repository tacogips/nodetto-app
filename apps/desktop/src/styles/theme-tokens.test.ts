import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DESKTOP_ROOT = join(import.meta.dir, "..");
const REPO_ROOT = join(DESKTOP_ROOT, "../../..");
const STYLES_ROOT = join(DESKTOP_ROOT, "styles");
const UI_SOLID_ROOT = join(REPO_ROOT, "packages/ui-solid/src");
const DESKTOP_FILES = [
  ...readdirSync(STYLES_ROOT)
    .filter((file) => file.endsWith(".css"))
    .map((file) => `styles/${file}`),
  "buttons.css",
  "inspector.css",
  "pane.css",
  "square-chrome.css",
  "style.css",
  "TemplateDialog.css",
  "settings/settings.css",
];
const UI_SOLID_CHROME_FILES = [
  "Toolbar.css",
  "Layers.css",
  "BpmnProblemsPanel.css",
  "BreadboardProblemsPanel.css",
  "HelpHint.css",
  "ShapePalette.css",
  "ShapeWarnings.css",
  "Switch.css",
  "PcbLayersPanel.css",
  "ExportDialog.css",
  "ImageImport.css",
  "Inspector.css",
  "ZoomControls.css",
  "SelectionToolbar.css",
  "inspector/AssetExportSection.css",
];
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black)\b/gi;
const ROOT_SELECTOR = ":root";
const DARK_ROOT_SELECTOR = ':root[data-nodetto-theme="dark"]';
const CANVAS_SELECTOR = ".nodetto-canvas";
const DARK_CANVAS_SELECTOR = ".nodetto-canvas.nodetto-canvas-dark";
const PIN_SELECTOR_PARTS = [
  ".nodetto-backdrop-layer",
  ".nodetto-shape-layer",
  ".nodetto-connector-layer",
  ".nodetto-text-editor",
];
const BASE_LIGHT = new Map<string, string>([
  ["--nodetto-ink", "#1d2a2e"],
  ["--nodetto-muted", "#596366"],
  ["--nodetto-line", "#d8d2c3"],
  ["--nodetto-surface", "#fffdf8"],
  ["--nodetto-canvas", "#f6f4ee"],
  ["--nodetto-accent", "#335c67"],
  ["--nodetto-accent-soft", "#dbe6e8"],
  ["--nodetto-grid", "#e3ded1"],
  ["--app-chrome-surface", "#ffffff"],
  ["--app-chrome-line", "#dfe3e6"],
  ["--app-chrome-muted", "#667078"],
  ["--app-chrome-hover", "#f1f3f4"],
  ["--app-chrome-active", "#e5e9eb"],
]);
const CANVAS_LIGHT = new Map<string, string>([
  ["--nodetto-canvas-bg", "#f6f4ee"],
  ["--nodetto-canvas-grid", "#e3ded1"],
  ["--nodetto-canvas-ruler-surface", "#fffdf8"],
  ["--nodetto-canvas-ruler-line", "#d8d2c3"],
  ["--nodetto-canvas-ruler-text", "#596366"],
  ["--nodetto-canvas-overlay", "#335c67"],
  ["--nodetto-canvas-handle-fill", "#fffdf8"],
  ["--nodetto-canvas-crop-line", "#f8fafc"],
  ["--nodetto-canvas-crop-handle", "#f97316"],
  ["--nodetto-canvas-crop-mask", "rgb(15 23 42 / 45%)"],
  ["--nodetto-canvas-gradient-line", "#0f172a"],
  ["--nodetto-canvas-shadow", "rgb(0 0 0 / 18%)"],
]);
const DESIGN_TEXT_PAIRS: readonly [string, string, number][] = [
  ["--nodetto-ink", "--nodetto-surface", 4.5],
  ["--nodetto-muted", "--nodetto-surface", 4.5],
  ["--nodetto-ink", "--app-chrome-surface", 4.5],
  ["--app-chrome-muted", "--app-chrome-surface", 4.5],
  ["--app-chrome-muted", "--app-chrome-hover", 4.5],
  ["--nodetto-accent", "--nodetto-surface", 4.5],
  ["--app-muted-label", "--app-chrome-surface", 4.5],
];
const REGISTRY_TEXT_PAIRS: readonly [string, string, number][] = [
  ["--nodetto-on-accent", "--nodetto-accent", 4.5],
  ["--nodetto-danger", "--nodetto-danger-surface", 4.5],
  ["--nodetto-warning", "--nodetto-warning-surface", 4.5],
  ["--app-popover-ink", "--nodetto-surface", 4.5],
  ["--app-header-ink", "--app-chrome-surface", 4.5],
  ["--app-problem-ink", "--app-chrome-surface", 4.5],
  ["--app-problem-muted", "--app-chrome-surface", 4.5],
  ["--app-bpmn-warning-ink", "--app-bpmn-warning-surface", 4.5],
  ["--app-help-ink", "--app-chrome-surface", 4.5],
  ["--app-warning-badge-ink", "--app-warning-badge-surface", 4.5],
  ["--app-toolbar-selection-ink", "--app-toolbar-selection-surface", 4.5],
  ["--app-toolbar-selected-ink", "--app-toolbar-selected-surface", 4.5],
  ["--nodetto-muted", "--app-chrome-surface", 4.5],
  ["--nodetto-muted", "--nodetto-surface", 4.5],
  ["--nodetto-ink", "--app-chrome-hover", 4.5],
  ["--nodetto-ink", "--app-chrome-active", 4.5],
  ["--nodetto-accent", "--app-chrome-active", 4.5],
];

type CssRule = { selector: string; body: string };
type ParsedColor = { red: number; green: number; blue: number; alpha: number };

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Like style.test.ts, this returns innermost rules and leaves @media wrappers out. */
function rules(css: string): CssRule[] {
  return [...stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
    (match) => ({ selector: (match[1] ?? "").trim(), body: match[2] ?? "" }),
  );
}

function declarations(body: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const declaration of body.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) continue;
    const name = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (name) result.set(name, value);
  }
  return result;
}

function readDesktop(file: string): string {
  return readFileSync(join(DESKTOP_ROOT, file), "utf8");
}

function readUiSolid(file: string): string {
  return readFileSync(join(UI_SOLID_ROOT, file), "utf8");
}

function selectorKey(selector: string): string {
  return selector.replace(/\s+/g, " ").trim();
}

function isPinSelector(selector: string): boolean {
  return PIN_SELECTOR_PARTS.every((part) => selector.includes(part));
}

function findRule(css: string, selector: string): CssRule | undefined {
  return rules(css).find((rule) => selectorKey(rule.selector) === selector);
}

function findPinRule(css: string): CssRule | undefined {
  return rules(css).find((rule) => isPinSelector(rule.selector));
}

function cssTokenMap(css: string, selector: string): Map<string, string> {
  const rule = findRule(css, selector);
  if (!rule) return new Map();
  return new Map(
    [...declarations(rule.body)].filter(([name]) => name.startsWith("--")),
  );
}

function colorProblem(value: string): ParsedColor | undefined {
  const color = value.trim().toLowerCase();
  if (color === "white") return { red: 255, green: 255, blue: 255, alpha: 1 };
  if (color === "black") return { red: 0, green: 0, blue: 0, alpha: 1 };
  const hex = color.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i)?.[1];
  if (hex) {
    const expanded =
      hex.length <= 4 ? [...hex].map((digit) => digit + digit).join("") : hex;
    const hasAlpha = expanded.length === 8;
    const channels = [0, 2, 4].map((offset) =>
      Number.parseInt(expanded.slice(offset, offset + 2), 16),
    );
    const red = channels[0];
    const green = channels[1];
    const blue = channels[2];
    if (red === undefined || green === undefined || blue === undefined)
      return undefined;
    const alpha = hasAlpha
      ? Number.parseInt(expanded.slice(6, 8), 16) / 255
      : 1;
    return { red, green, blue, alpha };
  }
  const functional = color.match(/^(rgba?|hsla?)\((.*)\)$/i);
  const functionName = functional?.[1];
  const values = functional?.[2];
  if (!functionName || values === undefined) return undefined;
  const components = values
    .replace(/\s*\/\s*/, " ")
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/);
  if (functionName.startsWith("hsl")) {
    const hueValue = components[0];
    const saturationValue = components[1];
    const lightnessValue = components[2];
    if (
      hueValue === undefined ||
      saturationValue === undefined ||
      lightnessValue === undefined ||
      !saturationValue.endsWith("%") ||
      !lightnessValue.endsWith("%")
    )
      return undefined;
    const hueNumber = Number.parseFloat(hueValue);
    const hue = hueValue.endsWith("turn")
      ? hueNumber * 360
      : hueValue.endsWith("rad")
        ? (hueNumber * 180) / Math.PI
        : hueNumber;
    const saturation = Number.parseFloat(saturationValue) / 100;
    const lightness = Number.parseFloat(lightnessValue) / 100;
    if (![hue, saturation, lightness].every(Number.isFinite)) return undefined;
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const hueSegment = (((hue % 360) + 360) % 360) / 60;
    const secondary = chroma * (1 - Math.abs((hueSegment % 2) - 1));
    const channels =
      hueSegment < 1
        ? [chroma, secondary, 0]
        : hueSegment < 2
          ? [secondary, chroma, 0]
          : hueSegment < 3
            ? [0, chroma, secondary]
            : hueSegment < 4
              ? [0, secondary, chroma]
              : hueSegment < 5
                ? [secondary, 0, chroma]
                : [chroma, 0, secondary];
    const offset = lightness - chroma / 2;
    const alphaValue = components[3];
    const alpha =
      alphaValue === undefined
        ? 1
        : alphaValue.endsWith("%")
          ? Number.parseFloat(alphaValue) / 100
          : Number.parseFloat(alphaValue);
    const red = channels[0];
    const green = channels[1];
    const blue = channels[2];
    if (
      red === undefined ||
      green === undefined ||
      blue === undefined ||
      !Number.isFinite(alpha)
    )
      return undefined;
    return {
      red: (red + offset) * 255,
      green: (green + offset) * 255,
      blue: (blue + offset) * 255,
      alpha,
    };
  }
  const parseComponent = (
    component: string | undefined,
  ): number | undefined => {
    if (component === undefined) return undefined;
    const percent = component.endsWith("%");
    const number = Number.parseFloat(component);
    if (!Number.isFinite(number)) return undefined;
    return percent ? (number * 255) / 100 : number;
  };
  const red = parseComponent(components[0]);
  const green = parseComponent(components[1]);
  const blue = parseComponent(components[2]);
  const alphaPart = components[3];
  if (red === undefined || green === undefined || blue === undefined)
    return undefined;
  const alpha =
    alphaPart === undefined
      ? 1
      : alphaPart.endsWith("%")
        ? Number.parseFloat(alphaPart) / 100
        : Number.parseFloat(alphaPart);
  if (!Number.isFinite(alpha)) return undefined;
  return { red, green, blue, alpha };
}

function normalizedColor(value: string): string | undefined {
  const parsed = colorProblem(value);
  if (!parsed) return undefined;
  const channels = [parsed.red, parsed.green, parsed.blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("");
  const alpha = Math.round(parsed.alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return parsed.alpha === 1 ? `#${channels}` : `#${channels}${alpha}`;
}

function composite(
  foreground: ParsedColor,
  background: ParsedColor,
): ParsedColor {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  if (alpha === 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
  return {
    red:
      (foreground.red * foreground.alpha +
        background.red * background.alpha * (1 - foreground.alpha)) /
      alpha,
    green:
      (foreground.green * foreground.alpha +
        background.green * background.alpha * (1 - foreground.alpha)) /
      alpha,
    blue:
      (foreground.blue * foreground.alpha +
        background.blue * background.alpha * (1 - foreground.alpha)) /
      alpha,
    alpha,
  };
}

function luminance(color: ParsedColor): number {
  const linear = [color.red, color.green, color.blue].map((channel) => {
    const scaled = channel / 255;
    return scaled <= 0.04045
      ? scaled / 12.92
      : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  const red = linear[0];
  const green = linear[1];
  const blue = linear[2];
  if (red === undefined || green === undefined || blue === undefined) return 0;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(
  foreground: string,
  background: string,
): number | undefined {
  const fg = colorProblem(foreground);
  const bg = colorProblem(background);
  if (!fg || !bg) return undefined;
  const visibleFg = fg.alpha < 1 ? composite(fg, bg) : fg;
  const visibleBg =
    bg.alpha < 1
      ? composite(bg, { red: 255, green: 255, blue: 255, alpha: 1 })
      : bg;
  const first = luminance(visibleFg);
  const second = luminance(visibleBg);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function case1Problems(css: string, file: string): string[] {
  const allowed = new Set<string>();
  if (file === "styles/base.css") {
    allowed.add(ROOT_SELECTOR);
    allowed.add(DARK_ROOT_SELECTOR);
  }
  if (file === "styles/canvas.css") {
    allowed.add(CANVAS_SELECTOR);
    allowed.add(DARK_CANVAS_SELECTOR);
    const pin = findPinRule(css);
    if (pin) allowed.add(selectorKey(pin.selector));
  }
  const problems: string[] = [];
  for (const rule of rules(css)) {
    const selector = selectorKey(rule.selector);
    for (const declaration of rule.body.split(";")) {
      const separator = declaration.indexOf(":");
      if (separator < 0) continue;
      const name = declaration.slice(0, separator).trim();
      const value = declaration.slice(separator + 1).trim();
      const isAllowedTokenValue =
        allowed.has(selector) && name.startsWith("--");
      if (!isAllowedTokenValue) {
        for (const match of value.matchAll(LITERAL)) {
          problems.push(
            `${file} selector ${selector} has color literal ${match[0]} in ${value}`,
          );
        }
      }
    }
  }
  return problems;
}

function case1bProblems(
  css: string,
  file: string,
  declared: Set<string>,
): string[] {
  const exceptions = new Set(["--app-cloud-top"]); // Set inline by apps/desktop/src/App.tsx:497.
  const problems: string[] = [];
  for (const match of stripComments(css).matchAll(/var\(\s*(--[\w-]+)/g)) {
    const name = match[1];
    if (name && !declared.has(name) && !exceptions.has(name)) {
      problems.push(`${file} references undeclared ${name}`);
    }
  }
  return problems;
}

function case4Problems(
  css: string,
  lightTokens: Map<string, string>,
): string[] {
  const rule = findPinRule(css);
  if (!rule) return ["canvas.css is missing the document paint pin selector"];
  const props = declarations(rule.body);
  const problems: string[] = [];
  for (const [name, expected] of lightTokens) {
    const actual = props.get(name);
    if (
      actual === undefined ||
      normalizedColor(actual) !== normalizedColor(expected)
    ) {
      problems.push(
        `paint pin ${name} must equal light value ${expected}; got ${actual ?? "<missing>"}`,
      );
    }
  }
  if (props.get("color") !== "var(--nodetto-ink)") {
    problems.push("paint pin must declare color: var(--nodetto-ink)");
  }
  if (props.get("color-scheme") !== "light") {
    problems.push("paint pin must declare color-scheme: light");
  }
  return problems;
}

type Fallback = { start: number; end: number; name: string; value: string };

function varFallbacks(value: string): Fallback[] {
  const found: Fallback[] = [];
  for (const match of value.matchAll(/var\(/gi)) {
    const start = match.index;
    if (start === undefined) continue;
    let depth = 1;
    let comma = -1;
    let end = -1;
    for (let index = start + 4; index < value.length; index += 1) {
      const char = value[index];
      if (char === "(") depth += 1;
      if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
      if (char === "," && depth === 1 && comma < 0) comma = index;
    }
    if (comma < 0 || end < 0) continue;
    const name = value.slice(start + 4, comma).trim();
    found.push({
      start: comma + 1,
      end,
      name,
      value: value.slice(comma + 1, end).trim(),
    });
  }
  return found;
}

function case6Problems(
  css: string,
  file: string,
  baseLight: Map<string, string>,
): string[] {
  const problems: string[] = [];
  for (const rule of rules(css)) {
    for (const declaration of rule.body.split(";")) {
      const separator = declaration.indexOf(":");
      if (separator < 0) continue;
      const property = declaration.slice(0, separator).trim();
      const value = declaration.slice(separator + 1).trim();
      const fallbacks = varFallbacks(value);
      for (const match of value.matchAll(LITERAL)) {
        const literalIndex = match.index;
        if (literalIndex === undefined) continue;
        const candidates = fallbacks
          .filter(
            (fallback) =>
              literalIndex >= fallback.start && literalIndex < fallback.end,
          )
          .sort(
            (left, right) => left.end - left.start - (right.end - right.start),
          );
        const fallback = candidates[0];
        if (!fallback) {
          problems.push(
            `${file} ${rule.selector} ${property} literal ${match[0]} is not a var() fallback`,
          );
          continue;
        }
        const expected = baseLight.get(fallback.name);
        if (
          expected !== undefined &&
          normalizedColor(fallback.value) !== normalizedColor(expected)
        ) {
          problems.push(
            `${file} ${fallback.name} fallback ${fallback.value} differs from light token ${expected}`,
          );
        }
      }
    }
  }
  return problems;
}

function declarationsAcross(
  cssByFile: ReadonlyMap<string, string>,
): Set<string> {
  const names = new Set<string>();
  for (const css of cssByFile.values()) {
    for (const rule of rules(css)) {
      for (const name of declarations(rule.body).keys()) {
        if (name.startsWith("--")) names.add(name);
      }
    }
  }
  return names;
}

function tokenTableProblems(
  css: string,
  selector: string,
  expected: Map<string, string>,
  label: string,
): string[] {
  const actual = cssTokenMap(css, selector);
  const problems: string[] = [];
  for (const [name, expectedValue] of expected) {
    const actualValue = actual.get(name);
    if (
      actualValue === undefined ||
      normalizedColor(actualValue) !== normalizedColor(expectedValue)
    ) {
      problems.push(
        `${label} ${name}: expected ${expectedValue}, got ${actualValue ?? "<absent>"}`,
      );
    }
  }
  return problems;
}

function tokenParityProblems(
  css: string,
  firstSelector: string,
  secondSelector: string,
  label: string,
): string[] {
  const first = cssTokenMap(css, firstSelector);
  const second = cssTokenMap(css, secondSelector);
  const problems: string[] = [];
  for (const name of new Set([...first.keys(), ...second.keys()])) {
    if (!first.has(name) || !second.has(name))
      problems.push(`${label} token sets differ at ${name}`);
  }
  return problems;
}

function case5Problems(baseCss: string, canvasCss: string): string[] {
  const problems: string[] = [];
  const themes = [
    { name: "light", selector: ROOT_SELECTOR },
    { name: "dark", selector: DARK_ROOT_SELECTOR },
  ];
  for (const theme of themes) {
    const tokens = cssTokenMap(baseCss, theme.selector);
    for (const [foreground, background, minimum] of [
      ...DESIGN_TEXT_PAIRS,
      ...REGISTRY_TEXT_PAIRS,
    ]) {
      const fg = tokens.get(foreground);
      const bg = tokens.get(background);
      if (fg === undefined || bg === undefined) {
        problems.push(
          `${theme.name} contrast pair ${foreground}/${background} is missing a token`,
        );
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      if (ratio === undefined || ratio < minimum) {
        problems.push(
          `${theme.name} ${foreground} on ${background} contrast ${ratio ?? "invalid"}:1; need ${minimum}:1`,
        );
      }
    }
  }
  for (const [name, selector] of [
    ["light", CANVAS_SELECTOR],
    ["dark", DARK_CANVAS_SELECTOR],
  ] as const) {
    const tokens = cssTokenMap(canvasCss, selector);
    for (const [foreground, background, minimum] of [
      ["--nodetto-canvas-overlay", "--nodetto-canvas-bg", 3],
      ["--nodetto-canvas-ruler-text", "--nodetto-canvas-ruler-surface", 4.5],
    ] as const) {
      const fg = tokens.get(foreground);
      const bg = tokens.get(background);
      if (fg === undefined || bg === undefined) {
        problems.push(
          `${name} canvas contrast pair ${foreground}/${background} is missing a token`,
        );
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      if (ratio === undefined || ratio < minimum) {
        problems.push(
          `${name} canvas ${foreground} on ${background} contrast ${ratio ?? "invalid"}:1; need ${minimum}:1`,
        );
      }
    }
  }
  return problems;
}

function exportFiles(): string[] {
  const files = [
    "packages/core/src/svg-export.ts",
    "packages/core/src/pcb-export.ts",
    "packages/ui-solid/src/raster-export.ts",
    "packages/ui-solid/src/pdf-export.ts",
    "packages/ui-solid/src/pcb-export.ts",
    "packages/ui-solid/src/breadboard-export.ts",
  ];
  const collect = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) return collect(fullPath);
      return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
    });
  files.push(
    ...collect(join(REPO_ROOT, "packages/core/src/svg-export")).map((path) =>
      path.slice(REPO_ROOT.length + 1),
    ),
    ...collect(join(REPO_ROOT, "packages/io/src/jsonl"))
      .filter((path) => !path.endsWith(".test.ts"))
      .map((path) => path.slice(REPO_ROOT.length + 1)),
  );
  return [...new Set(files)];
}

function case7Problems(): string[] {
  const forbidden =
    /data-nodetto-theme|nodetto-canvas-dark|canvasBackground|matchMedia|getComputedStyle|settings\/appearance/;
  const problems: string[] = [];
  for (const file of exportFiles()) {
    const contents = readFileSync(join(REPO_ROOT, file), "utf8");
    if (forbidden.test(contents))
      problems.push(`${file} references appearance state`);
  }
  return problems;
}

const desktopCss = new Map(
  DESKTOP_FILES.map((file) => [file, readDesktop(file)]),
);
const uiSolidCss = new Map(
  UI_SOLID_CHROME_FILES.map((file) => [file, readUiSolid(file)]),
);
const baseCss = readDesktop("styles/base.css");
const canvasCss = readDesktop("styles/canvas.css");

test("1. desktop chrome CSS has no color literals outside token blocks", () => {
  const problems = [...desktopCss].flatMap(([file, css]) =>
    case1Problems(css, file),
  );
  expect(problems).toEqual([]);
});

test("1b. every desktop var() reference is declared", () => {
  const declared = declarationsAcross(new Map([...desktopCss, ...uiSolidCss]));
  const problems = [...desktopCss].flatMap(([file, css]) =>
    case1bProblems(css, file, declared),
  );
  expect(problems).toEqual([]);
});

test("2. dark chrome and canvas tokens mirror their light token names", () => {
  expect([
    ...tokenParityProblems(
      baseCss,
      ROOT_SELECTOR,
      DARK_ROOT_SELECTOR,
      "chrome",
    ),
    ...tokenParityProblems(
      canvasCss,
      CANVAS_SELECTOR,
      DARK_CANVAS_SELECTOR,
      "canvas",
    ),
  ]).toEqual([]);
});

test("3. original light chrome and canvas values stay fixed", () => {
  expect([
    ...tokenTableProblems(baseCss, ROOT_SELECTOR, BASE_LIGHT, "light chrome"),
    ...tokenTableProblems(
      canvasCss,
      CANVAS_SELECTOR,
      CANVAS_LIGHT,
      "light canvas",
    ),
  ]).toEqual([]);
});

test("4. document paint pin preserves light element defaults", () => {
  const lightTokens = cssTokenMap(baseCss, ROOT_SELECTOR);
  const pinNames = [
    "--nodetto-ink",
    "--nodetto-muted",
    "--nodetto-line",
    "--nodetto-surface",
    "--nodetto-accent",
    "--nodetto-accent-soft",
  ];
  const pinTokens = new Map(
    pinNames.flatMap((name) => {
      const value = lightTokens.get(name);
      return value === undefined ? [] : [[name, value] as const];
    }),
  );
  const problems = case4Problems(canvasCss, pinTokens);
  expect(problems).toEqual([]);
});

test("5. chrome text and canvas overlays meet WCAG contrast", () => {
  // Pair list follows design-appearance.md section 6 item 5 and plan 03/05 registries.
  expect(case5Problems(baseCss, canvasCss)).toEqual([]);
});

test("6. ui-solid chrome CSS literals are light-token fallbacks", () => {
  expect(
    [...uiSolidCss].flatMap(([file, css]) =>
      case6Problems(css, file, cssTokenMap(baseCss, ROOT_SELECTOR)),
    ),
  ).toEqual([]);
});

test("7. exports do not read appearance state", () => {
  expect(case7Problems()).toEqual([]);
});

test("negative checks reject a paint pin missing color-scheme: light", () => {
  const badPin = `${PIN_SELECTOR_PARTS.join(", ")} { --nodetto-ink: #1d2a2e; color: var(--nodetto-ink); }`;
  expect(
    case4Problems(badPin, new Map([["--nodetto-ink", "#1d2a2e"]])).length,
  ).toBeGreaterThan(0);
});

test("negative checks reject color literals in a non-token rule", () => {
  expect(
    case1Problems(".x { color: #fff; }", "styles/panels.css").length,
  ).toBeGreaterThan(0);
});

test("negative checks reject ui-solid literals without a var() fallback", () => {
  expect(
    case6Problems("a { color: #123456; }", "sample.css", new Map()).length,
  ).toBeGreaterThan(0);
});

test("negative checks reject token literals outside base.css", () => {
  expect(
    case1Problems(":root { --x: #fff; }", "buttons.css").length,
  ).toBeGreaterThan(0);
});

test("negative checks reject undeclared desktop var() references", () => {
  expect(
    case1bProblems(".a { border-color: var(--nope); }", "sample.css", new Set())
      .length,
  ).toBeGreaterThan(0);
});
