import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { roundNm } from "@nodetto/ir";
import { importKicadPcb } from "./pcb.ts";
import { importKicad } from "./index.ts";

const fixture = (name: string) =>
  readFileSync(`test-fixtures/kicad/${name}`, "utf8");
const parse = (text: string, fileName = "fixture.kicad_pcb") =>
  importKicadPcb(text, { fileName });

describe("KiCad PCB import", () => {
  test("imports the two-layer fixture with its board items, nets and ordering", () => {
    const result = parse(fixture("two-layer.kicad_pcb"), "two-layer.kicad_pcb");
    const plan = result.plan;
    expect(plan?.title).toBe("two-layer");
    expect(plan?.board).toMatchObject({
      version: 20240108,
      generator: "nodetto-fixture",
      thickness: 1.6,
      maskExpansion: 0.05,
    });
    expect(plan?.board.nets).toEqual(["GND", "VCC", "SIG", "SPARE"]);
    expect(plan?.footprints).toHaveLength(5);
    expect(
      plan?.footprints.reduce((sum, item) => sum + item.pads.length, 0),
    ).toBe(10);
    expect(
      plan?.footprints.find((item) => item.reference === "R1")?.pads[0]
        ?.rotation,
    ).toBe(0);
    expect(plan?.footprints.find((item) => item.reference === "C1")?.side).toBe(
      "bottom",
    );
    expect(
      plan?.footprints.find((item) => item.reference === "U1")?.pads[0]?.drill,
    ).toMatchObject({ diameter: 0.8, slot: [0.8, 1.6], offset: [0.1, 0] });
    expect(
      plan?.footprints
        .find((item) => item.reference === "J1")
        ?.graphics.find(
          (item) => item.shape.kind === "text" && item.shape.text === "J1",
        )?.shape,
    ).toMatchObject({ kind: "text", role: "reference" });
    expect(
      plan?.footprints
        .find((item) => item.reference === "J1")
        ?.graphics.find(
          (item) => item.shape.kind === "text" && item.shape.role === "value",
        )?.shape,
    ).toMatchObject({ text: "Conn_01x03", role: "value" });
    expect(
      plan?.footprints.find((item) => item.reference === "R1")?.graphics[0]
        ?.layer,
    ).toBe("F.SilkS");
    const r1Reference = plan?.footprints
      .find((item) => item.reference === "R1")
      ?.graphics.find(
        (item) => item.shape.kind === "text" && item.shape.role === "reference",
      );
    expect(r1Reference).toMatchObject({
      layer: "F.SilkS",
      shape: { text: "R1", role: "reference" },
    });
    const nodettoText = plan?.graphics.find(
      (item) => item.shape.kind === "text" && item.shape.text === "Nodetto",
    );
    expect(nodettoText).toMatchObject({
      layer: "F.SilkS",
      shape: { text: "Nodetto" },
    });
    const allGraphics = [
      ...(plan?.graphics ?? []),
      ...(plan?.footprints.flatMap((footprint) => footprint.graphics) ?? []),
    ];
    expect(allGraphics.every((item) => item.layer !== "F.Silkscreen")).toBe(
      true,
    );
    expect(plan?.tracks[0]?.layer).toBe("B.Cu");
    expect(plan?.tracks).toHaveLength(13);
    expect(plan?.tracks.find((item) => item.mid)?.mid).toEqual([26, 9]);
    expect(plan?.tracks.filter((item) => item.net === "SIG")).toHaveLength(1);
    expect(plan?.vias).toHaveLength(2);
    expect(plan?.zones).toHaveLength(1);
    expect(plan?.zones[0]).toMatchObject({
      net: "GND",
      filled: [
        {
          layer: "B.Cu",
          polygons: [
            [
              [8.5, 8.5],
              [24.5, 8.5],
              [24.5, 17.5],
              [8.5, 17.5],
            ],
          ],
        },
      ],
    });
    expect(
      plan?.graphics.filter((item) => item.layer === "Edge.Cuts"),
    ).toHaveLength(5);
    expect(
      result.diagnostics.filter((item) => item.severity === "error"),
    ).toEqual([]);
    expect(parse(fixture("two-layer.kicad_pcb"))).toEqual(
      parse(fixture("two-layer.kicad_pcb")),
    );
  });

  test("reads KiCad 5 module syntax, coded nets, and clockwise arcs", () => {
    const result = parse(fixture("kicad5.kicad_pcb"));
    const footprint = result.plan?.footprints[0];
    expect(footprint?.reference).toBe("R1");
    expect(footprint?.value).toBe("10k");
    expect(
      footprint?.graphics.find(
        (item) => item.shape.kind === "text" && item.shape.role === "reference",
      )?.shape,
    ).toMatchObject({ text: "R1", role: "reference" });
    expect(
      footprint?.graphics.find(
        (item) => item.shape.kind === "text" && item.shape.role === "value",
      )?.shape,
    ).toMatchObject({ text: "10k", role: "value" });
    expect(
      footprint?.graphics.find(
        (item) => item.shape.kind === "text" && item.shape.role === "reference",
      )?.shape,
    ).toMatchObject({ hidden: true });
    expect(
      footprint?.graphics.find((item) => item.shape.kind === "arc")?.shape,
    ).toMatchObject({
      kind: "arc",
      start: [1, 0],
      mid: [roundNm(Math.SQRT1_2), roundNm(Math.SQRT1_2)],
      end: [0, 1],
    });
    expect(result.plan?.tracks[0]?.net).toBe("GND");
    expect(result.plan?.board.nets).toEqual(["GND", "SIG"]);
    expect(result.plan?.zones[0]?.net).toBe("GND");
    expect(parse(fixture("kicad5.kicad_pcb"))).toEqual(
      parse(fixture("kicad5.kicad_pcb")),
    );
  });

  test("preserves KiCad 7 footprint text content, roles, and hidden state", () => {
    const result = parse(
      `(kicad_pcb (version 20221018) (layers (0 "F.Cu" signal) (37 "F.SilkS" user)) (footprint "Test:Text" (layer "F.Cu") (at 1 2 0) (fp_text reference "R7" (at 0 0) (layer "F.SilkS") (effects (font (size 1 1)))) (fp_text value "10k" (at 0 1) (layer "F.Fab") (effects (font (size 1 1)) hide)) (fp_text user "LBL" (at 0 2) (layer "F.SilkS") (effects (font (size 1 1)))))`,
    );
    const footprint = result.plan?.footprints[0];
    expect(
      footprint?.graphics.find(
        (item) => item.shape.kind === "text" && item.shape.role === "reference",
      )?.shape,
    ).toMatchObject({ text: "R7", role: "reference" });
    expect(
      footprint?.graphics.find(
        (item) => item.shape.kind === "text" && item.shape.role === "value",
      )?.shape,
    ).toMatchObject({ text: "10k", role: "value", hidden: true });
    expect(
      footprint?.graphics.find(
        (item) => item.shape.kind === "text" && item.shape.role === "user",
      )?.shape,
    ).toMatchObject({ text: "LBL", role: "user" });
  });

  test("handles names, unsupported data and malformed board roots with diagnostics", () => {
    const source = `(kicad_pcb (version 20150101) (layers (0 "F.Cu" signal) (44 "Edge.Cuts" user)) (net 1 "GND") (segment (start 0 0) (end 1 0) (width 0.2) (layer "F.Cu") (net "GND")) (zone (net 1) (layer "F.Cu") (keepout (tracks not_allowed)) (polygon (pts (xy 0 0) (xy 1 0) (xy 1 1)))) (dimension (width 0.1)) (gr_line (start nope 0) (end 1 1) (layer "Edge.Cuts")))`;
    const result = parse(source);
    expect(result.plan?.tracks[0]?.net).toBe("GND");
    expect(result.plan?.zones).toEqual([]);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "kicad.oldVersion",
        "kicad.ruleArea",
        "kicad.unsupported",
        "kicad.badNumber",
      ]),
    );
    expect(
      result.diagnostics.find((item) => item.code === "kicad.badNumber"),
    ).toMatchObject({ line: 1, column: expect.any(Number) });
    expect(parse("(kicad_sch)").diagnostics[0]?.code).toBe("kicad.unknownRoot");
    expect(parse("PCBNEW-BOARD Version 1").diagnostics[0]?.code).toBe(
      "kicad.legacyFormat",
    );
    expect(
      importKicad("(kicad_pcb (version 20240108))", {
        fileName: "board.kicad_pcb",
      }).diagnostics.at(-1)?.code,
    ).toBe("kicad.pcbRoot");
  });

  test("parses a pts arc with a warning and supports other pinned inline syntax", () => {
    const result = parse(
      "(kicad_pcb (layers (0 F.Cu signal)) (gr_line (start 0 0) (end 1 0) (stroke (width 0.12) (type solid)) (layer F.Cu)) (zone (net 0) (layer F.Cu) (polygon (pts (xy 0 0) (arc (start 1 1) (mid 2 2) (end 3 3)) (xy 4 4) (xy 0 4)))))",
    );
    expect(result.plan?.graphics[0]?.width).toBe(0.12);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "kicad.polygonArc",
    );
    expect(result.plan?.zones[0]?.outline).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [0, 4],
    ]);
    const skipped = parse("(kicad_pcb (dimension) (dimension))");
    expect(
      skipped.diagnostics.find((item) => item.code === "kicad.unsupported")
        ?.message,
    ).toContain("Skipped 2 dimension items.");
    const quotedNumericName = parse(
      `(kicad_pcb (net 5 "5") (segment (start 0 0) (end 1 0) (width 0.2) (layer F.Cu) (net "5")))`,
    );
    expect(quotedNumericName.plan?.tracks[0]?.net).toBe("5");
  });

  test("parses a large list of segments without regex splitting", () => {
    const segments = Array.from(
      { length: 20_000 },
      (_, index) =>
        `(segment (start ${index} 0) (end ${index + 1} 0) (width 0.2) (layer F.Cu) (net 0))`,
    ).join("");
    expect(parse(`(kicad_pcb ${segments})`).plan?.tracks).toHaveLength(20_000);
  });
});
