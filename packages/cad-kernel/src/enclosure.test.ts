import { describe, expect, it } from "bun:test";
import {
  applyCommands,
  type CadIds,
  createCadMemo,
  enclosureShellCommands,
  evaluateCadPage,
  keyAfter,
  pcbEnclosureCommands,
  releaseCadMemo,
  Store,
} from "@nodetto/core";
import { CAD_PAGE_KIND, SCHEMA_VERSION } from "@nodetto/ir";
import { createManifoldKernel } from "./manifold-kernel.ts";

function testIds(): CadIds {
  let seq = 0;
  return {
    next: () => `enc-${++seq}`,
    indexAfter: (prev) => keyAfter(prev ?? null),
  };
}

describe("cad-kernel enclosure evaluation", () => {
  it("evaluates a rounded hollow enclosure shell with exact volume subtraction", async () => {
    const kernel = await createManifoldKernel();
    const memo = createCadMemo(kernel);
    try {
      const store = new Store({
        schemaVersion: SCHEMA_VERSION,
        id: "doc-1",
        title: "Enclosure",
        pages: [
          {
            id: "cad-1",
            name: "Enclosure",
            kind: CAD_PAGE_KIND,
            order: keyAfter(null),
          },
        ],
        elements: [],
      });
      const ids = testIds();
      const shell = enclosureShellCommands(
        "cad-1",
        { base: "xy" },
        {
          x0: 0,
          y0: 0,
          x1: 60,
          y1: 40,
          height: 20,
          wallThickness: 2,
          floorThickness: 2,
          cornerRadius: 0,
        },
        ids,
      );
      expect(shell).not.toBeNull();
      if (!shell) return;
      applyCommands(store, shell.commands);

      const evaluation = evaluateCadPage(
        store.getSnapshot().elements,
        kernel,
        memo,
      );
      expect(evaluation.status.get(shell.outerExtrudeId)).toEqual({ ok: true });
      expect(evaluation.status.get(shell.cavityExtrudeId)).toEqual({
        ok: true,
      });
      expect(evaluation.bodies.length).toBe(1);
      const body = evaluation.bodies[0];
      expect(body).toBeDefined();
      if (!body) return;
      const metrics = kernel.measure(body.handle);
      // Outer: 60*40*20 = 48000 mm^3; Cavity: 56*36*18 = 36288 mm^3; Net = 11712 mm^3
      expect(metrics.empty).toBe(false);
      expect(metrics.volume).toBeCloseTo(48000 - 36288, 1);
    } finally {
      releaseCadMemo(memo);
    }
  });

  it("evaluates a rounded PCB enclosure with standoffs and screw holes", async () => {
    const kernel = await createManifoldKernel();
    const memo = createCadMemo(kernel);
    try {
      const store = new Store({
        schemaVersion: SCHEMA_VERSION,
        id: "doc-2",
        title: "PCB Enclosure",
        pages: [
          {
            id: "cad-1",
            name: "Enclosure",
            kind: CAD_PAGE_KIND,
            order: keyAfter(null),
          },
          {
            id: "pcb-1",
            name: "Board",
            kind: "pcb",
            order: keyAfter(keyAfter(null)),
          },
        ],
        elements: [
          {
            id: "board-1",
            page: "pcb-1",
            type: "pcb.board",
            index: keyAfter(null),
            semantic: { title: "Main", thickness: 1.6, copperLayers: 2 },
            visual: {},
          },
          {
            id: "edge-1",
            page: "pcb-1",
            type: "pcb.graphic",
            index: keyAfter(keyAfter(null)),
            semantic: {
              layer: "Edge.Cuts",
              width: 0.1,
              fill: false,
              shape: { kind: "rect", start: [0, 0], end: [50, 30] },
            },
            visual: {},
          },
        ],
      });
      const ids = testIds();
      const enc = pcbEnclosureCommands(
        "cad-1",
        store.getSnapshot().elements,
        "board-1",
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
        },
        ids,
      );
      expect("error" in enc).toBe(false);
      if ("error" in enc) return;
      applyCommands(store, enc.commands);

      const evaluation = evaluateCadPage(
        store.getSnapshot().elements,
        kernel,
        memo,
      );
      for (const [, status] of evaluation.status) {
        expect(status).toEqual({ ok: true });
      }
      expect(evaluation.bodies.length).toBe(1);
      const body = evaluation.bodies[0];
      expect(body).toBeDefined();
      if (!body) return;
      const metrics = kernel.measure(body.handle);
      expect(metrics.empty).toBe(false);
      expect(metrics.volume).toBeGreaterThan(0);
    } finally {
      releaseCadMemo(memo);
    }
  });
});
