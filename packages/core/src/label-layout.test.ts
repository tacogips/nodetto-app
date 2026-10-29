import { expect, test } from "bun:test";
import {
  boxLabelLayout,
  CONNECTOR_LABEL_BACKDROP_PADDING,
  CONNECTOR_LABEL_GAP,
  connectorLabelBackdrop,
  connectorLabelBaselines,
  connectorLabelLayout,
} from "./label-layout.ts";
import { makeEditor } from "./test-helpers.ts";

test("edge labels break at newlines and wrap long text instead of running on", () => {
  expect(connectorLabelLayout("calls\nretries", {}).lines).toEqual([
    "calls",
    "retries",
  ]);
  const long = connectorLabelLayout(
    "validates the request payload and forwards it to the billing service",
    {},
  );
  expect(long.lines.length).toBeGreaterThan(2);
  expect(long.lineHeight).toBeCloseTo(11 * 1.2);
  expect(connectorLabelLayout("", {}).lines).toEqual([]);
});

test("edge label lines stack upward so the last keeps the one-line baseline", () => {
  const layout = connectorLabelLayout("a\nb\nc", {
    style: { fontSize: 10, lineHeight: 1.5 },
  });
  expect(connectorLabelBaselines(layout, 100)).toEqual([
    100 - CONNECTOR_LABEL_GAP - 30,
    100 - CONNECTOR_LABEL_GAP - 15,
    100 - CONNECTOR_LABEL_GAP,
  ]);
});

test("an edge label's backdrop covers its lines with a little padding", () => {
  const layout = connectorLabelLayout("ab\nabcd", {
    style: { fontSize: 10, lineHeight: 1.5 },
  });
  const box = connectorLabelBackdrop(layout, { x: 100, y: 100 });
  const pad = CONNECTOR_LABEL_BACKDROP_PADDING;
  // Four glyphs at 0.55 em, centred on the anchor.
  expect(box?.width).toBeCloseTo(4 * 10 * 0.55 + 2 * pad);
  expect(box?.x).toBeCloseTo(100 - 11 - pad);
  // From the first line's cap height to just under the last baseline.
  expect(box?.y).toBeCloseTo(100 - CONNECTOR_LABEL_GAP - 15 - 10 - pad);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeCloseTo(
    100 - CONNECTOR_LABEL_GAP + 3 + pad,
  );
  expect(
    connectorLabelBackdrop(connectorLabelLayout("", {}), { x: 0, y: 0 }),
  ).toBeNull();
});

test("shape labels wrap to the box inside its padding", () => {
  expect(boxLabelLayout("Order\nService", 120, {}).lines).toEqual([
    "Order",
    "Service",
  ]);
  const narrow = boxLabelLayout("Payment gateway adapter", 80, {});
  expect(narrow.lines.length).toBeGreaterThan(1);
  expect(boxLabelLayout("Payment gateway adapter", 400, {}).lines).toEqual([
    "Payment gateway adapter",
  ]);
});

test("SVG export draws each wrapped edge and shape label line separately", () => {
  const editor = makeEditor();
  const left = editor.buildElement("shape.geo", {
    semantic: { geo: "rect", label: "Order\nService" },
    visual: { x: 0, y: 0, width: 120, height: 60 },
  });
  const right = editor.buildElement("shape.geo", {
    semantic: { geo: "rect", label: "Billing" },
    visual: { x: 400, y: 0, width: 120, height: 60 },
  });
  const edge = editor.buildElement("edge.generic", {
    semantic: { from: left.id, to: right.id, label: "charges\ncard" },
  });
  editor.apply(
    [left, right, edge].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const svg = editor.exportPageSvg() ?? "";
  for (const line of ["Order", "Service", "charges", "card"])
    expect(svg).toContain(`>${line}</text>`);
  expect(svg).not.toContain("Order\nService");
  expect(svg).not.toContain("charges\ncard");
  // A backdrop and a halo keep a crossing line from running through the text.
  expect(svg).toMatch(/<rect [^>]*fill="#fffdf8"[^>]*\/><text [^>]*>charges</);
  expect(svg).toMatch(/stroke="#fffdf8"[^>]*paint-order="stroke"[^>]*>card</);
});
