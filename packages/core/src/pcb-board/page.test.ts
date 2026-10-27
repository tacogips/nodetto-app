import { describe, expect, test } from "bun:test";
import { assertValidDocument, type PcbImportPlan } from "@nodetto/ir";
import { buildPcbDocument } from "./test-builder.ts";
import { pcbDocumentFromPlan, pcbPageFromPlan } from "./page.ts";

const plan: PcbImportPlan = {
  title: "Board",
  board: {
    format: "kicad_pcb",
    source: "b.kicad_pcb",
    version: 20240108,
    generator: "pcbnew",
    maskExpansion: 0,
    layers: [],
    nets: [],
  },
  graphics: [],
  zones: [],
  tracks: [],
  vias: [],
  footprints: [
    {
      reference: "R1",
      value: "1k",
      library: "",
      at: [0, 0],
      rotation: 0,
      side: "top",
      pads: [],
      graphics: [],
    },
    {
      reference: "R1",
      value: "2k",
      library: "",
      at: [1, 0],
      rotation: 0,
      side: "top",
      pads: [],
      graphics: [],
    },
  ],
};

describe("PCB page builder", () => {
  test("uses deterministic ids, order and indexes", () => {
    const first = pcbPageFromPlan(plan, { pageName: "PCB" });
    const second = pcbPageFromPlan(plan, { pageName: "PCB" });
    expect(first).toEqual(second);
    expect(first.page.kind).toBe("pcb");
    expect(first.elements.map(({ id, index }) => [id, index])).toEqual([
      ["pcb-board", "a000001"],
      ["fp-R1", "a000002"],
      ["fp-R1-2", "a000003"],
    ]);
  });
  test("creates valid documents and a valid empty test document", () => {
    assertValidDocument(pcbDocumentFromPlan(plan, { pageName: "PCB" }));
    expect(buildPcbDocument({}).pages[0]?.kind).toBe("pcb");
  });
});
