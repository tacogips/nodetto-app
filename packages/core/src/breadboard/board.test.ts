import { describe, expect, test } from "bun:test";
import type { Document, Element } from "@nodetto/ir";
import {
  BREADBOARD_ERC_RULE_IDS,
  BREADBOARD_ERC_SEVERITY,
  breadboardTargetNetlist,
} from "./types.ts";
import { boardHoles, boardLayout } from "./board.ts";

function board(size: "full" | "half" | "mini", x = 0, y = 0): Element {
  return {
    id: "board-1",
    page: "page-1",
    index: "a0",
    type: "breadboard.board",
    semantic: { size },
    visual: { x, y },
  };
}

function target(id: string, index: string, hidden = false): Element {
  return {
    id,
    page: "page-1",
    index,
    type: "breadboard.netlist",
    semantic: { source: id, format: "kicad_net", parts: [], nets: [] },
    visual: { x: 0, y: 0, ...(hidden ? { hidden: true } : {}) },
  };
}

describe("breadboard board layouts", () => {
  test("returns the pinned board sizes and hole counts", () => {
    expect(boardLayout("full")).toMatchObject({
      columns: 63,
      railHoles: 50,
      width: 66,
      height: 22,
    });
    expect(boardLayout("half")).toMatchObject({
      columns: 30,
      railHoles: 25,
      width: 33,
      height: 22,
    });
    expect(boardLayout("mini")).toMatchObject({
      columns: 17,
      railHoles: 0,
      width: 20,
      height: 16,
      channelY: { from: 7, to: 8 },
    });
    expect(boardLayout("full").holes).toHaveLength(830);
    expect(boardLayout("half").holes).toHaveLength(400);
    expect(boardLayout("mini").holes).toHaveLength(170);
  });

  test("assigns terminal holes to separate top and bottom strips", () => {
    const holes = boardLayout("half").holes;
    expect(holes.find(({ id }) => id === "a1")?.strip).toBe("col:1:top");
    expect(holes.find(({ id }) => id === "e1")?.strip).toBe("col:1:top");
    expect(holes.find(({ id }) => id === "f1")?.strip).toBe("col:1:bot");
    expect(holes.find(({ id }) => id === "a1")?.strip).not.toBe(
      holes.find(({ id }) => id === "f1")?.strip,
    );
    expect(holes.filter(({ strip }) => strip === "rail:T+")).toHaveLength(25);
    expect(
      boardLayout("mini").holes.some(({ strip }) => strip.startsWith("rail:")),
    ).toBe(false);
  });

  test("spaces rail holes in groups of five and labels all rows and ends", () => {
    const layout = boardLayout("half");
    const rail = layout.holes.filter(({ strip }) => strip === "rail:T+");
    const at = (id: string) => rail.find((hole) => hole.id === id)?.x;
    expect(at("T+1")).toBe(2);
    expect(at("T+5")).toBe(6);
    const fifthRailX = at("T+5");
    const sixthRailX = at("T+6");
    expect(
      fifthRailX !== undefined && sixthRailX !== undefined
        ? sixthRailX - fifthRailX
        : undefined,
    ).toBe(2);
    for (const row of "abcdefghij") {
      expect(layout.labels.filter(({ text }) => text === row)).toHaveLength(2);
    }
    expect(layout.labels.filter(({ text }) => text === "5")).toHaveLength(2);
  });

  test("maps board holes to page coordinates and honors raw rotation", () => {
    const element = board("half", 100, 50);
    const a1 = boardHoles(element).find(({ id }) => id === "a1");
    expect(a1).toMatchObject({ pageX: 120, pageY: 100 });
    const rotated = boardHoles({
      ...element,
      visual: { x: 100, y: 50, rotation: 90 },
    });
    const rotatedA1 = rotated.find(({ id }) => id === "a1");
    expect(rotatedA1).toMatchObject({ pageX: 325, pageY: 15 });
  });

  test("chooses the first visible target card in fractional order", () => {
    const document: Document = {
      schemaVersion: 1,
      id: "doc-1",
      title: "test",
      pages: [{ id: "page-1", name: "Breadboard", kind: "breadboard" }],
      elements: [
        target("later", "b0"),
        target("hidden", "a0", true),
        target("first", "a1"),
      ],
    };
    expect(breadboardTargetNetlist(document, "page-1")?.element.id).toBe(
      "first",
    );
    expect(breadboardTargetNetlist(document, "missing")).toBeUndefined();
    expect(
      breadboardTargetNetlist(
        { ...document, elements: [target("hidden", "a0", true)] },
        "page-1",
      ),
    ).toBeUndefined();
  });

  test("pins the rule IDs and severities", () => {
    expect(BREADBOARD_ERC_RULE_IDS).toHaveLength(13);
    expect(BREADBOARD_ERC_SEVERITY).toEqual({
      "pin-not-in-hole": "error",
      "shorted-part": "error",
      "rail-short": "error",
      "reversed-polarity": "error",
      "led-no-series-resistor": "warning",
      "unconnected-pin": "warning",
      "duplicate-reference": "error",
      "wire-end-off-hole": "error",
      "parity-missing-connection": "warning",
      "parity-extra-connection": "error",
      "parity-missing-part": "warning",
      "parity-extra-part": "warning",
      "parity-value-mismatch": "warning",
    });
  });
});
