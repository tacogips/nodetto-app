import { expect, test } from "bun:test";
import {
  coordinateKey,
  validateDocument,
  type Document,
  type Element,
} from "@nodetto/ir";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { document, element, makeEditor } from "../test-helpers.ts";
import { computeSchematicConnectivity } from "./connectivity.ts";
import { pinKey } from "./coordinates.ts";
import { lintSchematicPage } from "./erc.ts";
import { schematicPins } from "./symbols.ts";
import { planSchematicRotation } from "./transform.ts";

const page = { id: "s", name: "Circuit", kind: "schematic" as const };
const wire = (id: string, points: { x: number; y: number }[], x = 0, y = 0) =>
  element({
    id,
    page: page.id,
    type: "schematic.wire",
    semantic: { points },
    visual: { x, y },
  });
const junction = (id: string, x: number, y = 0) =>
  element({
    id,
    page: page.id,
    type: "schematic.junction",
    semantic: {},
    visual: { x, y },
  });
const doc = (elements: Element[]) => document(elements, [page]);
function compare(live: Document) {
  const reloaded = parseDocument(serializeDocument(live));
  const a = computeSchematicConnectivity(live, page.id);
  const b = computeSchematicConnectivity(reloaded, page.id);
  expect(b.nets).toEqual(a.nets);
  for (const e of live.elements) {
    expect(b.netOfElement(e.id)).toBe(a.netOfElement(e.id));
    for (const pin of schematicPins(e)) {
      const ref = { elementId: e.id, pin: pin.number };
      expect(b.netOfPin(ref)).toBe(a.netOfPin(ref));
    }
  }
  expect(lintSchematicPage(reloaded, page.id)).toEqual(
    lintSchematicPage(live, page.id),
  );
  return a;
}

test("independent stored-field keys and negative ties survive reload", () => {
  const a = compare(
    doc([
      wire(
        "w",
        [
          { x: 0, y: 0 },
          { x: 10.004, y: 0 },
        ],
        0.004,
      ),
      junction("j", 10.008),
    ]),
  );
  expect(a.netOfElement("w")).not.toBe(a.netOfElement("j"));
  const b = compare(
    doc([
      wire("w", [
        { x: -0.125, y: 0 },
        { x: 10, y: 0 },
      ]),
      junction("j", -0.125),
    ]),
  );
  expect(b.netOfElement("w")).toBe(b.netOfElement("j"));
});

test("off-grid rotation preserves the wired pin through editor apply", () => {
  const part = element({
    id: "r",
    page: page.id,
    type: "schematic.resistor",
    semantic: { reference: "R1", value: "1k" },
    visual: { x: 3.37, y: 0 },
  });
  const pin = schematicPins(part)[0];
  if (!pin) throw new Error("missing resistor pin");
  const editor = makeEditor({
    document: doc([
      part,
      wire("w", [
        { x: pin.x, y: pin.y },
        { x: pin.x + 10, y: pin.y },
      ]),
    ]),
  });
  editor.apply(planSchematicRotation(editor.store, ["r"], 1));
  const c = compare(editor.getSnapshot());
  expect(c.netOfPin({ elementId: "r", pin: 1 })).toBe(c.netOfElement("w"));
});

test("pin keys round the origin separately from the symbol offset", () => {
  const part = element({
    id: "p",
    page: page.id,
    type: "schematic.power",
    semantic: { style: "ground", net: "GND" },
    visual: { x: -0.125, y: 0 },
  });
  const pin = schematicPins(part)[0];
  if (!pin) throw new Error("missing power pin");
  expect(pinKey(part, pin).kx).toBe(1487);
  expect(coordinateKey(pin.x)).toBe(1488);
  const c = compare(doc([part, junction("j", 14.87, pin.y)]));
  expect(c.netOfElement("p")).toBe(c.netOfElement("j"));
});

test("group nudges use canonical deltas on both axes", () => {
  for (const [origin, other, delta, expected] of [
    [-1, -0.999, -0.005, -1.01],
    [-0.125, -0.13, 1, 0.87],
  ] as const) {
    const editor = makeEditor({
      document: doc([
        wire(
          "w",
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
          origin,
          origin,
        ),
        junction("j", other, other),
      ]),
    });
    editor.selection.set(["w", "j"]);
    expect(editor.nudgeSelection(delta, delta)).toBe(true);
    for (const id of ["w", "j"]) {
      expect(editor.store.get(id)?.visual.x).toBe(expected);
      expect(editor.store.get(id)?.visual.y).toBe(expected);
    }
    const c = compare(editor.getSnapshot());
    expect(c.netOfElement("w")).toBe(c.netOfElement("j"));
  }
});

test("reversed and two-axis wire sweeps preserve membership", () => {
  const elements = [
    wire("h", [
      { x: 10, y: 0 },
      { x: -10, y: 0 },
    ]),
    wire("v", [
      { x: 0, y: -10 },
      { x: 0, y: 10 },
    ]),
    junction("j", 0, 0),
    junction("right", 10, 0),
    junction("top", 0, -10),
  ];
  const c = compare(doc(elements));
  for (const id of ["v", "j", "right", "top"])
    expect(c.netOfElement(id)).toBe(c.netOfElement("h"));
});

test("schematic coordinate limits validate at both boundaries", () => {
  const invalid = doc([
    wire(
      "w",
      [
        { x: 0, y: 0 },
        { x: 1e307, y: 0 },
      ],
      2e307,
    ),
  ]);
  expect(
    validateDocument(invalid).filter(
      (issue) => issue.code === "schematic.coordinateRange",
    ).length,
  ).toBeGreaterThanOrEqual(2);
  const valid = doc([
    wire("w", [
      { x: -1e9, y: 0 },
      { x: 1e9, y: 0 },
    ]),
  ]);
  expect(
    validateDocument(valid).filter(
      (issue) => issue.code === "schematic.coordinateRange",
    ),
  ).toEqual([]);
  expect(coordinateKey(-1e9)).toBe(-100000000000);
  expect(coordinateKey(1e9)).toBe(100000000000);
  compare(valid);
});
