import { expect, test } from "bun:test";
import { renderUiControl } from "./svg-export/ui-control.ts";
import { DEFAULT_SVG_THEME } from "./svg-export/theme.ts";
import { element } from "./test-helpers.ts";

test("button labels honor explicit alignment and padding", () => {
  const control = element({
    id: "aligned",
    type: "ui.control",
    semantic: { control: "button", label: "Hello" },
    visual: {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      textPadding: 16,
      style: { textAlign: "end" },
    },
  });
  const svg = renderUiControl(
    control,
    { x: 0, y: 0, width: 100, height: 40 },
    DEFAULT_SVG_THEME,
  );
  expect(svg).toContain('x="84"');
  expect(svg).toContain('text-anchor="end"');
  const start = element({
    id: "start",
    type: "ui.control",
    semantic: { control: "button", label: "Hello" },
    visual: {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      textPadding: 16,
      style: { textAlign: "start" },
    },
  });
  const startSvg = renderUiControl(
    start,
    { x: 0, y: 0, width: 100, height: 40 },
    DEFAULT_SVG_THEME,
  );
  expect(startSvg).toContain('x="16"');
  expect(startSvg).toContain('text-anchor="start"');
});

test("multiline button labels use separate theme-font text elements", () => {
  const control = element({
    id: "multiline",
    type: "ui.control",
    semantic: { control: "button", label: "Mark\nread" },
    visual: { x: 0, y: 0, width: 100, height: 40 },
  });
  const svg = renderUiControl(
    control,
    { x: 0, y: 0, width: 100, height: 40 },
    DEFAULT_SVG_THEME,
  );
  expect(svg.match(/<text /g)?.length).toBe(2);
  expect(svg.match(/font-family=/g)?.length).toBe(2);
  expect(svg).toContain(">Mark</text>");
  expect(svg).toContain(">read</text>");
});

test("tabs retain legacy colors and honor underline and pill indicators", () => {
  const box = { x: 0, y: 0, width: 100, height: 40 };
  const make = (indicator?: "underline" | "pill") =>
    element({
      id: "tabs",
      type: "ui.control",
      semantic: {
        control: "tabs",
        label: "Tabs",
        options: ["A", "B"],
        indicator,
      },
      visual: {
        ...box,
        style: indicator
          ? { fill: "#ffffff", accentColor: "#e0531f" }
          : undefined,
      },
    });
  const legacy = renderUiControl(make(), box, DEFAULT_SVG_THEME);
  expect(legacy).toContain("#f1f5f9");
  expect(legacy).toContain("#d6ecef");
  expect(legacy).toContain("#137e7e");
  const underline = renderUiControl(make("underline"), box, DEFAULT_SVG_THEME);
  expect(underline).toContain('height="2"');
  expect(underline).toContain("#e0531f");
  expect(underline).not.toContain("#d6ecef");
  expect(underline).not.toContain("#137e7e");
  expect(renderUiControl(make("pill"), box, DEFAULT_SVG_THEME)).toContain(
    'rx="18"',
  );
});

test("button renders icon, badge and truncation", () => {
  const box = { x: 0, y: 0, width: 120, height: 40 };
  const control = element({
    id: "decorated",
    type: "ui.control",
    semantic: {
      control: "button",
      label: "A very long button label",
      leadingIcon: "bell",
      badge: "3",
    },
    visual: {
      ...box,
      textPadding: 12,
      textTruncate: "ellipsis",
      style: { textAlign: "start" },
    },
  });
  const svg = renderUiControl(control, box, DEFAULT_SVG_THEME);
  expect(svg).toContain('x="38"');
  expect(svg).toContain("scale(");
  expect(svg).toContain(">3</text>");
  expect(svg).toContain("…</text>");
  const dot = element({
    id: "dot",
    type: "ui.control",
    semantic: { control: "button", label: "A", badge: "" },
    visual: box,
  });
  expect(renderUiControl(dot, box, DEFAULT_SVG_THEME)).toContain('r="4"');
});
