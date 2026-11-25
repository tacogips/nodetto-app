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

test("describes incomplete coarse checks and preserves refinement-only counts", () => {
  const incomplete = [[0, 1] as const];
  const base = {
    ...analysis,
    candidates: 1,
    checked: 1,
    cappedCount: 1,
    cappedWithoutHit: incomplete,
    incomplete,
  };
  const missing = describeInterference(
    { ...report, pairs: [], analysis: base },
    bodies,
  );
  expect(missing.incomplete).toBe(1);
  expect(missing.lines).toEqual([
    "interference: 0 found, 1 of 1 checked candidate pair incomplete (cell 0.25 mm)",
    "  incomplete: Alpha x Beta; the coarse check stopped before covering this pair, interference not determined",
  ]);
  expect(missing.json?.incomplete).toEqual([["a", "b"]]);
  const pictured = describeInterference(
    {
      ...report,
      pairs: [{ ...pair, source: "view", volume: 0 }],
      analysis: base,
    },
    bodies,
  );
  expect(pictured.lines[0]).toBe(
    "interference: 1 found, 1 of 1 checked candidate pair incomplete (cell 0.25 mm)",
  );
  expect(pictured.lines[1]).toContain("found in the picture only");
  expect(pictured.lines[2]).toBe(
    "  incomplete: Alpha x Beta; the coarse check stopped before covering this pair, the overlap listed above was found in the picture only",
  );
  expect(pictured.lines.join(" ")).not.toContain("interference not determined");
  expect(pictured.json?.pairs).toHaveLength(1);
  expect(pictured.json?.incomplete).toEqual([["a", "b"]]);
  const mixed = describeInterference(
    {
      ...report,
      pairs: [],
      analysis: {
        ...base,
        checked: 2,
        cappedCount: 2,
        cappedWithoutHit: [
          [0, 1],
          [0, 2],
        ],
      },
    },
    bodies,
  );
  expect(mixed.lines.at(-1)).toContain(
    "refinement capped on 1 checked pairs (1 without a hit)",
  );
  const many = describeInterference(
    {
      ...report,
      pairs: [],
      analysis: {
        ...base,
        checked: 22,
        cappedCount: 22,
        cappedWithoutHit: Array.from({ length: 22 }, () => [0, 1] as const),
        incomplete: Array.from({ length: 22 }, () => [0, 1] as const),
      },
    },
    bodies,
  );
  expect(
    many.lines.filter((line) => line.startsWith("  incomplete:")),
  ).toHaveLength(20);
  expect(many.lines.at(-1)).toBe(
    "  ... and 2 more incomplete; narrow with --interference-bodies",
  );
  const legacy = describeInterference(report, bodies);
  const empty = describeInterference(
    { ...report, analysis: { ...analysis, incomplete: [] } },
    bodies,
  );
  expect(empty.lines).toEqual(legacy.lines);
  expect(empty.json).toEqual(legacy.json);
  expect(empty.json).not.toHaveProperty("incomplete");
  expect(
    describeInterference({ ...report, analysis: null }, bodies).incomplete,
  ).toBe(0);
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
      steps: [{ op: "difference", tool: i }],
      bounds: { min: [0, 0, 0], max: [1, 1, 1] },
    })),
    tools: states.map(() => ({ feature: "feature" })),
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

test("control characters in body names cannot forge report lines", () => {
  const forged = [
    { id: "a", name: "Alpha\nerrors: 0" },
    { id: "b", name: "Beta\r\n\u2028interference: 0" },
  ];
  const result = describeInterference(
    {
      ...report,
      pairs: [{ ...pair, volume: 0, source: "view", capped: true }],
    },
    forged,
  );
  expect(result.lines.every((line) => !/[\n\r\u2028]/.test(line))).toBe(true);
  expect(result.lines[1]).toBe(
    "  Alpha errors: 0 x Beta interference: 0: volume not measured, box 0,1,2 .. 3,4,5 mm, approximate (found in the picture only)",
  );
});

test("describes a hidden target emptied by a shared cut", () => {
  const model = {
    bodies: [
      {
        id: "wide",
        name: "wide",
        reference: false,
        steps: [
          { op: "union", tool: 0 },
          { op: "difference", tool: 2 },
        ],
        bounds: { min: [0, 0, 0], max: [1, 1, 1] },
      },
    ],
    tools: [{ feature: "base" }, { feature: "unused" }, { feature: "trim" }],
  } as unknown as CadCaptureModel;
  const state = { state: "drawn", emptiedByStep: -1, open: false } as const;
  const result = describeBodies(
    { ...report, bodies: [{ ...state, hiddenEmptiedByStep: 1 }] },
    model,
  );
  expect(result.line).toBe(
    "bodies: 1 (wide [differs from the app, see errors])",
  );
  expect(result.errors).toEqual([
    {
      id: "trim",
      code: "cad.result.empty",
      text: '(sampled): leaves no material in a hidden target body; the app rejects this feature and keeps "wide" as it was, this picture applies it',
    },
  ]);
  expect(describeBodies({ ...report, bodies: [state] }, model)).toEqual({
    line: "bodies: 1 (wide)",
    errors: [],
    notSampled: [],
  });
  expect(
    describeBodies(
      {
        ...report,
        bodies: [{ ...state, emptiedByStep: 0, hiddenEmptiedByStep: 1 }],
      },
      model,
    ).errors,
  ).toEqual(result.errors);
});

test("attributes an emptied visible target to its shared-cut sibling", () => {
  const model = {
    bodies: [
      {
        id: "rail",
        name: "rail",
        steps: [
          { op: "union", tool: 0 },
          { op: "difference", tool: 2 },
        ],
      },
      {
        id: "tab",
        name: "tab",
        steps: [
          { op: "union", tool: 1 },
          { op: "difference", tool: 2 },
        ],
      },
    ],
    tools: [
      { feature: "base" },
      { feature: "tabTool" },
      { feature: "slot" },
      { feature: "later" },
    ],
  } as unknown as CadCaptureModel;
  const rail = { state: "drawn", open: false, emptiedByStep: -1 } as const;
  const tab = { state: "empty", open: false, emptiedByStep: 1 } as const;
  const describe = (
    r: SolidReport["bodies"][number] = rail,
    t: SolidReport["bodies"][number] = tab,
    m = model,
  ) => describeBodies({ ...report, bodies: [r, t] }, m);
  const sibling =
    '(sampled): leaves no material in "tab"; the app rejects this feature and keeps "rail" as it was, this picture applies it';
  expect(describe().errors.map((e) => e.text)).toEqual([
    sibling,
    '(sampled): leaves no material in "tab"; the app rejects this feature and keeps the body, this picture applies it',
  ]);
  expect(describe().line).toContain("rail [differs from the app, see errors]");
  expect(
    describeBodies(
      { ...report, bodies: [rail] },
      { ...model, bodies: [model.bodies[0]!] },
    ).errors,
  ).toEqual([]);
  expect(describe({ ...rail, emptiedByStep: 1 }).errors[0]?.text).toContain(
    "keeps the body",
  );
  const laterModel = {
    ...model,
    bodies: [
      {
        ...model.bodies[0]!,
        steps: [
          ...model.bodies[0]!.steps,
          { op: "difference" as const, tool: 3 },
        ],
      },
      model.bodies[1]!,
    ],
  };
  expect(
    describe({ ...rail, emptiedByStep: 2 }, tab, laterModel).errors[0]?.text,
  ).toBe(sibling);
  expect(
    describe({ ...rail, hiddenEmptiedByStep: 1 }).errors[0]?.text,
  ).toContain("hidden target body");
  const laterSiblingModel = {
    ...model,
    bodies: [
      {
        ...model.bodies[0]!,
        steps: [
          { op: "union" as const, tool: 0 },
          { op: "difference" as const, tool: 3 },
          { op: "difference" as const, tool: 2 },
        ],
      },
      model.bodies[1]!,
    ],
  };
  expect(
    describe({ ...rail, hiddenEmptiedByStep: 1 }, tab, laterSiblingModel)
      .errors[0]?.text,
  ).toContain("hidden target body");
  expect(describe({ ...rail, open: true }).errors).toHaveLength(1);
  expect(describe(rail, { ...tab, open: true }).errors).toHaveLength(1);
  expect(
    describe(rail, { ...tab, state: "unknown", emptiedByStep: -1 }).errors,
  ).toHaveLength(0);
});

test("lists every unknown body beyond the summary", () => {
  const names = [
    "Bracket",
    ...Array.from({ length: 8 }, (_, i) => `Rib-${i + 1}`),
    "Gusset",
  ];
  const model = {
    bodies: names.map((name, i) => ({ id: String(i), name, steps: [] })),
    tools: [],
  } as unknown as CadCaptureModel;
  const result = describeBodies(
    {
      ...report,
      pairs: [],
      analysis: null,
      bodies: names.map((_, i) => ({
        state: i === 0 || i === 9 ? "unknown" : "drawn",
        open: false,
        emptiedByStep: -1,
      })),
    },
    model,
  );
  expect(result.notSampled).toEqual(["Bracket", "Gusset"]);
  expect(result.errors).toEqual([]);
  expect(result.line).toContain("Bracket [not sampled]");
});

test("a cut shared by many emptied bodies is attributed with linear step reads", () => {
  const counts: number[] = [];
  for (const size of [256, 512, 1024]) {
    let reads = 0;
    const step = (op: string, tool: number) => ({
      get op() {
        reads++;
        return op;
      },
      get tool() {
        reads++;
        return tool;
      },
    });
    const model = {
      tools: [
        ...Array.from({ length: size }, (_, i) => ({ feature: `base-${i}` })),
        { feature: "cut" },
        { feature: "base-stand" },
      ],
      bodies: [
        ...Array.from({ length: size }, (_, i) => ({
          id: `e-${i}`,
          name: `e-${i}`,
          steps: [step("union", i), step("difference", size)],
        })),
        {
          id: "stand",
          name: "stand",
          steps: [step("union", size + 1), step("difference", size)],
        },
      ],
    } as unknown as CadCaptureModel;
    const result = describeBodies(
      {
        ...report,
        bodies: [
          ...Array.from({ length: size }, () => ({
            state: "empty" as const,
            open: false,
            emptiedByStep: 1,
          })),
          { state: "drawn", open: false, emptiedByStep: -1 },
        ],
      },
      model,
    );
    expect(result.errors).toHaveLength(size + 1);
    for (let i = 0; i < size; i++) {
      expect(result.errors[i]).toEqual({
        id: "cut",
        code: "cad.result.empty",
        text: `(sampled): leaves no material in "e-${i}"; the app rejects this feature and keeps the body, this picture applies it`,
      });
    }
    expect(result.errors[size]).toEqual({
      id: "cut",
      code: "cad.result.empty",
      text: '(sampled): leaves no material in "e-0"; the app rejects this feature and keeps "stand" as it was, this picture applies it',
    });
    counts.push(reads);
  }
  console.log(`shared-cut reads: ${counts.join(", ")}`);
  expect(counts[1] ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    (counts[0] ?? 0) * 2.5,
  );
  expect(counts[2] ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    (counts[1] ?? 0) * 2.5,
  );

  let reads = 0;
  const steps = Array.from({ length: 256 }, () => ({
    get op() {
      reads++;
      return "union";
    },
    get tool() {
      reads++;
      return 0;
    },
  }));
  const model = {
    tools: [{ feature: "base" }],
    bodies: Array.from({ length: 256 }, (_, i) => ({
      id: String(i),
      name: String(i),
      steps,
    })),
  } as unknown as CadCaptureModel;
  expect(
    describeBodies(
      {
        ...report,
        bodies: model.bodies.map(() => ({
          state: "drawn",
          open: false,
          emptiedByStep: -1,
        })),
      },
      model,
    ).errors,
  ).toEqual([]);
  expect(reads).toBe(0);
});

test("self-exclusion uses the second indexed source", () => {
  const model = {
    tools: [{ feature: "base" }, { feature: "cut" }],
    bodies: [
      {
        id: "a",
        name: "a",
        steps: [
          { op: "union", tool: 0 },
          { op: "difference", tool: 1 },
          { op: "difference", tool: 1 },
        ],
      },
      {
        id: "b",
        name: "b",
        steps: [
          { op: "union", tool: 0 },
          { op: "difference", tool: 1 },
        ],
      },
    ],
  } as unknown as CadCaptureModel;
  const a = { state: "empty", open: false, emptiedByStep: 2 } as const;
  const b = { state: "empty", open: false, emptiedByStep: 1 } as const;
  expect(
    describeBodies({ ...report, bodies: [a, b] }, model).errors[0]?.text,
  ).toBe(
    '(sampled): leaves no material in "b"; the app rejects this feature and keeps "a" as it was, this picture applies it',
  );
  expect(
    describeBodies(
      { ...report, bodies: [a] },
      { ...model, bodies: model.bodies.slice(0, 1) },
    ).errors[0]?.text,
  ).toBe(
    '(sampled): leaves no material in "a"; the app rejects this feature and keeps the body, this picture applies it',
  );
});
