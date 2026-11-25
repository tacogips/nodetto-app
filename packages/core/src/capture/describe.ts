import type { Vec3 } from "../cad/vec.ts";
import type { SolidReport } from "./report.ts";
import type { CadCaptureModel } from "./scene.ts";

export interface DescribedPair {
  readonly a: string;
  readonly b: string;
  readonly aName: string;
  readonly bName: string;
  readonly volumeMm3: number;
  readonly min: Vec3;
  readonly max: Vec3;
  readonly source: "analysis" | "view";
  readonly approximate: boolean;
}
export interface CaptureInterferenceJson {
  readonly cellMm: number;
  readonly candidates: number;
  readonly checked: number;
  readonly unchecked: readonly (readonly [string, string])[];
  readonly uncheckedCount: number;
  readonly cappedCount: number;
  readonly cappedWithoutHit: readonly (readonly [string, string])[];
  readonly incomplete?: readonly (readonly [string, string])[];
  readonly budget: number;
  readonly pairs: readonly DescribedPair[];
}
const decimal = (n: number) => String(Number(n.toFixed(3)));
const vector = (v: Vec3) => v.map(decimal).join(",");
const volume = (n: number) => String(Number(n.toPrecision(4)));

/**
 * Names come from the document. A line break inside one could forge a
 * report line such as `errors: 0` in the text an agent reads.
 */
function plain(name: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
  return name.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ");
}

export function describeInterference(
  report: SolidReport,
  bodies: readonly { readonly id: string; readonly name: string }[],
): {
  readonly found: number;
  readonly unchecked: number;
  readonly incomplete: number;
  readonly lines: readonly string[];
  readonly json: CaptureInterferenceJson | null;
} {
  const analysis = report.analysis;
  if (!analysis)
    return {
      found: 0,
      unchecked: 0,
      incomplete: 0,
      lines: ["interference: not checked"],
      json: null,
    };
  const body = (i: number) => bodies[i] ?? { id: String(i), name: String(i) };
  const ids = ([a, b]: readonly [number, number]): readonly [
    string,
    string,
  ] => [body(a).id, body(b).id];
  const pairs = report.pairs.map(
    (p): DescribedPair => ({
      a: body(p.a).id,
      b: body(p.b).id,
      aName: body(p.a).name,
      bName: body(p.b).name,
      volumeMm3: p.volume,
      min: p.min,
      max: p.max,
      source: p.source,
      approximate: p.capped,
    }),
  );
  const incomplete = analysis.incomplete ?? [];
  const k = incomplete.length;
  const lines = [
    analysis.uncheckedCount > 0
      ? `interference: ${pairs.length} found, ${analysis.uncheckedCount} of ${analysis.candidates} candidate pairs not checked (cell ${decimal(analysis.cell)} mm)`
      : k > 0
        ? `interference: ${pairs.length} found, ${k} of ${analysis.checked} checked candidate ${analysis.checked === 1 ? "pair" : "pairs"} incomplete (cell ${decimal(analysis.cell)} mm)`
        : `interference: ${pairs.length} (${analysis.checked} candidate ${analysis.checked === 1 ? "pair" : "pairs"} checked, cell ${decimal(analysis.cell)} mm)`,
  ];
  for (const p of pairs)
    lines.push(
      `  ${plain(p.aName)} x ${plain(p.bName)}: ${p.source === "view" && p.approximate && p.volumeMm3 === 0 ? "volume not measured," : `${p.volumeMm3 < 0.001 ? "volume under 0.001" : `volume ${volume(p.volumeMm3)}`} mm3,`} box ${vector(p.min)} .. ${vector(p.max)} mm${p.approximate ? ", approximate" : ""}${p.source === "view" ? " (found in the picture only)" : ""}`,
    );
  for (const [a, b] of analysis.unchecked.slice(0, 20))
    lines.push(
      `  not checked: ${plain(body(a).name)} x ${plain(body(b).name)}`,
    );
  if (analysis.uncheckedCount > 20)
    lines.push(
      `  ... and ${analysis.uncheckedCount - 20} more; narrow with --interference-bodies`,
    );
  for (const [a, b] of incomplete.slice(0, 20)) {
    const pictured = report.pairs.some((pair) => pair.a === a && pair.b === b);
    lines.push(
      `  incomplete: ${plain(body(a).name)} x ${plain(body(b).name)}; the coarse check stopped before covering this pair, ${pictured ? "the overlap listed above was found in the picture only" : "interference not determined"}`,
    );
  }
  if (k > 20)
    lines.push(
      `  ... and ${k - 20} more incomplete; narrow with --interference-bodies`,
    );
  if (analysis.cappedCount - k > 0)
    lines.push(
      `  refinement capped on ${analysis.cappedCount - k} checked pairs (${Math.max(0, analysis.cappedWithoutHit.length - k)} without a hit); sub-cell parts of those pairs may be missed; narrow with --interference-bodies`,
    );
  return {
    found: pairs.length,
    unchecked: analysis.uncheckedCount,
    incomplete: k,
    lines,
    json: {
      cellMm: analysis.cell,
      candidates: analysis.candidates,
      checked: analysis.checked,
      unchecked: analysis.unchecked.map(ids),
      uncheckedCount: analysis.uncheckedCount,
      cappedCount: analysis.cappedCount,
      cappedWithoutHit: analysis.cappedWithoutHit.map(ids),
      ...(k > 0 ? { incomplete: incomplete.map(ids) } : {}),
      budget: analysis.budget,
      pairs,
    },
  };
}

export function describeBodies(
  report: SolidReport,
  model: CadCaptureModel,
): {
  readonly line: string;
  readonly notSampled: readonly string[];
  readonly errors: readonly {
    readonly id: string;
    readonly code: string;
    readonly text: string;
  }[];
} {
  const notes = {
    drawn: "",
    hidden: " [hidden behind other bodies]",
    absent: " [not in the picture]",
    outside: " [outside the picture]",
    empty: " [no material]",
    unknown: " [not sampled]",
  } as const;
  const errors: { id: string; code: string; text: string }[] = [];
  const sources = model.bodies.flatMap((body, i) => {
    const state = report.bodies[i];
    if (!state || state.open || state.emptiedByStep === -1) return [];
    const hidden =
      state.hiddenEmptiedByStep === undefined
        ? undefined
        : body.steps[state.hiddenEmptiedByStep];
    if (hidden && model.tools[hidden.tool]) return [];
    const step = body.steps[state.emptiedByStep];
    if (
      !step ||
      !model.tools[step.tool] ||
      (step.op !== "difference" && step.op !== "intersection")
    )
      return [];
    return [{ i, body, step }];
  });
  const sourceIndex = new Map<
    number,
    Map<string, (typeof sources)[number][]>
  >();
  for (const source of sources) {
    const tool = source.step.tool;
    const op = source.step.op;
    let operations = sourceIndex.get(tool);
    if (!operations) {
      operations = new Map();
      sourceIndex.set(tool, operations);
    }
    let entries = operations.get(op);
    if (!entries) {
      entries = [];
      operations.set(op, entries);
    }
    if (entries.length < 2) entries.push(source);
  }
  const names = model.bodies.map((body, i) => {
    const state = report.bodies[i];
    if (!state) return plain(body.name);
    const hiddenStep =
      state.hiddenEmptiedByStep === undefined
        ? undefined
        : body.steps[state.hiddenEmptiedByStep];
    const hiddenTool = hiddenStep && model.tools[hiddenStep.tool];
    const ownStep =
      state.emptiedByStep === -1 ? undefined : body.steps[state.emptiedByStep];
    const ownTool = ownStep && model.tools[ownStep.tool];
    const existingIndex = hiddenTool
      ? state.hiddenEmptiedByStep
      : ownTool
        ? state.emptiedByStep
        : undefined;
    let sibling:
      | { index: number; source: (typeof sources)[number] }
      | undefined;
    if (
      !state.open &&
      sources.length > 0 &&
      !(sources.length === 1 && sources[0]?.i === i)
    ) {
      for (const [index, step] of body.steps.entries()) {
        const tool = step.tool;
        const op = step.op;
        const entries = sourceIndex.get(tool)?.get(op);
        const source = entries?.find((entry) => entry.i !== i);
        if (source) {
          sibling = { index, source };
          break;
        }
      }
    }
    const selectedSibling =
      sibling && (existingIndex === undefined || sibling.index < existingIndex)
        ? sibling
        : undefined;
    if (selectedSibling) {
      const tool = model.tools[selectedSibling.source.step.tool];
      if (tool)
        errors.push({
          id: tool.feature,
          code: "cad.result.empty",
          text: `(sampled): leaves no material in "${plain(selectedSibling.source.body.name)}"; the app rejects this feature and keeps "${plain(body.name)}" as it was, this picture applies it`,
        });
    } else if (hiddenTool) {
      errors.push({
        id: hiddenTool.feature,
        code: "cad.result.empty",
        text: `(sampled): leaves no material in a hidden target body; the app rejects this feature and keeps "${plain(body.name)}" as it was, this picture applies it`,
      });
    } else if (state.emptiedByStep !== -1) {
      const step = body.steps[state.emptiedByStep];
      const tool = step && model.tools[step.tool];
      if (tool)
        errors.push({
          id: tool.feature,
          code: "cad.result.empty",
          text: `(sampled): leaves no material in "${plain(body.name)}"; the app rejects this feature and keeps the body, this picture applies it`,
        });
    }
    return (
      plain(body.name) +
      notes[state.state] +
      ((state.state === "drawn" ||
        state.state === "hidden" ||
        state.state === "outside") &&
      (state.emptiedByStep !== -1 ||
        state.hiddenEmptiedByStep !== undefined ||
        selectedSibling !== undefined)
        ? " [differs from the app, see errors]"
        : "") +
      (state.open ? " [open mesh, not checked]" : "")
    );
  });
  return {
    line: `bodies: ${names.length} (${names.slice(0, 8).join(", ")}${names.length > 8 ? ", ..." : ""})`,
    errors,
    notSampled: model.bodies.flatMap((body, i) =>
      report.bodies[i]?.state === "unknown" ? [plain(body.name)] : [],
    ),
  };
}
