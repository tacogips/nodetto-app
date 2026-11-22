import { expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import {
  analyzeCadPage,
  applyCommands,
  type Command,
  generateCadDocument,
  isElementIdFormat,
  keyBetween,
  Store,
} from "@nodetto/core";
import { type Document, type Element, roundNm } from "@nodetto/ir";
import { parseDocument, parseDocumentResult } from "./parse.ts";
import { serializeDocument } from "./serialize.ts";

const fixtureText = await Bun.file(
  new URL("../__fixtures__/cad3d.jsonl", import.meta.url),
).text();
const fixture = parseDocument(fixtureText);

function element(id: string): Element {
  const record = fixture.elements.find((entry) => entry.id === id);
  if (!record) throw new Error(`Missing CAD fixture element ${id}`);
  return record;
}

function edit(document: Document, ...commands: Command[]): Document {
  const store = new Store(document);
  applyCommands(store, commands);
  return store.getSnapshot();
}

function lineChanges(before: Document, after: Document) {
  const oldLines = new Set(serializeDocument(before).trimEnd().split("\n"));
  const newLines = new Set(serializeDocument(after).trimEnd().split("\n"));
  const changedIds = (lines: Set<string>, against: Set<string>) =>
    [...lines]
      .filter((line) => !against.has(line))
      .map((line) => {
        const record: { kind: string; id: string } = JSON.parse(line);
        return `${record.kind}:${record.id}`;
      });
  return {
    before: changedIds(oldLines, newLines),
    after: changedIds(newLines, oldLines),
  };
}

test("generated CAD and the CAD fixture round-trip losslessly and byte-stably", () => {
  const generated = generateCadDocument({
    features: 10,
    entitiesPerSketch: 18,
  });
  for (const document of [generated, fixture]) {
    const text = serializeDocument(document);
    const parsed = parseDocument(text);
    expect(parsed).toEqual(document);
    expect(serializeDocument(parsed)).toBe(text);
  }
  expect(serializeDocument(fixture)).toBe(fixtureText);
});

test("CAD record and key order and nanometre-rounded numbers are canonical", () => {
  const circle = element("circle-bore");
  const c = [roundNm(0.1000004), roundNm(0.0000014)];
  const r = roundNm(1234.5678914);
  const sketch = element("sketch-top").id;
  const withCircle = (semantic: unknown, reverse = false): Document => {
    const elements = fixture.elements.map((entry) =>
      entry.id === circle.id ? { ...entry, semantic } : entry,
    );
    return { ...fixture, elements: reverse ? elements.reverse() : elements };
  };
  const text = serializeDocument(withCircle({ sketch, c, r }));
  expect(serializeDocument(withCircle({ r, c, sketch }, true))).toBe(text);
  expect(text).toContain(
    '"semantic":{"sketch":"sketch-top","c":[0.1,0.000001],"r":1234.567891}',
  );
  expect(serializeDocument(parseDocument(text))).toBe(text);
});

test("changing a hole radius rewrites only the circle line", () => {
  const after = edit(fixture, {
    type: "updateSemantic",
    id: "circle-bore",
    semantic: { sketch: "sketch-top", c: [30, 10], r: 3 },
  });
  expect(lineChanges(fixture, after)).toEqual({
    before: ["element:circle-bore"],
    after: ["element:circle-bore"],
  });
});

test("moving a CAD feature with one fractional key rewrites only its line", () => {
  const mesh = element("mesh-sample");
  const plate = element("plate");
  const sketch = element("sketch-top");
  const after = edit(fixture, {
    type: "reorder",
    id: mesh.id,
    index: keyBetween(plate.index, sketch.index),
  });
  expect(analyzeCadPage(after.elements).features.map(({ id }) => id)).toEqual([
    "sketch-base",
    "plate",
    "mesh-sample",
    "sketch-top",
    "cut",
    "board-reference",
  ]);
  expect(lineChanges(fixture, after)).toEqual({
    before: ["element:mesh-sample"],
    after: ["element:mesh-sample"],
  });
});

const addCircle: Command = {
  type: "createElement",
  element: {
    ...element("circle-bore"),
    id: "circle-extra",
    index: keyBetween("a7", "a8"),
    semantic: { sketch: "sketch-top", c: [10, 10], r: 2 },
  },
};

test("adding a circle adds one line and rewrites no existing lines", () => {
  const after = edit(fixture, addCircle);
  expect(lineChanges(fixture, after)).toEqual({
    before: [],
    after: ["element:circle-extra"],
  });
});

test("deleting a used sketch removes its lines and rewrites only dependent extrudes", () => {
  const base = edit(fixture, addCircle, {
    type: "createElement",
    element: {
      ...element("cut"),
      id: "cut-second",
      index: keyBetween("a8", "a9"),
      semantic: {
        name: "Second cut",
        sketch: "sketch-top",
        distance: -2,
        op: "cut",
        bodies: ["plate"],
      },
    },
  });
  const after = edit(base, { type: "deleteElements", ids: ["sketch-top"] });
  expect(lineChanges(base, after)).toEqual({
    before: [
      "element:circle-bore",
      "element:circle-extra",
      "element:cut",
      "element:cut-second",
      "element:sketch-top",
    ],
    after: ["element:cut", "element:cut-second"],
  });
  for (const id of ["cut", "cut-second"]) {
    const survivor = after.elements.find((entry) => entry.id === id);
    expect(survivor?.semantic).toBeDefined();
    expect(survivor?.semantic).not.toHaveProperty("sketch");
  }
});

test("deleting an unused sketch removes its lines without rewriting any", () => {
  const base = edit(fixture, addCircle, {
    type: "deleteElements",
    ids: ["cut"],
  });
  const after = edit(base, { type: "deleteElements", ids: ["sketch-top"] });
  expect(lineChanges(base, after)).toEqual({
    before: [
      "element:circle-bore",
      "element:circle-extra",
      "element:sketch-top",
    ],
    after: [],
  });
});

test("an unknown CAD element and an unknown extrude field survive intact", () => {
  const unknown =
    '{"kind":"element","id":"zz-future","page":"part","type":"cad.future","index":"aB","semantic":{"payload":{"revision":2}}}';
  const fixtureWithUnknownField = fixtureText.replace(
    '"distance":6,"op":"new"}',
    '"distance":6,"op":"new","futureMode":{"wall":2}}',
  );
  // CAD page records precede the foreign PCB page records in canonical order.
  const firstPcbRecord = fixtureWithUnknownField.indexOf(
    '{"kind":"element","id":"controller",',
  );
  expect(firstPcbRecord).toBeGreaterThan(0);
  const text = `${fixtureWithUnknownField.slice(0, firstPcbRecord)}${unknown}\n${fixtureWithUnknownField.slice(firstPcbRecord)}`;
  const result = parseDocumentResult(text);
  expect(result.issues.map(({ code, severity }) => [code, severity])).toEqual([
    ["semantic.unknownField", "warning"],
    ["type.unknown", "warning"],
  ]);
  if (!result.ok) throw new Error("Could not parse forward-compatible CAD");
  expect(
    result.document.elements.find(({ id }) => id === "plate")?.semantic,
  ).toHaveProperty("futureMode", { wall: 2 });
  expect(
    result.document.elements.find(({ id }) => id === "zz-future"),
  ).toMatchObject({
    type: "cad.future",
    semantic: { payload: { revision: 2 } },
  });
  expect(serializeDocument(result.document)).toBe(text);
});

test("10,000 CAD records meet JSONL size, parse and serialization budgets", () => {
  const document = generateCadDocument({
    features: 500,
    entitiesPerSketch: 18,
  });
  const records = document.elements.length;
  expect(records).toBe(10_000);
  expect(document.elements.every(({ id }) => isElementIdFormat(id))).toBe(true);
  expect(new Set(document.elements.map(({ id }) => id)).size).toBe(records);

  const serializeStart = performance.now();
  const text = serializeDocument(document);
  const serializeMs = performance.now() - serializeStart;
  const parseStart = performance.now();
  const parsed = parseDocument(text);
  const parseValidateMs = performance.now() - parseStart;
  const bytes = Buffer.byteLength(text);

  expect(bytes / records).toBeLessThanOrEqual(260);
  expect(bytes).toBeLessThan(2_600_000);
  expect(serializeMs).toBeLessThan(1_000);
  expect(parseValidateMs).toBeLessThan(1_000);
  expect(parsed).toEqual(document);
});
