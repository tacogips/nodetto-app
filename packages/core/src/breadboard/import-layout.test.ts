import { describe, expect, test } from "bun:test";
import {
  BREADBOARD_PITCH,
  type BreadboardImportPart,
  type BreadboardImportPlan,
  hasErrors,
  validateDocument,
} from "@nodetto/ir";
import { serializeDocument } from "@nodetto/io";
import { breadboardPins } from "./catalogue.ts";
import { boardLayout } from "./board.ts";
import { layoutBreadboardImport } from "./import-layout.ts";

function part(
  reference: string,
  type: BreadboardImportPart["type"],
  parameters: Readonly<Record<string, unknown>> = {},
): BreadboardImportPart {
  return { reference, value: reference, type, parameters };
}

function plan(parts: readonly BreadboardImportPart[]): BreadboardImportPlan {
  return {
    title: "Imported circuit",
    format: "kicad_net",
    source: "circuit.net",
    parts,
    target: {
      source: "circuit.net",
      format: "kicad_net",
      parts: parts.map(({ reference, value, type }) => ({
        reference,
        value,
        type,
      })),
      nets: [
        {
          name: "GND",
          nodes: [{ reference: parts[0]?.reference ?? "R1", pin: 1 }],
        },
      ],
    },
  };
}

describe("breadboard import layout", () => {
  test("creates a board, target card and ordered staged parts", () => {
    const document = layoutBreadboardImport(
      plan([
        part("R1", "breadboard.resistor"),
        part("D1", "breadboard.led"),
        part("SW1", "breadboard.button"),
        part("BT1", "breadboard.battery"),
      ]),
    );
    expect(document.title).toBe("Imported circuit");
    expect(document.pages).toEqual([
      { id: "page-1", kind: "breadboard", name: "Breadboard" },
    ]);
    expect(document.elements.map(({ id }) => id)).toEqual([
      "board-1",
      "target-netlist",
      "part-1",
      "part-2",
      "part-3",
      "part-4",
    ]);
    expect(document.elements[1]?.semantic).toEqual(
      plan([
        part("R1", "breadboard.resistor"),
        part("D1", "breadboard.led"),
        part("SW1", "breadboard.button"),
        part("BT1", "breadboard.battery"),
      ]).target,
    );
  });

  test("stages pins on the pitch lattice below the board", () => {
    const document = layoutBreadboardImport(
      plan([part("R1", "breadboard.resistor"), part("U1", "breadboard.ic")]),
    );
    const board = boardLayout("half");
    for (const element of document.elements.slice(2)) {
      expect((element.visual.y ?? 0) / BREADBOARD_PITCH).toBeGreaterThanOrEqual(
        board.height + 4,
      );
      for (const pin of breadboardPins(element)) {
        expect(pin.x % BREADBOARD_PITCH).toBe(0);
        expect(pin.y % BREADBOARD_PITCH).toBe(0);
      }
    }
  });

  test("wraps staged parts at the full board width with row clearance", () => {
    const document = layoutBreadboardImport(
      plan(
        Array.from({ length: 30 }, (_, index) =>
          part(`R${index + 1}`, "breadboard.resistor"),
        ),
      ),
    );
    const staged = document.elements.slice(2);
    const firstRowY = staged[0]?.visual.y ?? 0;
    const secondRowY = staged.find(({ visual }) => visual.y !== firstRowY)
      ?.visual.y;
    expect(secondRowY).toBeDefined();
    for (const element of staged) {
      expect(
        (element.visual.x ?? 0) + (element.visual.width ?? 0),
      ).toBeLessThanOrEqual(660);
    }
    expect(secondRowY).toBeGreaterThanOrEqual(firstRowY + 30);
  });

  test("is byte-stable and validates without errors", () => {
    const input = plan([
      part("R1", "breadboard.resistor"),
      part("D1", "breadboard.led"),
    ]);
    const first = layoutBreadboardImport(input);
    const second = layoutBreadboardImport(input);
    expect(serializeDocument(first)).toBe(serializeDocument(second));
    expect(hasErrors(validateDocument(first))).toBe(false);
  });

  test("keeps recognized parameters and drops unknown keys", () => {
    const document = layoutBreadboardImport(
      plan([part("R1", "breadboard.resistor", { span: 6, bogus: 1 })]),
    );
    expect(document.elements[2]?.semantic).toMatchObject({ span: 6 });
    expect(document.elements[2]?.semantic).not.toHaveProperty("bogus");
  });
});
