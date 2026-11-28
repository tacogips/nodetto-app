import { describe, expect, it } from "bun:test";
import { validateDocument } from "@nodetto/ir";
import { applyCommands } from "../commands.ts";
import { keyAfter } from "../fractional.ts";
import { Store } from "../store.ts";
import { document } from "../test-helpers.ts";
import type { CadIds } from "./authoring.ts";
import { pcbReferenceCommands, sketchCommands } from "./authoring.ts";
import { checkCadPage } from "./check.ts";
import {
  computePcbEnclosureDims,
  computeShellSpec,
  enclosureShellCommands,
  pcbBoardBounds,
  pcbEnclosureCommands,
  pcbKeepoutCommands,
  roundedRectangleCommands,
  slotCommands,
} from "./enclosure.ts";
import { analyzeCadPage } from "./history.ts";
import { CAD_TEST_PAGE } from "./testing/documents.ts";
import { edge, PCB_TEST_PAGE, testBoard } from "./testing/pcb.ts";

function createTestIds(): CadIds {
  let seq = 0;
  return {
    next: () => `el-${++seq}`,
    indexAfter: (prev) => keyAfter(prev ?? null),
  };
}

function createCadDoc() {
  return new Store(document([], [CAD_TEST_PAGE]));
}

describe("cad enclosure helpers", () => {
  it("computes valid shell specs and rejects degenerate shells", () => {
    const spec = computeShellSpec({
      x0: 0,
      y0: 0,
      x1: 60,
      y1: 40,
      height: 20,
      wallThickness: 2,
      floorThickness: 2,
      cornerRadius: 4,
    });
    expect(spec).not.toBeNull();
    expect(spec?.outerWidth).toBe(60);
    expect(spec?.outerHeight).toBe(40);
    expect(spec?.innerX0).toBe(2);
    expect(spec?.innerY0).toBe(2);
    expect(spec?.innerX1).toBe(58);
    expect(spec?.innerY1).toBe(38);
    expect(spec?.innerWidth).toBe(56);
    expect(spec?.innerHeight).toBe(36);
    expect(spec?.cavityDepth).toBe(18);
    expect(spec?.outerRadius).toBe(4);
    expect(spec?.innerRadius).toBe(2);

    // Wall too thick -> innerWidth <= 0
    expect(
      computeShellSpec({
        x0: 0,
        y0: 0,
        x1: 4,
        y1: 10,
        height: 10,
        wallThickness: 2,
        floorThickness: 2,
      }),
    ).toBeNull();

    // Floor >= height -> no cavity
    expect(
      computeShellSpec({
        x0: 0,
        y0: 0,
        x1: 40,
        y1: 30,
        height: 5,
        wallThickness: 2,
        floorThickness: 5,
      }),
    ).toBeNull();

    // Open both ends (sleeve) allows floorThickness 0
    const sleeve = computeShellSpec({
      x0: 0,
      y0: 0,
      x1: 30,
      y1: 20,
      height: 10,
      wallThickness: 2,
      floorThickness: 0,
      openFace: "both",
    });
    expect(sleeve?.cavityDepth).toBe(10);
    expect(sleeve?.floorThickness).toBe(0);
  });

  it("authors a closed rounded rectangle and slot that pass CAD validation and check", () => {
    const store = createCadDoc();
    const ids = createTestIds();

    const sk = sketchCommands(CAD_TEST_PAGE.id, { base: "xy" }, "Profile", ids);
    applyCommands(store, sk.commands);
    const sketchEl = store.get(sk.id);
    if (!sketchEl) throw new Error("missing sketch");

    const rounded = roundedRectangleCommands(
      CAD_TEST_PAGE.id,
      sketchEl,
      [0, 0],
      [60, 40],
      5,
      ids,
    );
    expect(rounded.length).toBe(8);
    applyCommands(store, rounded);

    const slot = slotCommands(
      CAD_TEST_PAGE.id,
      sketchEl,
      [15, 20],
      [45, 20],
      3,
      ids,
    );
    expect(slot.length).toBe(4);
    applyCommands(store, slot);

    const doc = store.getSnapshot();
    expect(validateDocument(doc).filter((i) => i.severity === "error")).toEqual(
      [],
    );
    const report = checkCadPage(doc.elements, CAD_TEST_PAGE.id);
    expect(report.errors).toEqual([]);
  });

  it("authors a hollow enclosure shell that passes validation and CAD check", () => {
    const store = createCadDoc();
    const ids = createTestIds();

    const result = enclosureShellCommands(
      CAD_TEST_PAGE.id,
      { base: "xy" },
      {
        x0: 0,
        y0: 0,
        x1: 80,
        y1: 50,
        height: 25,
        wallThickness: 2.5,
        floorThickness: 2,
        cornerRadius: 4,
      },
      ids,
      { name: "Project Box" },
    );
    expect(result).not.toBeNull();
    if (!result) return;
    applyCommands(store, result.commands);

    const doc = store.getSnapshot();
    expect(validateDocument(doc).filter((i) => i.severity === "error")).toEqual(
      [],
    );
    const report = checkCadPage(doc.elements, CAD_TEST_PAGE.id);
    expect(report.errors).toEqual([]);

    const history = analyzeCadPage(doc.elements);
    expect(history.status.get(result.outerExtrudeId)).toEqual({ ok: true });
    expect(history.status.get(result.cavityExtrudeId)).toEqual({ ok: true });
  });

  it("authors a PCB enclosure with clearance, standoffs, holes, and keep-out", () => {
    const store = new Store(
      document(
        [
          testBoard(1.6),
          edge("edge-1", { kind: "rect", start: [10, 20], end: [60, 50] }),
        ],
        [CAD_TEST_PAGE, PCB_TEST_PAGE],
      ),
    );
    const ids = createTestIds();

    const bounds = pcbBoardBounds(store.getSnapshot().elements, "board");
    expect("error" in bounds).toBe(false);
    if ("error" in bounds) return;
    expect(bounds.width).toBe(50);
    expect(bounds.height).toBe(30);
    expect(bounds.thickness).toBe(1.6);

    const dims = computePcbEnclosureDims({
      boardMinX: bounds.minX,
      boardMinY: bounds.minY,
      boardMaxX: bounds.maxX,
      boardMaxY: bounds.maxY,
      boardThickness: bounds.thickness,
      clearance: 1,
      wallThickness: 2,
      floorThickness: 2,
      standoffHeight: 3,
      componentHeadroom: 10,
      cornerRadius: 3,
    });
    expect(dims?.shell.outerWidth).toBe(56);
    expect(dims?.shell.outerHeight).toBe(36);
    expect(dims?.shell.innerWidth).toBe(52);
    expect(dims?.shell.innerHeight).toBe(32);
    expect(dims?.shell.height).toBe(16.6);
    expect(dims?.shell.cavityDepth).toBe(14.6);
    expect(dims?.baseOffsetZ).toBe(-5);

    const pcbRef = pcbReferenceCommands(
      CAD_TEST_PAGE.id,
      "board",
      "Board Ref",
      ids,
    );
    applyCommands(store, pcbRef);
    const pcbRefEl =
      pcbRef[0]?.type === "createElement" ? pcbRef[0].element : undefined;
    const pcbRefId = pcbRefEl?.id ?? "";

    const enc = pcbEnclosureCommands(
      CAD_TEST_PAGE.id,
      store.getSnapshot().elements,
      "board",
      {
        clearance: 1,
        wallThickness: 2,
        floorThickness: 2,
        standoffHeight: 3,
        componentHeadroom: 10,
        cornerRadius: 3,
        standoffOuterRadius: 2.5,
        standoffHoleRadius: 1.1,
        standoffInset: 4,
        ...(pcbRefEl ? { after: pcbRefEl.index } : {}),
      },
      ids,
    );
    expect("error" in enc).toBe(false);
    if ("error" in enc) return;
    applyCommands(store, enc.commands);
    expect(enc.standoffs?.bossExtrudeId).toBeDefined();
    expect(enc.standoffs?.holeExtrudeId).toBeDefined();
    const lastEncCmd = enc.commands.at(-1);
    const afterEnc =
      lastEncCmd?.type === "createElement"
        ? lastEncCmd.element.index
        : undefined;

    const keepout = pcbKeepoutCommands(
      CAD_TEST_PAGE.id,
      pcbRefId,
      bounds,
      8,
      ids,
      { margin: 0.5, ...(afterEnc ? { after: afterEnc } : {}) },
    );
    expect(keepout).not.toBeNull();
    if (keepout) applyCommands(store, keepout.commands);

    const doc = store.getSnapshot();
    expect(validateDocument(doc).filter((i) => i.severity === "error")).toEqual(
      [],
    );
    const report = checkCadPage(doc.elements, CAD_TEST_PAGE.id);
    expect(report.errors).toEqual([]);
  });
});
