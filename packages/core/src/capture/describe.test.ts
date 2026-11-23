import { expect, test } from "bun:test";
import type { CadCaptureModel } from "./scene.ts";
import { describeBodies, describeInterference } from "./describe.ts";
import type { SolidReport } from "./report.ts";

const bodies = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
];
const analysis = {
  cell: 0.25,
  candidates: 2,
  checked: 2,
  unchecked: [],
  uncheckedCount: 0,
  cappedCount: 1,
  cappedWithoutHit: [],
  budget: 100,
};
const pair = {
  a: 0,
  b: 1,
  volume: 590.404,
  min: [0, 1, 2] as const,
  max: [3, 4, 5] as const,
  source: "analysis" as const,
  capped: true,
};
const report: SolidReport = {
  width: 1,
  height: 1,
  bodies: [],
  analysis,
  pairs: [pair, { ...pair, volume: 0.0004, source: "view", capped: false }],
};

test("describes per-pair approximation, volume and picture-only results consistently", () => {
  const result = describeInterference(report, bodies);
  expect(result.lines).toEqual([
    "interference: 2 (2 candidate pairs checked, cell 0.25 mm)",
    "  Alpha x Beta: volume 590.4 mm3, box 0,1,2 .. 3,4,5 mm, approximate",
    "  Alpha x Beta: volume under 0.001 mm3, box 0,1,2 .. 3,4,5 mm (found in the picture only)",
    "  refinement capped on 1 checked pairs (0 without a hit); sub-cell parts of those pairs may be missed; narrow with --interference-bodies",
  ]);
  expect(result.json?.pairs.map((p) => p.approximate)).toEqual([true, false]);
  expect(result.json?.pairs[0]?.a).toBe("a");
  expect(
    describeInterference(
      {
        ...report,
        pairs: [{ ...pair, volume: 12 }],
        analysis: { ...analysis, checked: 1 },
      },
      bodies,
    ).lines[1],
  ).toContain("volume 12 mm3");
});

test("lists twenty unchecked pairs and exact remainder", () => {
  const result = describeInterference(
    {
      ...report,
      pairs: [],
      analysis: {
        ...analysis,
        candidates: 25,
        checked: 0,
        unchecked: Array.from({ length: 25 }, () => [0, 1] as const),
        uncheckedCount: 25,
        cappedCount: 0,
      },
    },
    bodies,
  );
  expect(result.lines[0]).toBe(
    "interference: 0 found, 25 of 25 candidate pairs not checked (cell 0.25 mm)",
  );
  expect(
    result.lines.filter((line) => line.startsWith("  not checked:")),
  ).toHaveLength(20);
  expect(result.lines.at(-1)).toBe(
    "  ... and 5 more; narrow with --interference-bodies",
  );
  expect(result.json?.uncheckedCount).toBe(25);
  expect(
    describeInterference({ ...report, analysis: null }, bodies).lines,
  ).toEqual(["interference: not checked"]);
});

test("reports all body states and the feature that emptied a refilled body", () => {
  const states = [
    "drawn",
    "hidden",
    "absent",
    "outside",
    "empty",
    "unknown",
    "drawn",
    "drawn",
    "drawn",
  ] as const;
  const model = {
    bodies: states.map((_, i) => ({
      id: String(i),
      name: `B${i}`,
      reference: false,
      steps: [{ op: "difference", tool: 0 }],
      bounds: { min: [0, 0, 0], max: [1, 1, 1] },
    })),
    tools: [{ feature: "feature" }],
  } as unknown as CadCaptureModel;
  const result = describeBodies(
    {
      ...report,
      bodies: states.map((state, i) => ({
        state,
        open: i === 7,
        emptiedByStep: i === 6 ? 0 : -1,
      })),
    },
    model,
  );
  expect(result.line).toBe(
    "bodies: 9 (B0, B1 [hidden behind other bodies], B2 [not in the picture], B3 [outside the picture], B4 [no material], B5 [not sampled], B6 [differs from the app, see errors], B7 [open mesh, not checked], ...)",
  );
  expect(result.errors).toEqual([
    {
      id: "feature",
      code: "cad.result.empty",
      text: '(sampled): leaves no material in "B6"; the app rejects this feature and keeps the body, this picture applies it',
    },
  ]);
});
