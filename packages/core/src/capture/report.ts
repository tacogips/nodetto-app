import type { Vec3 } from "../cad/vec.ts";

interface SolidBodyReport {
  readonly state:
    | "drawn"
    | "hidden"
    | "absent"
    | "outside"
    | "empty"
    | "unknown";
  readonly emptiedByStep: number;
  readonly hiddenEmptiedByStep?: number;
  readonly open: boolean;
}

interface SolidAnalysisReport {
  readonly cell: number;
  readonly candidates: number;
  readonly checked: number;
  readonly unchecked: readonly (readonly [number, number])[];
  readonly uncheckedCount: number;
  readonly cappedCount: number;
  readonly budget: number;
  readonly cappedWithoutHit: readonly (readonly [number, number])[];
}

interface SolidPairReport {
  readonly a: number;
  readonly b: number;
  readonly volume: number;
  readonly min: Vec3;
  readonly max: Vec3;
  readonly source: "analysis" | "view";
  readonly capped: boolean;
}

export interface SolidReport {
  readonly width: number;
  readonly height: number;
  readonly bodies: readonly SolidBodyReport[];
  readonly analysis: SolidAnalysisReport | null;
  readonly pairs: readonly SolidPairReport[];
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function integer(value: unknown, min = 0): value is number {
  return finite(value) && Number.isSafeInteger(value) && value >= min;
}

function vector(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every(finite);
}

function body(value: unknown): value is SolidBodyReport {
  return (
    object(value) &&
    (value.state === "drawn" ||
      value.state === "hidden" ||
      value.state === "absent" ||
      value.state === "outside" ||
      value.state === "empty" ||
      value.state === "unknown") &&
    integer(value.emptiedByStep, -1) &&
    (value.hiddenEmptiedByStep === undefined ||
      integer(value.hiddenEmptiedByStep)) &&
    typeof value.open === "boolean"
  );
}

function analysis(value: unknown): value is SolidAnalysisReport | null {
  return (
    value === null ||
    (object(value) &&
      finite(value.cell) &&
      integer(value.candidates) &&
      integer(value.checked) &&
      Array.isArray(value.unchecked) &&
      value.unchecked.every(
        (pair) =>
          Array.isArray(pair) &&
          pair.length === 2 &&
          pair.every((index) => integer(index)),
      ) &&
      integer(value.uncheckedCount) &&
      integer(value.cappedCount) &&
      integer(value.budget) &&
      Array.isArray(value.cappedWithoutHit) &&
      value.cappedWithoutHit.every(
        (pair) =>
          Array.isArray(pair) &&
          pair.length === 2 &&
          pair.every((index) => integer(index)),
      ))
  );
}

function pair(value: unknown): value is SolidPairReport {
  return (
    object(value) &&
    integer(value.a) &&
    integer(value.b) &&
    finite(value.volume) &&
    vector(value.min) &&
    vector(value.max) &&
    (value.source === "analysis" || value.source === "view") &&
    typeof value.capped === "boolean"
  );
}

function isSolidReport(value: unknown): value is SolidReport {
  return (
    object(value) &&
    integer(value.width, 1) &&
    integer(value.height, 1) &&
    Array.isArray(value.bodies) &&
    value.bodies.every(body) &&
    analysis(value.analysis) &&
    Array.isArray(value.pairs) &&
    value.pairs.every(pair)
  );
}

/** Validate the report before using dimensions and body states from the host. */
export function parseSolidReport(json: string): SolidReport {
  const report: unknown = JSON.parse(json);
  if (!isSolidReport(report)) throw new Error("Invalid solid capture report.");
  return report;
}

/** Check that a validated renderer report describes the requested scene. */
export function assertSolidReportMatches(
  report: SolidReport,
  expected: { width: number; height: number; bodies: number },
): void {
  if (
    report.width !== expected.width ||
    report.height !== expected.height ||
    report.bodies.length !== expected.bodies
  )
    throw new Error(
      "The solid capture report does not match the requested scene.",
    );
}
