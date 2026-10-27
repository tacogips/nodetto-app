import { expect, test } from "bun:test";
import { pcbFabricationFiles } from "./fabrication.ts";
import type { PcbDesign } from "./model.ts";
import { readIndependently } from "./oracle.test-support.ts";
import { validateExcellon, validateGerber } from "./validate.ts";

/** A hand-built design: no breadboard involved. */
const design: PcbDesign = {
  width: 140,
  height: 40,
  rules: {
    pad: 1.8,
    maskOpening: 1.9,
    drill: 1.0,
    legendLine: 0.18,
    edgeLine: 0.1,
  },
  pads: [
    { at: { x: 10, y: 10 }, shape: "square" },
    { at: { x: 12.54, y: 10 }, shape: "circle" },
    // Whole millimetres: the drill file must still carry a decimal point.
    { at: { x: 127, y: 30 }, shape: "circle" },
  ],
  topTraces: [
    {
      width: 0.5,
      points: [
        { x: 12.54, y: 10 },
        { x: 127, y: 30 },
      ],
    },
  ],
  bottomTraces: [
    {
      width: 0.8,
      points: [
        { x: 10, y: 10 },
        { x: 10, y: 20 },
        { x: 12.54, y: 20 },
      ],
    },
  ],
  legend: [
    {
      points: [
        { x: 5, y: 5 },
        { x: 20, y: 5 },
      ],
    },
    {
      points: [
        { x: 1, y: 38 },
        { x: 3, y: 38 },
      ],
      group: 0,
    },
  ],
};

const files = pcbFabricationFiles(design, {
  name: "board",
  generator: "Example,Test",
  drillTitle: "Example test",
});
const text = (extension: string) => {
  const found = files.find((entry) => entry.path === `board.${extension}`);
  if (!found) throw new Error(`no ${extension}`);
  return found.text;
};
// gerber-parser describes each tool with its shape, sizes and (empty) hole.
const circle = (diameter: number) => ({
  shape: "circle",
  params: [diameter],
  hole: [],
});
const square = (side: number) => ({
  shape: "rect",
  params: [side, side],
  hole: [],
});

test("writes the board-house file set in a fixed order", () => {
  expect(files.map((entry) => entry.path)).toEqual([
    "board.GTL",
    "board.GBL",
    "board.GTS",
    "board.GBS",
    "board.GTO",
    "board.GKO",
    "board.DRL",
  ]);
  for (const entry of files)
    expect(
      entry.path.endsWith(".DRL")
        ? validateExcellon(entry.text, design)
        : validateGerber(entry.text, design),
    ).toEqual([]);
  expect(text("GTL")).toContain("%TF.GenerationSoftware,Example,Test*%");
  expect(text("DRL").split("\n").slice(0, 3)).toEqual([
    "M48",
    "; Example test drill file: plated holes, millimetres, absolute, decimal point coordinates",
    "; #@! TF.FileFunction,Plated,1,2,PTH",
  ]);
});

test("an independent parser reads the copper and mask as designed", () => {
  for (const [extension, size] of [
    ["GTL", 1.8],
    ["GBL", 1.8],
    ["GTS", 1.9],
    ["GBS", 1.9],
  ] as const) {
    const read = readIndependently(text(extension), "gerber");
    expect(read.warnings).toEqual([]);
    expect(read.units).toBe("mm");
    expect(read.places).toEqual([4, 6]);
    expect(read.flashes).toEqual([
      { at: { x: 10, y: 10 }, tool: square(size) },
      { at: { x: 12.54, y: 10 }, tool: circle(size) },
      { at: { x: 127, y: 30 }, tool: circle(size) },
    ]);
  }
  expect(readIndependently(text("GTL"), "gerber").segments).toEqual([
    { from: { x: 12.54, y: 10 }, to: { x: 127, y: 30 }, tool: circle(0.5) },
  ]);
  expect(readIndependently(text("GBL"), "gerber").segments).toEqual([
    { from: { x: 10, y: 10 }, to: { x: 10, y: 20 }, tool: circle(0.8) },
    { from: { x: 10, y: 20 }, to: { x: 12.54, y: 20 }, tool: circle(0.8) },
  ]);
});

test("an independent parser reads the legend, outline and drills as designed", () => {
  const legend = readIndependently(text("GTO"), "gerber");
  expect(legend.warnings).toEqual([]);
  expect(legend.flashes).toEqual([]);
  expect(legend.segments).toEqual([
    { from: { x: 5, y: 5 }, to: { x: 20, y: 5 }, tool: circle(0.18) },
    { from: { x: 1, y: 38 }, to: { x: 3, y: 38 }, tool: circle(0.18) },
  ]);
  const outline = readIndependently(text("GKO"), "gerber");
  expect(outline.segments.map(({ to }) => to)).toEqual([
    { x: 140, y: 0 },
    { x: 140, y: 40 },
    { x: 0, y: 40 },
    { x: 0, y: 0 },
  ]);
  const drill = readIndependently(text("DRL"), "drill");
  expect(drill.warnings).toEqual([]);
  expect(drill.units).toBe("mm");
  expect(drill.flashes).toEqual(
    design.pads.map((pad) => ({ at: pad.at, tool: circle(1.0) })),
  );
  expect(text("DRL")).toContain("X127.000Y30.000");
});

test("the oracle reports what it does not expect", () => {
  const broken = text("GTL").replace("%MOMM*%", "%MOIN*%\n%XYZ*%");
  expect(readIndependently(broken, "gerber").warnings).not.toEqual([]);
});
