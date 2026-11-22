import { expect, test } from "bun:test";
import { parseSolidReport } from "./report.ts";

const body = { state: "drawn", emptiedByStep: -1, open: false } as const;
const report = {
  width: 64,
  height: 128,
  bodies: [body],
  analysis: null,
  pairs: [],
};
const analysis = {
  cell: 0.25,
  candidates: 3,
  checked: 2,
  unchecked: [[0, 1]],
  uncheckedCount: 1,
} as const;
const pair = {
  a: 0,
  b: 3,
  volume: 1.25,
  min: [0, 1, 2],
  max: [3, 4, 5],
  source: "analysis",
  capped: false,
} as const;

test("reads interim and final Rust report shapes", () => {
  expect(parseSolidReport(JSON.stringify(report))).toEqual(report);
  const analysed = {
    ...report,
    analysis,
    pairs: [pair, { ...pair, source: "view" }],
    bodies: (
      ["drawn", "hidden", "absent", "outside", "empty", "unknown"] as const
    ).map((state) => ({ ...body, state })),
  } as const;
  expect(parseSolidReport(JSON.stringify(analysed))).toEqual(analysed);
});

test.each([
  { ...report, analysis: undefined },
  { ...report, bodies: [null] },
  { ...report, bodies: [{ ...body, state: "occluded" }] },
  { ...report, bodies: [{ ...body, open: "false" }] },
  { ...report, bodies: [{ ...body, emptiedByStep: -2 }] },
  { ...report, width: "64" },
  { ...report, height: 64.5 },
  { ...report, analysis: { ...analysis, unchecked: [[0, 1, 2]] } },
  { ...report, pairs: [{ ...pair, min: [1, 2] }] },
  { ...report, pairs: [{ ...pair, source: "sample" }] },
])("rejects a malformed report %j", (value) => {
  expect(() => parseSolidReport(JSON.stringify(value))).toThrow(
    "Invalid solid capture report",
  );
});

test("rejects a real that decodes to a nonfinite number", () => {
  expect(() =>
    parseSolidReport(
      JSON.stringify({ ...report, analysis }).replace("0.25", "1e999"),
    ),
  ).toThrow("Invalid solid capture report");
});
