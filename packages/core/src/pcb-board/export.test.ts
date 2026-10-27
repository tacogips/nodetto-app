import { describe, expect, test } from "bun:test";
import type {
  PcbFootprintSemantic,
  PcbGraphicSemantic,
  PcbPad,
} from "@nodetto/ir";
import { pcbRotate } from "@nodetto/ir";
import { buildPcbDocument } from "./test-builder.ts";
import { encodePcbBoardZip, exportPcbBoard } from "./export.ts";
import { readExcellon } from "../pcb/excellon-read.ts";
import { readGerber } from "../pcb/gerber-read.ts";
import { readIndependently } from "../pcb/oracle.test-support.ts";

const outline: PcbGraphicSemantic[] = [
  {
    layer: "Edge.Cuts",
    width: 0.1,
    fill: false,
    shape: { kind: "rect", start: [-1, -2], end: [9, 8] },
  },
];
const pad = (parts: Partial<PcbPad> = {}): PcbPad => ({
  number: "1",
  type: "thru_hole",
  shape: "circle",
  at: [1, 1],
  rotation: 0,
  size: [2, 2],
  layers: ["*.Cu", "*.Mask"],
  net: "GND",
  drill: { diameter: 0.8 },
  ...parts,
});
const footprint = (
  parts: Partial<PcbFootprintSemantic> = {},
): PcbFootprintSemantic => ({
  reference: "J1",
  value: "Conn",
  library: "",
  at: [0, 0],
  rotation: 0,
  side: "top",
  pads: [pad()],
  graphics: [],
  ...parts,
});
function exported(spec: Parameters<typeof buildPcbDocument>[0] = {}) {
  const document = buildPcbDocument({ graphics: outline, ...spec });
  const result = exportPcbBoard(document, document.pages[0]?.id ?? "");
  if (typeof result === "string") throw new Error(result);
  return result;
}
function file(result: ReturnType<typeof exported>, suffix: string): string {
  const found = result.files.find((item) => item.path.endsWith(suffix));
  if (!found) throw new Error(`missing ${suffix}`);
  return found.text;
}

describe("PCB board export", () => {
  test("uses one outline frame and emits the pinned file list with readable copper and plated drills", () => {
    const result = exported({
      footprints: [footprint()],
      tracks: [
        {
          layer: "F.Cu",
          width: 0.4,
          net: "GND",
          points: [
            [0, 0],
            [5, 5],
          ],
        },
      ],
      vias: [
        {
          at: [4, 4],
          diameter: 1,
          drill: 0.5,
          layers: ["F.Cu", "B.Cu"],
          net: "GND",
        },
      ],
    });
    expect([result.width, result.height]).toEqual([10, 10]);
    expect(result.files.map((item) => item.path)).toEqual([
      "pcb.GTL",
      "pcb.GBL",
      "pcb.GTS",
      "pcb.GBS",
      "pcb.GTO",
      "pcb.GKO",
      "pcb.DRL",
    ]);
    const copper = readGerber(file(result, ".GTL"));
    expect(copper.warnings).toEqual([]);
    const track = copper.objects.find(
      (item) => item.kind === "draw" && !item.arc,
    );
    expect(track?.kind).toBe("draw");
    if (track?.kind === "draw") {
      expect(track.from.x).toBeCloseTo(1, 6);
      expect(track.from.y).toBeCloseTo(8, 6);
      expect(track.to.x).toBeCloseTo(6, 6);
      expect(track.to.y).toBeCloseTo(3, 6);
    }
    const viaFlash = copper.objects.find(
      (item) =>
        item.kind === "flash" &&
        item.at.x === 5 &&
        item.at.y === 4 &&
        item.aperture.kind === "circle" &&
        item.aperture.diameter === 1,
    );
    expect(viaFlash?.kind).toBe("flash");
    const bottomCopper = readGerber(file(result, ".GBL"));
    expect(
      bottomCopper.objects.some(
        (item) =>
          item.kind === "flash" &&
          item.at.x === 5 &&
          item.at.y === 4 &&
          item.aperture.kind === "circle" &&
          item.aperture.diameter === 1,
      ),
    ).toBe(true);
    expect(
      copper.objects.some(
        (item) => item.kind === "flash" && item.at.x === 2 && item.at.y === 7,
      ),
    ).toBe(true);
    const drill = readExcellon(file(result, ".DRL"));
    expect(drill.warnings).toEqual([]);
    expect(drill.holes).toContainEqual({ at: { x: 2, y: 7 }, diameter: 0.8 });
    expect(drill.holes).toContainEqual({ at: { x: 5, y: 4 }, diameter: 0.5 });
  });

  test("flashes orthogonal pads and regions rotated pads", () => {
    const result = exported({
      footprints: [
        footprint({
          rotation: 45,
          pads: [pad({ shape: "rect", size: [2, 1] })],
        }),
      ],
    });
    const copper = readGerber(file(result, ".GTL"));
    const region = copper.objects.find((item) => item.kind === "region");
    expect(region?.kind).toBe("region");
    if (region?.kind === "region") {
      const actual = [
        region.contours[0]?.start,
        ...(region.contours[0]?.segments.map((segment) => segment.to) ?? []),
      ];
      const corners = [
        [-1, -0.5],
        [1, -0.5],
        [1, 0.5],
        [-1, 0.5],
        [-1, -0.5],
      ] as const;
      const center = pcbRotate([1, 1], 45);
      const expected = corners.map(([x, y]) => {
        const rotated = pcbRotate([x, y], 45);
        return { x: center[0] + rotated[0] + 1, y: 8 - center[1] - rotated[1] };
      });
      expect(actual).toHaveLength(expected.length);
      actual.forEach((point, index) => {
        expect(point?.x).toBeCloseTo(expected[index]?.x ?? 0, 6);
        expect(point?.y).toBeCloseTo(expected[index]?.y ?? 0, 6);
      });
    }
    const orthogonal = exported({
      footprints: [
        footprint({
          pads: [pad({ shape: "rect", rotation: 90, size: [2, 1] })],
        }),
      ],
    });
    expect(
      readGerber(file(orthogonal, ".GTL")).objects.some(
        (item) =>
          item.kind === "flash" &&
          item.aperture.kind === "rectangle" &&
          item.aperture.width === 1 &&
          item.aperture.height === 2,
      ),
    ).toBe(true);
    const roundrect = exported({
      footprints: [
        footprint({ pads: [pad({ shape: "roundrect", size: [2, 1] })] }),
      ],
    });
    expect(
      readGerber(file(roundrect, ".GTL")).objects.some(
        (item) => item.kind === "region",
      ),
    ).toBe(true);
    const custom = exported({
      footprints: [
        footprint({ pads: [pad({ shape: "custom", size: [1, 1] })] }),
      ],
    });
    expect(
      readGerber(file(custom, ".GTL")).objects.some(
        (item) => item.kind === "region" && item.contours[0]?.segments[0]?.arc,
      ),
    ).toBe(true);
  });

  test("writes rotated drill slots and non-plated drills only when present", () => {
    const result = exported({
      footprints: [
        footprint({
          rotation: 90,
          pads: [
            pad({ drill: { diameter: 0.8, slot: [3, 1], offset: [0.25, 0] } }),
          ],
        }),
      ],
    });
    const drills = readExcellon(file(result, ".DRL"));
    expect(drills.slots).toHaveLength(1);
    expect(drills.slots[0]?.diameter).toBe(1);
    expect(drills.slots[0]?.from.x).toBeCloseTo(2, 3);
    expect(drills.slots[0]?.to.x).toBeCloseTo(2, 3);
    const slotYs = [
      drills.slots[0]?.from.y ?? 0,
      drills.slots[0]?.to.y ?? 0,
    ].sort((a, b) => a - b);
    expect(slotYs[0]).toBeCloseTo(8.25, 3);
    expect(slotYs[1]).toBeCloseTo(10.25, 3);
    expect(
      Math.abs((drills.slots[0]?.to.y ?? 0) - (drills.slots[0]?.from.y ?? 0)),
    ).toBeCloseTo(2, 3);
    const npth = exported({
      footprints: [
        footprint({
          pads: [pad({ type: "np_thru_hole", drill: { diameter: 0.9 } })],
        }),
      ],
    });
    expect(npth.files.map((item) => item.path).at(-1)).toBe("pcb-NPTH.DRL");
    expect(readExcellon(file(npth, "-NPTH.DRL")).plating).toBe("nonPlated");
    expect(readExcellon(file(npth, ".DRL")).holes).toHaveLength(0);
  });

  test("exports bottom legend only when present, preserves warnings and notes", () => {
    const withLegend = exported({
      graphics: [
        ...outline,
        {
          layer: "B.SilkS",
          width: 0.2,
          fill: false,
          shape: { kind: "line", start: [1, 1], end: [2, 2] },
        },
      ],
      zones: [
        {
          layers: ["F.Cu"],
          net: "GND",
          outline: [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
          filled: [],
        },
      ],
      tracks: [
        {
          layer: "In1.Cu",
          width: 0.3,
          net: "GND",
          points: [
            [0, 0],
            [1, 1],
          ],
        },
      ],
      board: {
        layers: [
          { id: 0, name: "F.Cu", type: "signal" },
          { id: 1, name: "In1.Cu", type: "signal" },
          { id: 31, name: "B.Cu", type: "signal" },
          { id: 44, name: "Edge.Cuts", type: "user" },
        ],
      },
    });
    expect(withLegend.files.map((item) => item.path)).toContain("pcb.GBO");
    expect(withLegend.warnings).toContain(
      "Zone on GND has no fill; refill it in KiCad.",
    );
    expect(withLegend.warnings).toContain(
      "The board has inner copper layers (In1.Cu); only F.Cu and B.Cu are exported.",
    );
    expect(readGerber(file(withLegend, ".GTL")).objects).toHaveLength(0);
    expect(readGerber(file(withLegend, ".GBL")).objects).toHaveLength(0);
    expect(withLegend.notes).toContain(
      "Zone fills are exported as read from the KiCad file; they are not refilled after edits.",
    );
    expect(exported().files.map((item) => item.path)).not.toContain("pcb.GBO");
    const optionalDocument = buildPcbDocument({
      graphics: [
        ...outline,
        {
          layer: "B.SilkS",
          width: 0.2,
          fill: false,
          shape: { kind: "line", start: [1, 1], end: [2, 2] },
        },
      ],
      footprints: [
        footprint({
          pads: [pad({ type: "np_thru_hole", drill: { diameter: 0.9 } })],
        }),
      ],
    });
    const optional = exportPcbBoard(
      optionalDocument,
      optionalDocument.pages[0]?.id ?? "",
      { name: "My board PCB" },
    );
    if (typeof optional === "string") throw new Error(optional);
    expect(optional.files.map((item) => item.path)).toEqual([
      "My-board-PCB.GTL",
      "My-board-PCB.GBL",
      "My-board-PCB.GTS",
      "My-board-PCB.GBS",
      "My-board-PCB.GTO",
      "My-board-PCB.GBO",
      "My-board-PCB.GKO",
      "My-board-PCB.DRL",
      "My-board-PCB-NPTH.DRL",
    ]);
  });

  test("keeps silkscreen text upright, applies mirror, and grows mask openings", () => {
    const result = exported({
      graphics: [
        ...outline,
        {
          layer: "F.SilkS",
          width: 0.1,
          fill: false,
          shape: {
            kind: "text",
            text: "T",
            at: [2, 3],
            rotation: 0,
            size: [1, 1],
            thickness: 0.1,
          },
        },
        {
          layer: "F.SilkS",
          width: 0.1,
          fill: false,
          shape: {
            kind: "text",
            text: "T",
            at: [6, 3],
            rotation: 0,
            size: [1, 1],
            thickness: 0.1,
            justify: { mirror: true },
          },
        },
      ],
      footprints: [
        footprint({
          pads: [pad({ shape: "rect", size: [1, 1], maskMargin: 0.2 })],
        }),
      ],
    });
    const text = readGerber(file(result, ".GTO")).objects.filter(
      (item) => item.kind === "draw",
    );
    expect(text[0]?.kind).toBe("draw");
    expect(text[0]?.kind === "draw" && text[0].from.x < text[0].to.x).toBe(
      true,
    );
    if (text[0]?.kind === "draw" && text[1]?.kind === "draw") {
      expect(text[0].from.y).toBeCloseTo(5.5, 6);
      expect(text[0].to.y).toBeCloseTo(5.5, 6);
      expect(Math.min(text[1].from.y, text[1].to.y)).toBeCloseTo(4.5, 6);
      expect(text[0].from.y).toBeGreaterThan(
        Math.min(text[1].from.y, text[1].to.y),
      );
    }
    expect(text[2]?.kind === "draw" && text[2].from.x > text[2].to.x).toBe(
      true,
    );
    if (text[2]?.kind === "draw" && text[3]?.kind === "draw") {
      expect(text[2].from.y).toBeCloseTo(5.5, 6);
      expect(text[2].to.y).toBeCloseTo(5.5, 6);
      expect(Math.min(text[3].from.y, text[3].to.y)).toBeCloseTo(4.5, 6);
    }
    const maskText = file(result, ".GTS");
    const mask = readGerber(maskText);
    expect(maskText).toContain("%TF.FilePolarity,Negative*%");
    expect(
      mask.objects.some(
        (item) =>
          item.kind === "flash" &&
          item.aperture.kind === "rectangle" &&
          item.aperture.width === 1.4 &&
          item.aperture.height === 1.4,
      ),
    ).toBe(true);
  });

  test("reads back arc direction, zone regions, and a two-arc circular outline", () => {
    const result = exported({
      graphics: [
        {
          layer: "Edge.Cuts",
          width: 0.1,
          fill: false,
          shape: { kind: "circle", center: [4, 3], radius: 5 },
        },
      ],
      tracks: [
        {
          layer: "F.Cu",
          width: 0.3,
          net: "GND",
          points: [
            [5, 4],
            [3, 4],
          ],
          mid: [4, 3],
        },
      ],
      zones: [
        {
          layers: ["B.Cu"],
          net: "GND",
          outline: [
            [1, 1],
            [4, 1],
            [4, 4],
          ],
          filled: [
            {
              layer: "B.Cu",
              polygons: [
                [
                  [1, 1],
                  [4, 1],
                  [4, 4],
                  [1, 1],
                ],
              ],
            },
          ],
        },
      ],
    });
    const arc = readGerber(file(result, ".GTL")).objects.find(
      (item) => item.kind === "draw" && item.arc,
    );
    expect(arc?.kind === "draw" && arc.arc?.clockwise).toBe(false);
    const zone = readGerber(file(result, ".GBL")).objects.find(
      (item) => item.kind === "region",
    );
    expect(zone?.kind === "region" && zone.polarity).toBe("dark");
    const profile = readGerber(file(result, ".GKO"));
    expect(
      profile.objects.filter((item) => item.kind === "draw" && item.arc),
    ).toHaveLength(2);
    expect([result.width, result.height]).toEqual([10, 10]);
  });

  test("the independent parser accepts every generated file with no unexpected warnings", () => {
    const result = exported({
      graphics: [
        ...outline,
        {
          layer: "B.SilkS",
          width: 0.2,
          fill: false,
          shape: { kind: "line", start: [1, 1], end: [2, 2] },
        },
      ],
      footprints: [
        footprint({
          pads: [pad({ type: "np_thru_hole", drill: { diameter: 0.9 } })],
        }),
      ],
    });
    for (const item of result.files) {
      const parsed = readIndependently(
        item.text,
        item.path.endsWith(".DRL") ? "drill" : "gerber",
      );
      expect(parsed.warnings, item.path).toEqual([]);
    }
  });

  test("returns exact page and outline errors and encodes deterministic stored ZIPs", () => {
    const document = buildPcbDocument({ graphics: outline });
    expect(exportPcbBoard(document, "missing")).toBe(
      "The page is not a PCB page.",
    );
    const noOutline = buildPcbDocument();
    expect(exportPcbBoard(noOutline, noOutline.pages[0]?.id ?? "")).toBe(
      "The board has no Edge.Cuts outline.",
    );
    const a = exported();
    const b = exported();
    expect(encodePcbBoardZip(a)).toEqual(encodePcbBoardZip(b));
  });
});
