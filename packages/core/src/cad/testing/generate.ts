import {
  type CadCircleSemantic,
  type CadExtrudeSemantic,
  type CadLineSemantic,
  type CadSketchSemantic,
  type CadXY,
  type Document,
  type Element,
  SCHEMA_VERSION,
} from "@nodetto/ir";
import { newElementId } from "../../ids.ts";

/** Generate a sketch and extrusion for each group of entity records. */
export function generateCadDocument({
  features,
  entitiesPerSketch,
}: {
  features: number;
  entitiesPerSketch: number;
}): Document {
  let seed = 0x9e3779b9;
  let timestamp = 1_700_000_000_000;
  const nextId = () =>
    newElementId(timestamp++, (bytes) => {
      for (let i = 0; i < bytes.length; i += 1) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        bytes[i] = seed >>> 24;
      }
    });
  const id = nextId();
  const page = nextId();
  const elements: Element[] = [];
  const indexWidth = (features * (entitiesPerSketch + 2)).toString(36).length;
  // Fixed-width digits preserve lexical order. The suffix keeps every key
  // valid for fractional insertion, including ordinals ending in zero.
  const nextIndex = () =>
    `${elements.length.toString(36).padStart(indexWidth, "0")}1`;
  for (let i = 0; i < features; i += 1) {
    const sketch = nextId();
    const sketchSemantic: CadSketchSemantic = {
      name: `Sketch ${i + 1}`,
      plane: { base: "xy" },
    };
    elements.push({
      id: sketch,
      page,
      index: nextIndex(),
      type: "cad.sketch",
      semantic: sketchSemantic,
      visual: {},
    });
    // Sketches with room for an outline model a chamfered plate with holes.
    const outlineEdges = entitiesPerSketch >= 8 ? 8 : 0;
    const circles = entitiesPerSketch - outlineEdges;
    if (outlineEdges > 0) {
      const right = Math.max(0, Math.min(circles, 100) - 1) * 3 + 3;
      const top = Math.max(0, Math.ceil(circles / 100) - 1) * 3 + 3;
      const first: CadXY = [-2, -3];
      const ends: readonly CadXY[] = [
        [right - 1, -3],
        [right, -2],
        [right, top - 1],
        [right - 1, top],
        [-2, top],
        [-3, top - 1],
        [-3, -2],
        first,
      ];
      let a = first;
      for (const b of ends) {
        const semantic: CadLineSemantic = { sketch, a, b };
        elements.push({
          id: nextId(),
          page,
          index: nextIndex(),
          type: "cad.line",
          semantic,
          visual: {},
        });
        a = b;
      }
    }
    for (let j = 0; j < circles; j += 1) {
      const semantic: CadCircleSemantic = {
        sketch,
        c: [(j % 100) * 3, Math.floor(j / 100) * 3],
        r: 1,
      };
      elements.push({
        id: nextId(),
        page,
        index: nextIndex(),
        type: "cad.circle",
        semantic,
        visual: {},
      });
    }
    const extrudeSemantic: CadExtrudeSemantic = {
      name: `Extrude ${i + 1}`,
      sketch,
      distance: 4,
      op: "new",
    };
    elements.push({
      id: nextId(),
      page,
      index: nextIndex(),
      type: "cad.extrude",
      semantic: extrudeSemantic,
      visual: {},
    });
  }
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    title: "Generated CAD document",
    pages: [{ id: page, name: "Model", kind: "cad3d" }],
    elements,
  };
}
