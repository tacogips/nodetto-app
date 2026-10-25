import { describe, expect, test } from "bun:test";
import { BREADBOARD_ELEMENT_TYPES } from "@nodetto/ir";
import { Store } from "../store.ts";
import { document, element } from "../test-helpers.ts";
import { breadboardPinAt } from "./breadboard.ts";
import { createDefaultRegistry } from "./index.ts";

const page = { id: "bb", name: "Board", kind: "breadboard" as const };

describe("breadboard shape utilities", () => {
  test("registers one fixed-size util for every breadboard element type", () => {
    const registry = createDefaultRegistry();
    for (const type of BREADBOARD_ELEMENT_TYPES) {
      expect(registry.get(type)?.canResize).toBe(false);
      expect(registry.get(type)?.type).toBe(type);
    }
    expect(registry.get("breadboard.board")?.defaultVisual()).toMatchObject({
      width: 330,
      height: 220,
    });
    expect(registry.get("breadboard.resistor")?.defaultVisual()).toMatchObject({
      width: 50,
      height: 10,
    });
    expect(registry.get("breadboard.netlist")?.defaultVisual()).toMatchObject({
      width: 160,
      height: 40,
    });
  });

  test("wire bounds include stroke and hit testing uses a four-unit tolerance", () => {
    const util = createDefaultRegistry().get("breadboard.wire");
    const wire = element({
      id: "wire",
      type: "breadboard.wire",
      page: page.id,
      semantic: {
        color: "red",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
      },
      visual: { x: 10, y: 10 },
    });
    expect(util?.getBounds(wire, {} as never)).toEqual({
      x: 7.75,
      y: 7.75,
      width: 14.5,
      height: 14.5,
    });
    expect(util?.hitTest(wire, { x: 15, y: 13 }, {} as never)).toBe(true);
    expect(util?.hitTest(wire, { x: 15, y: 16 }, {} as never)).toBe(false);
  });

  test("pin hit testing reports the pin number and wire end", () => {
    const store = new Store(
      document(
        [
          element({
            id: "led",
            type: "breadboard.led",
            index: "a1",
            page: page.id,
            semantic: { reference: "D1", value: "red", color: "red" },
            visual: { x: 10, y: 10 },
          }),
          element({
            id: "wire",
            type: "breadboard.wire",
            index: "a2",
            page: page.id,
            semantic: {
              color: "blue",
              points: [
                { x: 80, y: 80 },
                { x: 100, y: 80 },
              ],
            },
            visual: { x: 0, y: 0 },
          }),
        ],
        [page],
      ),
    );
    expect(breadboardPinAt(store, page.id, { x: 28, y: 20 })).toEqual({
      elementId: "led",
      pin: 2,
    });
    expect(breadboardPinAt(store, page.id, { x: 100, y: 80 })).toEqual({
      elementId: "wire",
      wireEnd: 1,
    });
  });
});
