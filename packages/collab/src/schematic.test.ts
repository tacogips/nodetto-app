import { expect, test } from "bun:test";
import * as Y from "yjs";
import { schematicDocument } from "./test-fixtures.ts";
import { irToYDoc, ydocToIr } from "./ydoc.ts";

test("schematic document round trips through Y.Doc", () => {
  const source = schematicDocument();
  const doc = irToYDoc(source);
  try {
    expect(ydocToIr(doc)).toEqual({
      ...source,
      pages: [...source.pages].sort((a, b) => a.id.localeCompare(b.id)),
      elements: [...source.elements].sort((a, b) => a.id.localeCompare(b.id)),
    });
  } finally {
    doc.destroy();
  }
});

test("concurrent part move and wire edit converge", () => {
  const a = irToYDoc(schematicDocument());
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  try {
    const vectorA = Y.encodeStateVector(a);
    const vectorB = Y.encodeStateVector(b);
    const part = a.getMap<Y.Map<unknown>>("elements").get("sch-resistor");
    const wire = b.getMap<Y.Map<unknown>>("elements").get("sch-wire");
    if (!part || !wire) throw new Error("missing schematic fixture elements");
    const visual = part.get("visual") as Y.Map<unknown>;
    const semantic = wire.get("semantic") as Y.Map<unknown>;
    visual.set("x", 130);
    const points = semantic.get("points") as Y.Array<Y.Map<unknown>>;
    const endpoint = points.get(2);
    if (!endpoint) throw new Error("missing wire endpoint");
    endpoint.set("y", 20);
    const updateA = Y.encodeStateAsUpdate(a, vectorB);
    const updateB = Y.encodeStateAsUpdate(b, vectorA);
    Y.applyUpdate(a, updateB);
    Y.applyUpdate(b, updateA);
    const result = ydocToIr(a);
    expect(result).toEqual(ydocToIr(b));
    expect(
      result.elements.find((item) => item.id === "sch-resistor")?.visual.x,
    ).toBe(130);
    expect(
      (
        result.elements.find((item) => item.id === "sch-wire")?.semantic as
          | { points?: unknown }
          | undefined
      )?.points,
    ).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ]);
  } finally {
    a.destroy();
    b.destroy();
  }
});
