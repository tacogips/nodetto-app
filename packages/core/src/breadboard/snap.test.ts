import { describe, expect, test } from "bun:test";
import { Store } from "../store.ts";
import { document, element } from "../test-helpers.ts";
import {
  isBreadboardSnapTarget,
  snapBreadboardDelta,
  snapBreadboardPoint,
} from "./snap.ts";

const page = { id: "bb", name: "Board", kind: "breadboard" as const };

describe("breadboard snapping", () => {
  test("rounds points to the 10-unit lattice", () => {
    expect(snapBreadboardPoint({ x: 14, y: 26 })).toEqual({ x: 10, y: 30 });
  });

  test("snaps the first breadboard anchor in page order", () => {
    const store = new Store(
      document(
        [
          element({
            id: "geo",
            type: "shape.geo",
            index: "a1",
            semantic: {},
            page: page.id,
            visual: { x: 10, y: 10, width: 20, height: 20 },
          }),
          element({
            id: "r",
            type: "breadboard.resistor",
            index: "a2",
            semantic: { reference: "R1", value: "220", span: 4, bands: 4 },
            page: page.id,
            visual: { x: 26, y: 42 },
          }),
        ],
        [page],
      ),
    );
    expect(
      snapBreadboardDelta(store, page.id, ["geo", "r"], { x: 0, y: 0 }),
    ).toEqual({ x: -1, y: 3 });
  });

  test("does not treat a generic shape selection as a breadboard snap target", () => {
    const store = new Store(
      document(
        [
          element({
            id: "geo",
            type: "shape.geo",
            semantic: {},
            page: page.id,
          }),
        ],
        [page],
      ),
    );
    expect(isBreadboardSnapTarget(store, ["geo"])).toBe(false);
    expect(
      snapBreadboardDelta(store, page.id, ["geo"], { x: 3, y: 7 }),
    ).toEqual({ x: 3, y: 7 });
  });
});
