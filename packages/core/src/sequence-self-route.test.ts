import { expect, test } from "bun:test";
import { connectorLabelExtent, connectorLabelLayout } from "./label-layout.ts";
import { readDirectEndpoints, resolveConnector } from "./shapes/connector.ts";
import { document, element, makeEditor } from "./test-helpers.ts";

function resolved(
  kind: string,
  label: string,
  to = "p",
  labelPosition?: number,
) {
  const message = element({
    id: "m",
    type: "sequence.message",
    semantic: { from: "p", to, order: "a1", kind, label, labelPosition },
    visual: { y: 120 },
  });
  const editor = makeEditor({
    document: document([
      element({
        id: "p",
        type: "sequence.participant",
        semantic: { name: "Widgets", kind: "service", order: "a1" },
        visual: { x: 0, width: 160 },
      }),
      element({
        id: "q",
        type: "sequence.participant",
        semantic: { name: "Orders", kind: "service", order: "a2" },
        visual: { x: 0, width: 160 },
      }),
      element({
        id: "r",
        type: "sequence.participant",
        semantic: { name: "Stock", kind: "service", order: "a3" },
        visual: { x: 240, width: 160 },
      }),
      message,
    ]),
  });
  return {
    message,
    route: resolveConnector(
      message,
      editor.createShapeContext(),
      readDirectEndpoints,
    )!,
  };
}

test("self-message routes and labels are consistent across kinds", () => {
  for (const kind of ["sync", "async", "return"]) {
    const { message, route } = resolved(kind, "check", "p", 0.1);
    expect(route.points).toEqual([
      { x: 80, y: 120 },
      { x: 120, y: 120 },
      { x: 120, y: 152 },
      { x: 80, y: 152 },
    ]);
    expect(route.labelStartX).toBe(128);
    const extent = connectorLabelExtent(
      connectorLabelLayout("check", message.visual),
      route.labelPoint,
    )!;
    expect(extent.x).toBeCloseTo(128);
    expect(extent.y + extent.height / 2).toBeCloseTo(136);
    expect(route.labelPoint).toEqual(resolved(kind, "check").route.labelPoint);
  }
  expect(resolved("sync", "").route.labelPoint).toEqual({ x: 128, y: 136 });
});

test("distinct participants retain their straight routes", () => {
  const stub = resolved("sync", "check", "q").route;
  expect(stub.points).toHaveLength(2);
  expect("labelStartX" in stub).toBe(false);
  expect("labelStartX" in resolved("sync", "check", "r").route).toBe(false);
});
