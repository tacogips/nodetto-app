import { expect, test } from "bun:test";
import type { Document, Element } from "@nodetto/ir";
import { boardHoles } from "./board.ts";
import {
  BREADBOARD_PCB_RULES,
  encodeBreadboardPcbZip,
  exportBreadboardPcb,
  type BreadboardPcb,
} from "./pcb.ts";
import { strokeFontSupports, strokeText, strokeTextWidth } from "./pcb-font.ts";
import {
  buildBreadboardDocument,
  type BreadboardTestBoard,
  type BreadboardTestSpec,
} from "./test-builder.ts";

const PAGE = "breadboard-page";

function holesOf(board: BreadboardTestBoard) {
  const document = buildBreadboardDocument({ boards: [board] });
  const element = document.elements.find(
    (candidate) => candidate.type === "breadboard.board",
  ) as Element;
  const holes = new Map(
    boardHoles(element).map((hole) => [
      hole.id,
      { x: hole.pageX, y: hole.pageY },
    ]),
  );
  return (id: string) => {
    const hole = holes.get(id);
    if (!hole) throw new Error(`no hole ${id}`);
    return hole;
  };
}

/** Hole centre in board millimetres for a half board: column 1 is x = 2. */
function mm(id: string): { x: number; y: number } {
  const half = holesOf({ id: "probe", size: "half" })(id);
  return {
    x: Math.round((half.x / 10) * 2.54 * 1e6) / 1e6,
    y: Math.round((22 - half.y / 10) * 2.54 * 1e6) / 1e6,
  };
}

interface Stroke {
  readonly aperture: string;
  readonly points: { x: number; y: number }[];
}
interface Flash {
  readonly aperture: string;
  readonly at: { x: number; y: number };
}

function parseGerber(text: string): {
  readonly flashes: Flash[];
  readonly strokes: Stroke[];
} {
  const apertures = new Map<string, string>();
  const flashes: Flash[] = [];
  const strokes: Stroke[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    const definition = /^%ADD(?<code>\d+)(?<shape>.+)\*%$/.exec(line)?.groups;
    if (definition) {
      apertures.set(`D${definition.code}`, definition.shape ?? "");
      continue;
    }
    const select = /^(?<code>D\d+)\*$/.exec(line)?.groups;
    if (select) {
      const shape = apertures.get(select.code ?? "");
      if (shape === undefined) throw new Error(`${select.code} used undefined`);
      current = shape;
      continue;
    }
    const op = /^X(?<x>-?\d+)Y(?<y>-?\d+)D0(?<code>[123])\*$/.exec(
      line,
    )?.groups;
    if (!op) continue;
    const at = { x: Number(op.x) / 1e6, y: Number(op.y) / 1e6 };
    if (op.code === "3") flashes.push({ aperture: current, at });
    else if (op.code === "2") strokes.push({ aperture: current, points: [at] });
    else strokes.at(-1)?.points.push(at);
  }
  return { flashes, strokes };
}

function file(pcb: BreadboardPcb, extension: string): string {
  const found = pcb.files.find((candidate) =>
    candidate.path.endsWith(`.${extension}`),
  );
  if (!found) throw new Error(`no ${extension} file`);
  return found.text;
}

function exported(document: Document, board?: string): BreadboardPcb {
  const pcb = exportBreadboardPcb(document, PAGE, {
    name: "fixture",
    ...(board === undefined ? {} : { board }),
  });
  if (typeof pcb === "string") throw new Error(pcb);
  return pcb;
}

const at = holesOf({ id: "board-1", size: "half" });

/**
 * A DIP-8 across the channel, two resistors sharing column 3, a rail wire
 * with a clear path, and a wire that runs over R2's pad on another net.
 */
const fixture: BreadboardTestSpec = {
  boards: [{ id: "board-1", size: "half" }],
  parts: [
    { id: "u1", type: "breadboard.ic", reference: "U1", pin1: at("f10") },
    {
      id: "r1",
      type: "breadboard.resistor",
      reference: "R1",
      pin1: at("a3"),
      semantic: { span: 3 },
    },
    {
      id: "r2",
      type: "breadboard.resistor",
      reference: "R2",
      pin1: at("c3"),
      semantic: { span: 4 },
    },
  ],
  wires: [
    { id: "w-rail", points: [at("T+4"), at("a4")] },
    { id: "w-over", points: [at("c1"), at("c5")] },
  ],
};

test("strips join used holes on the bottom layer and pads cover every lead", () => {
  const pcb = exported(buildBreadboardDocument(fixture));
  expect(pcb.warnings).toEqual([]);
  expect(pcb.width).toBe(83.82);
  expect(pcb.height).toBe(55.88);
  expect(pcb.files.map((entry) => entry.path)).toEqual([
    "fixture.GTL",
    "fixture.GBL",
    "fixture.GTS",
    "fixture.GBS",
    "fixture.GTO",
    "fixture.GKO",
    "fixture.DRL",
  ]);

  const bottom = parseGerber(file(pcb, "GBL"));
  expect(bottom.flashes).toHaveLength(16);
  expect(bottom.strokes).toEqual([
    { aperture: "C,0.800000", points: [mm("c3"), mm("a3")] },
  ]);
  const top = parseGerber(file(pcb, "GTL"));
  expect(
    top.flashes.filter((flash) => flash.aperture.startsWith("R,")),
  ).toEqual([{ aperture: "R,1.800000X1.800000", at: mm("f10") }]);
  const drill = file(pcb, "DRL");
  expect(drill.match(/^X/gm)).toHaveLength(16);
  expect(drill).toContain("T1C1.000");
  expect(drill).toContain(`X${mm("f10").x}Y${mm("f10").y}`);
});

test("a wire with a clear path becomes a trace and one over a pad stays a jumper", () => {
  const pcb = exported(buildBreadboardDocument(fixture));
  expect(parseGerber(file(pcb, "GTL")).strokes).toEqual([
    { aperture: "C,0.500000", points: [mm("T+4"), mm("a4")] },
  ]);
  expect(parseGerber(file(pcb, "GTO")).strokes).toContainEqual({
    aperture: `C,${BREADBOARD_PCB_RULES.legendLine.toFixed(6)}`,
    points: [mm("c1"), mm("c5")],
  });
  expect(pcb.notes).toContain(
    "1 of 2 wire(s) are top-layer traces; solder the other 1 as jumper wires along their silkscreen lines.",
  );
});

test("a wire may pass over pads on its own net", () => {
  const pcb = exported(
    buildBreadboardDocument({
      ...fixture,
      wires: [{ id: "w-own", points: [at("c2"), at("c4")] }],
      parts: [
        ...(fixture.parts ?? []),
        {
          id: "r3",
          type: "breadboard.resistor",
          reference: "R3",
          pin1: at("e2"),
          semantic: { span: 1 },
        },
      ],
    }),
  );
  // c2 to c4 crosses c3 (column 3, R2's net) so it is a jumper ...
  expect(parseGerber(file(pcb, "GTL")).strokes).toEqual([]);
  // ... while R3 bridging columns 2 and 3 puts c3 on the wire's net.
  const bridged = exported(
    buildBreadboardDocument({
      ...fixture,
      wires: [{ id: "w-own", points: [at("c2"), at("c3")] }],
    }),
  );
  expect(parseGerber(file(bridged, "GTL")).strokes).toHaveLength(1);
});

test("parts and wires off the board are left off with warnings", () => {
  const pcb = exported(
    buildBreadboardDocument({
      ...fixture,
      parts: [
        ...(fixture.parts ?? []),
        {
          id: "d-off",
          type: "breadboard.led",
          reference: "D9",
          pin1: { x: 1000, y: 1000 },
        },
        {
          id: "c-half",
          type: "breadboard.capacitor",
          reference: "C1",
          pin1: { x: at("a30").x, y: at("a30").y },
          semantic: { span: 3 },
        },
      ],
      wires: [{ id: "w-out", points: [at("j20"), { x: 2000, y: 0 }] }],
    }),
  );
  expect(pcb.warnings).toEqual([
    "D9 is not seated on this board and is left off the PCB.",
    "C1 has pin 2 outside the board holes and is left off the PCB.",
    "The wire from j20 leaves this board and is left off the PCB.",
  ]);
});

test("two leads in one hole are reported", () => {
  const pcb = exported(
    buildBreadboardDocument({
      boards: [{ id: "board-1", size: "half" }],
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: at("a3"),
          semantic: { span: 3 },
        },
        {
          id: "d1",
          type: "breadboard.led",
          reference: "D1",
          pin1: at("a6"),
        },
      ],
    }),
  );
  expect(pcb.warnings).toEqual([
    "Hole a6 holds R1 pin 2 and D1 pin A; a PCB hole takes one lead, so move one of them to another hole in the same strip.",
  ]);
});

test("a rotated board gives the same files", () => {
  const rotatedBoard = {
    id: "board-1",
    size: "half",
    // Rotating 33 x 22 pitches about the centre keeps holes on the lattice
    // only from an origin a half pitch off it.
    x: 45,
    y: 35,
    rotation: 90,
  } as const;
  const rotatedAt = holesOf(rotatedBoard);
  const rotated = exported(
    buildBreadboardDocument({
      boards: [rotatedBoard],
      parts: (fixture.parts ?? []).map((part) => {
        const pin1 = Object.entries({ u1: "f10", r1: "a3", r2: "c3" }).find(
          ([id]) => id === part.id,
        )?.[1];
        return { ...part, pin1: rotatedAt(pin1 ?? ""), rotation: 90 };
      }),
      wires: [
        { id: "w-rail", points: [rotatedAt("T+4"), rotatedAt("a4")] },
        { id: "w-over", points: [rotatedAt("c1"), rotatedAt("c5")] },
      ],
    }),
  );
  const straight = exported(buildBreadboardDocument(fixture));
  expect(rotated.warnings).toEqual([]);
  for (const extension of ["GTL", "GBL", "GTS", "GBS", "GTO", "GKO", "DRL"])
    expect(file(rotated, extension)).toBe(file(straight, extension));
});

test("board selection", () => {
  const document = buildBreadboardDocument({
    ...fixture,
    boards: [
      { id: "board-1", size: "half" },
      { id: "board-2", size: "mini", x: 0, y: 400 },
    ],
  });
  const ambiguous = exportBreadboardPcb(document, PAGE);
  expect(ambiguous).toBe(
    "The page has 2 boards; choose one:\n  board-1 (half board at 0, 0)\n  board-2 (mini board at 0, 400)",
  );
  expect(exportBreadboardPcb(document, PAGE, { board: "board-" })).toBe(
    "2 boards have an id starting with board-; give more of the id.",
  );
  expect(exportBreadboardPcb(document, PAGE, { board: "x" })).toBe(
    "No board on this page has an id starting with x.",
  );
  expect(exported(document, "board-1").boardId).toBe("board-1");
  expect(exportBreadboardPcb(document, PAGE, { board: "board-2" })).toBe(
    "Nothing is seated on this board, so there is no PCB to make.",
  );
  expect(
    exportBreadboardPcb(buildBreadboardDocument({ boards: [] }), PAGE),
  ).toBe("The breadboard page has no board.");
});

test("Gerber files carry X2 attributes and define apertures before use", () => {
  const pcb = exported(buildBreadboardDocument(fixture));
  const functions = pcb.files
    .filter((entry) => !entry.path.endsWith(".DRL"))
    .map((entry) => {
      expect(entry.text.startsWith("%TF.GenerationSoftware,Nodetto,")).toBe(
        true,
      );
      expect(entry.text).toContain("%FSLAX46Y46*%\n%MOMM*%");
      expect(entry.text.endsWith("M02*\n")).toBe(true);
      parseGerber(entry.text);
      return /%TF\.FileFunction,(?<name>[^*]+)\*%/.exec(entry.text)?.groups
        ?.name;
    });
  expect(functions).toEqual([
    "Copper,L1,Top",
    "Copper,L2,Bot",
    "Soldermask,Top",
    "Soldermask,Bot",
    "Legend,Top",
    "Profile,NP",
  ]);
  expect(file(pcb, "GTS")).toContain("%TF.FilePolarity,Negative*%");
  expect(parseGerber(file(pcb, "GKO")).strokes).toEqual([
    {
      aperture: "C,0.100000",
      points: [
        { x: 0, y: 0 },
        { x: 83.82, y: 0 },
        { x: 83.82, y: 55.88 },
        { x: 0, y: 55.88 },
        { x: 0, y: 0 },
      ],
    },
  ]);
});

test("the archive is a deterministic ZIP of the files", () => {
  const pcb = exported(buildBreadboardDocument(fixture));
  const zip = encodeBreadboardPcbZip(pcb);
  expect(zip).toEqual(
    encodeBreadboardPcbZip(exported(buildBreadboardDocument(fixture))),
  );
  expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x04034b50);
  const end = new DataView(zip.buffer, zip.length - 22);
  expect(end.getUint32(0, true)).toBe(0x06054b50);
  expect(end.getUint16(10, true)).toBe(7);
  const listing = new TextDecoder().decode(zip);
  for (const entry of pcb.files) expect(listing).toContain(entry.path);
});

test("the stroke font covers legend text and centres it", () => {
  for (const character of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+- ")
    expect(strokeFontSupports(character)).toBe(true);
  expect(strokeFontSupports("e")).toBe(true);
  expect(strokeFontSupports("?")).toBe(false);
  expect(strokeTextWidth("", 1)).toBe(0);
  const strokes = strokeText("H8", 10, 5, 1.2);
  const xs = strokes.flat().map((point) => point.x);
  const ys = strokes.flat().map((point) => point.y);
  expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(20, 6);
  expect(Math.min(...ys)).toBeCloseTo(4.4, 6);
  expect(Math.max(...ys)).toBeCloseTo(5.6, 6);
  expect(strokeText("R?", 0, 0, 1)).toHaveLength(
    strokeText("R", 0, 0, 1).length,
  );
});
