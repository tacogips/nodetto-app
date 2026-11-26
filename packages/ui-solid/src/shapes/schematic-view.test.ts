import { describe, expect, test } from "bun:test";
import { schematicNotation, type Box } from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import { schematicViewModel } from "./schematic-view.ts";

const box: Box = { x: 0, y: 0, width: 40, height: 20 };
const ink = {
  ink: "var(--nodetto-ink)",
  muted: "var(--nodetto-muted)",
  surface: "var(--nodetto-surface)",
  accent: "var(--nodetto-accent)",
};

function resistor(rotation = 0, flipX = false): Element {
  return {
    id: "element-1",
    page: "page-1",
    index: "a0",
    type: "schematic.resistor",
    semantic: { reference: "R1", value: "220" },
    visual: { x: 0, y: 0, rotation, flipX },
  } as Element;
}

describe("schematic view model", () => {
  test("uses themed shared notation and separates resistor labels", () => {
    const element = resistor();
    const model = schematicViewModel(element, box);
    expect(model.body).toEqual(schematicNotation(element, box, ink).body);
    expect(model.labels).toEqual(schematicNotation(element, box, ink).labels);
    expect(
      model.body.some(
        (primitive) =>
          primitive.role === "resistor" && primitive.stroke === ink.ink,
      ),
    ).toBe(true);
    expect(model.labels.map(({ role }) => role)).toContain("ref");
    expect(model.labelTransform).toBeUndefined();
  });

  test("counter-rotates labels and retains notation's mirroring", () => {
    const element = resistor(90, true);
    const model = schematicViewModel(element, box);
    expect(model.labelTransform).toBe("rotate(-90 20 10)");
    expect(model.body).toEqual(schematicNotation(element, box, ink).body);
    expect(model.labels).toEqual(schematicNotation(element, box, ink).labels);
  });
});
