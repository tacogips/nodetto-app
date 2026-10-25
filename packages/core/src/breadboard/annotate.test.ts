import { describe, expect, test } from "bun:test";
import { Store } from "../store.ts";
import { document, element } from "../test-helpers.ts";
import {
  annotateBreadboardParts,
  planBreadboardAnnotation,
} from "./annotate.ts";

const page = { id: "bb", name: "Board", kind: "breadboard" as const };

describe("breadboard references", () => {
  test("uses the lowest free number for unannotated incoming references", () => {
    expect(
      annotateBreadboardParts(
        ["R1", "R2"],
        [{ type: "breadboard.resistor", reference: "R?" }],
      ),
    ).toEqual(["R3"]);
    expect(
      annotateBreadboardParts(
        ["R1", "R3"],
        [{ type: "breadboard.resistor", reference: "R?" }],
      ),
    ).toEqual(["R2"]);
  });

  test("fixes collisions among incoming parts in order", () => {
    expect(
      annotateBreadboardParts(
        [],
        [
          { type: "breadboard.resistor", reference: "R1" },
          { type: "breadboard.resistor", reference: "R1" },
        ],
      ),
    ).toEqual(["R1", "R2"]);
  });

  test("LEDs and diodes share the D prefix", () => {
    expect(
      annotateBreadboardParts(
        [],
        [
          { type: "breadboard.led", reference: "D1" },
          { type: "breadboard.diode", reference: "D1" },
        ],
      ),
    ).toEqual(["D1", "D2"]);
  });

  test("keeps the first holder and repairs later duplicates and placeholders", () => {
    const store = new Store(
      document(
        [
          element({
            id: "one",
            type: "breadboard.resistor",
            index: "a1",
            semantic: { reference: "R1", value: "220", span: 4, bands: 4 },
            page: page.id,
          }),
          element({
            id: "two",
            type: "breadboard.resistor",
            index: "a2",
            semantic: { reference: "R1", value: "220", span: 4, bands: 4 },
            page: page.id,
          }),
          element({
            id: "three",
            type: "breadboard.resistor",
            index: "a3",
            semantic: { reference: "R?", value: "220", span: 4, bands: 4 },
            page: page.id,
          }),
        ],
        [page],
      ),
    );
    expect(planBreadboardAnnotation(store, page.id)).toEqual([
      {
        type: "updateSemantic",
        id: "two",
        semantic: { reference: "R2", value: "220", span: 4, bands: 4 },
      },
      {
        type: "updateSemantic",
        id: "three",
        semantic: { reference: "R3", value: "220", span: 4, bands: 4 },
      },
    ]);
  });
});
