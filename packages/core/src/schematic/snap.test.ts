import { expect, test } from "bun:test";
import { Store } from "../store.ts";
import { document, element } from "../test-helpers.ts";
import { schematicAnchor, snapSchematicDelta } from "./snap.ts";
const page = { id: "s", name: "Circuit", kind: "schematic" as const };

test("snap uses the first schematic element in page order and canonical anchor", () => {
  const first = element({
    id: "j",
    page: page.id,
    index: "a1",
    type: "schematic.junction",
    semantic: {},
    visual: { x: 13, y: 7 },
  });
  const second = element({
    id: "l",
    page: page.id,
    index: "a2",
    type: "schematic.label",
    semantic: {},
    visual: { x: 25, y: 25 },
  });
  const store = new Store(document([first, second], [page]));
  expect(
    snapSchematicDelta(store, page.id, ["l", "j"], { x: 0, y: 0 }, true),
  ).toEqual({ x: -3, y: 3 });
  expect(
    snapSchematicDelta(store, page.id, ["j"], { x: 0.004, y: 0 }, false),
  ).toEqual({ x: 0, y: 0 });
});
test("anchors use per-field keys for wire, point and pin", () => {
  expect(
    schematicAnchor(
      element({
        id: "w",
        type: "schematic.wire",
        semantic: { points: [{ x: 10.004, y: 0 }] },
        visual: { x: 0.004 },
      }),
    ),
  ).toEqual({ x: 10, y: 0 });
  expect(
    schematicAnchor(
      element({
        id: "j",
        type: "schematic.noConnect",
        semantic: {},
        visual: { x: -0.125 },
      }),
    ),
  ).toEqual({ x: -0.13, y: 0 });
  expect(
    schematicAnchor(
      element({
        id: "r",
        type: "schematic.resistor",
        semantic: {},
        visual: { x: 3.374 },
      }),
    ),
  ).toEqual({ x: 8.37, y: 15 });
  expect(
    schematicAnchor(element({ id: "g", type: "shape.geo", semantic: {} })),
  ).toBeUndefined();
});
