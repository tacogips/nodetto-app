import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { excellonDrill } from "./excellon.ts";
import {
  ExcellonReadError,
  isExcellon,
  readExcellon,
} from "./excellon-read.ts";

test("metric, trailing zeros kept (leading omitted), with tools, slots and plating", () => {
  const drill = readExcellon(
    [
      "M48",
      "; #@! TF.FileFunction,Plated,1,2,PTH",
      ";FORMAT={3:3/ absolute / metric / suppress leading zeros}",
      "METRIC,TZ",
      "T1C0.800",
      "T2C1.000",
      "%",
      "G90",
      "G05",
      "T1",
      "X79883Y-67183",
      "X1500Y2000",
      "T2",
      "X10000Y10000G85X12000Y10000",
      "T0",
      "M30",
    ].join("\n"),
  );
  expect(drill.warnings).toEqual([]);
  expect(drill.plating).toBe("plated");
  expect(drill.holes).toEqual([
    { at: { x: 79.883, y: -67.183 }, diameter: 0.8 },
    { at: { x: 1.5, y: 2 }, diameter: 0.8 },
  ]);
  expect(drill.slots).toEqual([
    { from: { x: 10, y: 10 }, to: { x: 12, y: 10 }, diameter: 1 },
  ]);
});

test("inches with leading zeros kept read from the left", () => {
  const drill = readExcellon(
    ["M48", "INCH,LZ", "T1C0.0400", "%", "T1", "X01Y015", "M30"].join("\n"),
  );
  // 2.4 format: 01 is 01.0000 in, 015 is 01.5000 in.
  expect(drill.holes).toEqual([{ at: { x: 25.4, y: 38.1 }, diameter: 1.016 }]);
});

test("routed slots: plunge, linear moves, retract", () => {
  const drill = readExcellon(
    [
      "M48",
      "METRIC",
      "T1C2.0",
      "%",
      "T1",
      "G00X0Y0",
      "M15",
      "G01X5.0Y0",
      "X5.0Y3.0",
      "M16",
      "G05",
      "X9.0Y9.0",
      "M30",
    ].join("\n"),
  );
  expect(drill.slots).toEqual([
    { from: { x: 0, y: 0 }, to: { x: 5, y: 0 }, diameter: 2 },
    { from: { x: 5, y: 0 }, to: { x: 5, y: 3 }, diameter: 2 },
  ]);
  expect(drill.holes).toEqual([{ at: { x: 9, y: 9 }, diameter: 2 }]);
});

test("unknown lines warn once; a file without M48 is refused", () => {
  const drill = readExcellon(
    [
      "M48",
      "METRIC",
      "T1C1.0",
      "%",
      "T1",
      "R4X1.0",
      "R4X1.0",
      "X1.0Y1.0",
      "M30",
    ].join("\n"),
  );
  expect(drill.warnings).toEqual(['line "R4X1.0" is not supported']);
  expect(drill.holes).toHaveLength(1);
  expect(isExcellon("G04 a Gerber file*")).toBe(false);
  expect(() => readExcellon("%FSLAX46Y46*%")).toThrow(ExcellonReadError);
});

test("the writer's drill files read back hole for hole", () => {
  const hits = [
    { diameter: 1, at: { x: 127, y: 30 } },
    { diameter: 1, at: { x: 2.54, y: 0.5 } },
    { diameter: 0.8, at: { x: 10, y: 10 } },
  ];
  const drill = readExcellon(excellonDrill(hits, "Test", 2));
  expect(drill.warnings).toEqual([]);
  expect(drill.plating).toBe("plated");
  expect(drill.holes).toEqual([hits[2], hits[0], hits[1]]);
  const golden = readExcellon(
    readFileSync(
      join(import.meta.dir, "../../../../examples/breadboard/led-button.DRL"),
      "utf8",
    ),
  );
  expect(golden.warnings).toEqual([]);
  expect(golden.holes.length).toBeGreaterThan(0);
});
