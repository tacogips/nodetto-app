import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import gerberParser from "gerber-parser";
import {
  type GerberObject,
  GerberReadError,
  readGerber,
} from "./gerber-read.ts";

/** A self-authored image using every construct the reader interprets. */
const SAMPLE = [
  "%TF.GenerationSoftware,Nodetto,Test*%",
  "%TF.FileFunction,Copper,L1,Top*%",
  "%FSLAX46Y46*%",
  "%MOMM*%",
  "%AMROUNDED*",
  "0 A rectangle with two circles at the ends, from parameters*",
  "$3=$1/2*",
  "21,1,$1,$2,0,0,0*",
  "1,1,$2,0-$3,0*",
  "1,1,$2,$3,0*%",
  "%ADD10C,0.250000*%",
  "%ADD11R,1.200000X0.800000*%",
  "%ADD12O,1.000000X2.000000*%",
  "%ADD13P,1.500000X6X30*%",
  "%ADD14ROUNDED,2.000000X1.000000*%",
  "%LPD*%",
  "G01*",
  "D10*",
  "X0Y0D02*",
  "X10000000Y0D01*",
  // A deprecated modal draw: no D code repeats D01.
  "X10000000Y5000000*",
  "G75*",
  "G03X5000000Y10000000I-5000000J0D01*",
  "D11*",
  "X20000000Y20000000D03*",
  "D12*",
  "X22000000Y20000000D03*",
  "D13*",
  "X24000000Y20000000D03*",
  "D14*",
  "X26000000Y20000000D03*",
  "G36*",
  "X30000000Y0D02*",
  "G01X40000000Y0D01*",
  "X40000000Y10000000D01*",
  "X30000000Y0D01*",
  "G37*",
  "%LPC*%",
  "D10*",
  "X35000000Y2000000D03*",
  "M02*",
  "",
].join("\n");

const kinds = (objects: readonly GerberObject[]) =>
  objects.map((object) => object.kind);

test("reads apertures, draws, arcs, flashes and regions in file order", () => {
  const image = readGerber(SAMPLE);
  expect(image.warnings).toEqual([]);
  expect(kinds(image.objects)).toEqual([
    "draw",
    "draw",
    "draw",
    "flash",
    "flash",
    "flash",
    "flash",
    "region",
    "flash",
  ]);
  const [line, modal, arc, rect, oval, polygon, macro, region, clear] =
    image.objects;
  expect(line).toMatchObject({
    from: { x: 0, y: 0 },
    to: { x: 10, y: 0 },
    aperture: { kind: "circle", diameter: 0.25 },
  });
  expect(modal).toMatchObject({ from: { x: 10, y: 0 }, to: { x: 10, y: 5 } });
  expect(arc).toMatchObject({
    to: { x: 5, y: 10 },
    arc: { center: { x: 5, y: 5 }, clockwise: false },
  });
  expect(rect).toMatchObject({
    at: { x: 20, y: 20 },
    aperture: { kind: "rectangle", width: 1.2, height: 0.8 },
  });
  expect(oval).toMatchObject({
    aperture: { kind: "obround", width: 1, height: 2 },
  });
  expect(polygon).toMatchObject({
    aperture: { kind: "polygon", diameter: 1.5, vertices: 6, rotation: 30 },
  });
  expect(macro).toMatchObject({
    aperture: {
      kind: "macro",
      name: "ROUNDED",
      primitives: [
        { kind: "centerLine", width: 2, height: 1, center: { x: 0, y: 0 } },
        { kind: "circle", diameter: 1, center: { x: -1, y: 0 } },
        { kind: "circle", diameter: 1, center: { x: 1, y: 0 } },
      ],
    },
  });
  expect(region).toMatchObject({
    polarity: "dark",
    contours: [
      {
        start: { x: 30, y: 0 },
        segments: [
          { to: { x: 40, y: 0 } },
          { to: { x: 40, y: 10 } },
          { to: { x: 30, y: 0 } },
        ],
      },
    ],
  });
  expect(clear).toMatchObject({ polarity: "clear", at: { x: 35, y: 2 } });
  expect(image.attributes.get(".FileFunction")).toEqual([
    "Copper",
    "L1",
    "Top",
  ]);
});

test("another implementation reads the same flashes and end points", () => {
  const parser = gerberParser({ filetype: "gerber" }) as unknown as {
    parseSync(text: string): readonly {
      type: string;
      op?: string;
      coord?: { x?: number; y?: number };
    }[];
  };
  const theirs: string[] = [];
  let at = { x: 0, y: 0 };
  let previous: string | undefined;
  for (const command of parser.parseSync(SAMPLE))
    if (command.type === "op" && command.coord) {
      at = { x: command.coord.x ?? at.x, y: command.coord.y ?? at.y };
      // "last" is a coordinate block without a D code: the previous operation.
      const op = command.op === "last" ? previous : command.op;
      previous = op;
      if (op === "flash" || op === "int") theirs.push(`${op} ${at.x} ${at.y}`);
    }
  const mine = readGerber(SAMPLE).objects.flatMap((object) =>
    object.kind === "flash"
      ? [`flash ${object.at.x} ${object.at.y}`]
      : object.kind === "draw"
        ? [`int ${object.to.x} ${object.to.y}`]
        : object.contours.flatMap((contour) =>
            contour.segments.map(
              (segment) => `int ${segment.to.x} ${segment.to.y}`,
            ),
          ),
  );
  expect(mine).toEqual(theirs);
});

test("inches, trailing-zero omission and the legacy G04 attribute comments", () => {
  const image = readGerber(
    [
      "G04 #@! TF.FileFunction,Legend,Bot*",
      "%FSTAX24Y24*%",
      "%MOIN*%",
      "%ADD10C,0.0100*%",
      "D10*",
      // Trailing zeros omitted, digits fill from the left: 01 is 01.0000 in.
      "X01Y015D02*",
      "X02D01*",
      "M02*",
    ].join("\n"),
  );
  expect(image.warnings).toEqual([]);
  expect(image.attributes.get(".FileFunction")).toEqual(["Legend", "Bot"]);
  expect(image.objects[0]).toMatchObject({
    from: { x: 25.4, y: 38.1 },
    to: { x: 50.8, y: 38.1 },
    aperture: { kind: "circle", diameter: 0.254 },
  });
});

test("single-quadrant arcs pick the centre that fits within 90 degrees", () => {
  const image = readGerber(
    [
      "%FSLAX33Y33*%",
      "%MOMM*%",
      "%ADD10C,0.1*%",
      "D10*",
      "G74*",
      "X1000Y0D02*",
      "G03X0Y1000I1000J0D01*",
      "M02*",
    ].join("\n"),
  );
  expect(image.objects[0]).toMatchObject({
    arc: { center: { x: 0, y: 0 }, clockwise: false },
  });
});

test("old files with several parameters in one block still read", () => {
  const image = readGerber(
    [
      "%FSLAX24Y24*MOIN*IPPOS*%",
      "%ADD10C,0.01*%",
      "D10*",
      "X10000Y0D03*",
      "M02*",
    ].join("\n"),
  );
  expect(image.warnings).toEqual([]);
  expect(image.objects[0]).toMatchObject({ at: { x: 25.4, y: 0 } });
});

test("unsupported content is reported once and skipped", () => {
  const image = readGerber(
    [
      "%FSLAX46Y46*%",
      "%MOMM*%",
      "%SRX2Y2I1J1*%",
      "%SRX2Y2I1J1*%",
      "%ADD10C,0.1*%",
      "D10*",
      "X0Y0D03*",
    ].join("\n"),
  );
  expect(image.warnings).toEqual([
    "step and repeat (%SR) is not supported; drawn once",
    "the file does not end with M02",
  ]);
  expect(image.objects).toHaveLength(1);
});

test("unreadable files throw GerberReadError", () => {
  expect(() => readGerber("%FSLAX46Y46*")).toThrow(GerberReadError);
  expect(() => readGerber("%FSLAX46Y46*%\n%MOFT*%")).toThrow("unknown unit");
  expect(() => readGerber("X1Y1D03*")).toThrow("coordinates before %FS format");
});

test("the writer's own files read back as the design they came from", () => {
  const examples = join(import.meta.dir, "../../../../examples/breadboard");
  const top = readGerber(
    readFileSync(join(examples, "led-button.GTL"), "utf8"),
  );
  const mask = readGerber(
    readFileSync(join(examples, "led-button.GTS"), "utf8"),
  );
  expect(top.warnings).toEqual([]);
  expect(top.attributes.get(".FileFunction")).toEqual(["Copper", "L1", "Top"]);
  expect(mask.attributes.get(".FilePolarity")).toEqual(["Negative"]);
  const pads = top.objects.filter((object) => object.kind === "flash");
  expect(pads.length).toBeGreaterThan(0);
  expect(mask.objects.filter((object) => object.kind === "flash")).toHaveLength(
    pads.length,
  );
});
