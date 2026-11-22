import {
  type CadCircleSemantic,
  type CadSketchSemantic,
  type Document,
  type Element,
  SCHEMA_VERSION,
} from "@nodetto/ir";
import { newElementId } from "../../ids.ts";

/** Generate one feature record per sketch and its requested entity records. */
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
  for (let i = 0; i < features; i += 1) {
    const sketch = nextId();
    const sketchSemantic: CadSketchSemantic = {
      name: `Sketch ${i + 1}`,
      plane: { base: "xy" },
    };
    elements.push({
      id: sketch,
      page,
      index: "a1",
      type: "cad.sketch",
      semantic: sketchSemantic,
      visual: {},
    });
    for (let j = 0; j < entitiesPerSketch; j += 1) {
      const semantic: CadCircleSemantic = {
        sketch,
        c: [(j % 100) * 3, Math.floor(j / 100) * 3],
        r: 1,
      };
      elements.push({
        id: nextId(),
        page,
        index: "a2",
        type: "cad.circle",
        semantic,
        visual: {},
      });
    }
  }
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    title: "Generated CAD document",
    pages: [{ id: page, name: "Model", kind: "cad3d" }],
    elements,
  };
}
