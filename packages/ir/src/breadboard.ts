import type {
  BreadboardNetlistSemantic,
  BreadboardPartType,
} from "./semantics.ts";

export function parseComponentValue(text: string): number | undefined {
  const value = text.trim();
  if (!value) return undefined;
  const units = ["ohm", "R", "F", "V", "H"];
  let numeric = value;
  for (const unit of units) {
    if (numeric.endsWith(unit)) {
      numeric = numeric.slice(0, -unit.length);
      break;
    }
  }
  const rkm = numeric.match(/^(\d+)([RKkMmGPpNnUu\u00b5])([0-9]*)$/);
  if (rkm) {
    const prefix = rkm[2] === "R" ? "" : rkm[2];
    const number = Number(`${rkm[1]}.${rkm[3]}`);
    return scale(number, prefix);
  }
  const match = numeric.match(
    /^((?:\d+(?:\.\d*)?)|(?:\.\d+))([pnu\u00b5umkKMG]?)$/,
  );
  if (!match) return undefined;
  return scale(Number(match[1]), match[2]);
}

function scale(value: number, prefix: string): number | undefined {
  const powers: Readonly<Record<string, number>> = {
    "": 0,
    p: -12,
    n: -9,
    u: -6,
    "\u00b5": -6,
    m: -3,
    k: 3,
    K: 3,
    M: 6,
    G: 9,
  };
  const power = powers[prefix];
  if (power === undefined) return undefined;
  const result = Number(`${value}e${power}`);
  return Number.isFinite(result) ? result : undefined;
}

export interface BreadboardNetlistComponent {
  readonly elementId: string;
  readonly type: BreadboardPartType;
  readonly reference: string;
  readonly value: string;
  readonly description: string;
  readonly footprint: string;
  readonly partName: string;
  readonly pins: readonly { readonly number: number; readonly name: string }[];
}
export interface BreadboardNetlistNode {
  readonly reference: string;
  readonly pin: number;
  readonly pinName: string;
}
export interface BreadboardNetlistNet {
  readonly code: number;
  readonly name: string;
  readonly nodes: readonly BreadboardNetlistNode[];
}
export interface BreadboardNetlist {
  readonly pageId: string;
  readonly pageName: string;
  readonly documentTitle: string;
  readonly components: readonly BreadboardNetlistComponent[];
  readonly nets: readonly BreadboardNetlistNet[];
}
export interface BreadboardImportDiagnostic {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly reference?: string;
}
export interface BreadboardImportPart {
  readonly reference: string;
  readonly value: string;
  readonly type: BreadboardPartType;
  readonly parameters: Readonly<Record<string, unknown>>;
}
export interface BreadboardImportPlan {
  readonly title: string;
  readonly format: "kicad_sch" | "kicad_net";
  readonly source: string;
  readonly parts: readonly BreadboardImportPart[];
  readonly target: BreadboardNetlistSemantic;
}
export interface BreadboardImportResult {
  readonly plan?: BreadboardImportPlan;
  readonly diagnostics: readonly BreadboardImportDiagnostic[];
}

export function compareReferences(a: string, b: string): number {
  const parse = (reference: string) =>
    reference.match(/^([A-Za-z]+)(\d+|\?)(.*)$/);
  const left = parse(a);
  const right = parse(b);
  if (left && right && left[1] === right[1]) {
    const leftUnannotated = left[2] === "?";
    const rightUnannotated = right[2] === "?";
    if (leftUnannotated !== rightUnannotated) return leftUnannotated ? 1 : -1;
    if (!leftUnannotated) {
      const delta = Number(left[2]) - Number(right[2]);
      if (delta !== 0) return delta;
    }
    const suffix = left[3].localeCompare(right[3]);
    if (suffix !== 0) return suffix;
  }
  return a.localeCompare(b);
}
