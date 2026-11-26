import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import {
  compareReferences,
  type BreadboardImportDiagnostic,
  type BreadboardImportPart,
  type BreadboardImportPlan,
} from "@nodetto/ir";
import {
  atomAt,
  child,
  children,
  numberAt,
  readSexpr,
  SEXPR_SLOT,
  type SexprList,
} from "./sexpr.ts";
import { mapKicadSymbol } from "./symbol-map.ts";
import { diagonalBudgetLimit } from "./diagonal-lookup.ts";
import { importKicad } from "./index.ts";

const fixture = (name: string) =>
  readFileSync(`test-fixtures/kicad/${name}`, "utf8");
const codes = (text: string) =>
  importKicad(text, { fileName: "inline.kicad_sch" }).diagnostics.map(
    (item) => item.code,
  );

describe("KiCad schematic import", () => {
  test("imports fixed parts, net names and rotated/mirrored pin geometry", () => {
    const result = importKicad(fixture("led-button.kicad_sch"), {
      fileName: "led-button.kicad_sch",
    });
    expect(
      result.plan?.parts.map(({ reference, value, type }) => [
        reference,
        value,
        type,
      ]),
    ).toEqual([
      ["BT1", "5V", "breadboard.battery"],
      ["D1", "red", "breadboard.led"],
      ["R1", "220", "breadboard.resistor"],
      ["SW1", "PUSH", "breadboard.button"],
    ]);
    expect(result.plan?.target.nets).toEqual([
      {
        name: "+5V",
        nodes: [
          { reference: "BT1", pin: 1 },
          { reference: "SW1", pin: 1 },
        ],
      },
      {
        name: "GND",
        nodes: [
          { reference: "BT1", pin: 2 },
          { reference: "D1", pin: 2 },
        ],
      },
      {
        name: "N_D1_1",
        nodes: [
          { reference: "D1", pin: 1 },
          { reference: "R1", pin: 2 },
        ],
      },
      {
        name: "SW_OUT",
        nodes: [
          { reference: "R1", pin: 1 },
          { reference: "SW1", pin: 3 },
        ],
      },
    ]);
    expect(result.diagnostics.map((item) => item.code)).not.toContain(
      "kicad.pinNamesMissing",
    );
  });

  test("maps 90 and 270 degree pin rotations in the specified screen direction", () => {
    const assertJoin = (angle: 90 | 270, capacitorY: -10 | 10) => {
      const source = `(kicad_sch (lib_symbols (symbol "Device:R" (symbol "R_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2")))) (symbol "Device:C" (symbol "C_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2"))))) (symbol (lib_id "Device:R") (at 20 0 ${angle}) (property "Reference" "R1") (property "Value" "1k")) (symbol (lib_id "Device:C") (at 20 ${capacitorY} 0) (property "Reference" "C1") (property "Value" "1u")))`;
      const nets = importKicad(source, { fileName: "rotation.kicad_sch" }).plan
        ?.target.nets;
      expect(nets).toContainEqual({
        name: "N_C1_1",
        nodes: [
          { reference: "C1", pin: 1 },
          { reference: "R1", pin: 2 },
        ],
      });
    };

    assertJoin(90, -10);
    assertJoin(270, 10);
  });

  test("joins power symbols with equal values into one named net", () => {
    const source =
      '(kicad_sch (lib_symbols (symbol "Device:R" (symbol "R_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2")))) (symbol "power:GND" (power) (symbol "GND_0_1" (pin power_in line (at 0 0 0) (name "GND") (number "1"))))) (symbol (lib_id "Device:R") (at 0 0 0) (property "Reference" "R1") (property "Value" "1k")) (symbol (lib_id "Device:R") (at 0 50 0) (property "Reference" "R2") (property "Value" "1k")) (symbol (lib_id "power:GND") (at 0 0 0) (property "Reference" "#PWR01") (property "Value" "GND")) (symbol (lib_id "power:GND") (at 0 50 0) (property "Reference" "#PWR02") (property "Value" "GND")) (label "SIG" (at 10 0 0)) (label "SIG" (at 10 50 0)))';
    const nets = importKicad(source, { fileName: "power.kicad_sch" }).plan
      ?.target.nets;

    expect(nets).toEqual([
      {
        name: "GND",
        nodes: [
          { reference: "R1", pin: 1 },
          { reference: "R2", pin: 1 },
        ],
      },
      {
        name: "SIG",
        nodes: [
          { reference: "R1", pin: 2 },
          { reference: "R2", pin: 2 },
        ],
      },
    ]);
    expect(nets?.some(({ name }) => name.startsWith("GND_"))).toBe(false);
  });

  test("joins a label whose text matches a power value", () => {
    const source =
      '(kicad_sch (lib_symbols (symbol "Device:R" (symbol "R_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2")))) (symbol "power:GND" (power) (symbol "GND_0_1" (pin power_in line (at 0 0 0) (name "GND") (number "1"))))) (symbol (lib_id "Device:R") (at 0 0 0) (property "Reference" "R1") (property "Value" "1k")) (symbol (lib_id "Device:R") (at 0 50 0) (property "Reference" "R2") (property "Value" "1k")) (symbol (lib_id "power:GND") (at 0 0 0) (property "Reference" "#PWR01") (property "Value" "GND")) (label "GND" (at 0 50 0)))';
    const nets = importKicad(source, { fileName: "label-power.kicad_sch" }).plan
      ?.target.nets;

    expect(nets).toContainEqual({
      name: "GND",
      nodes: [
        { reference: "R1", pin: 1 },
        { reference: "R2", pin: 1 },
      ],
    });
  });

  test("does not join crossing wire interiors unless a junction is present", () => {
    const base =
      '(kicad_sch (lib_symbols (symbol "Device:R" (symbol "R_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2"))))) (symbol (lib_id "Device:R") (at 0 0 0) (property "Reference" "R1") (property "Value" "1k")) (symbol (lib_id "Device:R") (at 20 0 0) (property "Reference" "R2") (property "Value" "1k"))';
    const wires =
      " (wire (pts (xy 0 0) (xy 20 20))) (wire (pts (xy 0 20) (xy 20 0)))";
    const crossing = importKicad(`${base}${wires})`, {
      fileName: "cross.kicad_sch",
    }).plan?.target.nets;
    const joined = importKicad(`${base}${wires} (junction (at 10 10)))`, {
      fileName: "joined.kicad_sch",
    }).plan?.target.nets;
    expect(crossing?.length).toBeGreaterThan(joined?.length ?? 0);
  });

  test("merges units with the same reference and maps the full symbol pin count", () => {
    const source =
      '(kicad_sch (lib_symbols (symbol "Device:DIP" (symbol "DIP_1_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2"))) (symbol "DIP_2_1" (pin passive line (at 0 0 0) (name "3") (number "3")) (pin passive line (at 10 0 0) (name "4") (number "4"))))) (symbol (lib_id "Device:DIP") (unit 1) (at 0 0 0) (property "Reference" "U1") (property "Value" "IC")) (symbol (lib_id "Device:DIP") (unit 2) (at 20 0 0) (property "Reference" "U1") (property "Value" "IC")))';
    const result = importKicad(source, { fileName: "multi.kicad_sch" });
    expect(result.plan?.parts).toHaveLength(1);
    expect(result.plan?.parts[0]).toMatchObject({
      reference: "U1",
      type: "breadboard.ic",
      parameters: { pinCount: 4 },
    });
    expect(
      result.plan?.target.nets
        .flatMap((net) => net.nodes.map((node) => node.pin))
        .sort(),
    ).toEqual([1, 2, 3, 4]);
  });

  test("reports malformed structure, missing symbols, bad numbers, angles and unsupported constructs", () => {
    const malformed = importKicad(fixture("malformed.kicad_sch"), {
      fileName: "malformed.kicad_sch",
    });
    expect(malformed.plan).toBeDefined();
    expect(malformed.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "sexpr.unterminatedString",
        "sexpr.unclosedList",
      ]),
    );
    expect(
      codes(
        '(kicad_sch (bus) (bus_entry) (sheet) (wire (pts (xy abc 1) (xy 2 3))) (symbol (lib_id "Missing:X") (at 0 0 45) (property "Reference" "R1") (property "Value" "x")))',
      ),
    ).toEqual(
      expect.arrayContaining([
        "kicad.bus",
        "kicad.hierarchicalSheet",
        "kicad.invalidNumber",
        "kicad.unsupportedAngle",
        "kicad.missingLibSymbol",
      ]),
    );
    expect(
      codes(
        '(kicad_sch (lib_symbols (symbol "Device:LED" (symbol "LED_0_1" (pin passive line (at 0 0 0) (name "") (number "1"))))) (symbol (lib_id "Device:LED") (at 0 0 45) (property "Reference" "D1") (property "Value" "red")))',
      ),
    ).toEqual(
      expect.arrayContaining([
        "kicad.unsupportedAngle",
        "kicad.unsupportedSymbol",
      ]),
    );
    expect(
      codes(
        '(kicad_sch (lib_symbols (symbol "Device:LED" (symbol "LED_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2"))))) (symbol (lib_id "Device:LED") (at 0 0 0) (property "Reference" "D1") (property "Value" "red")))',
      ),
    ).toContain("kicad.pinNamesMissing");
  });
});

test("axis contact candidates preserve brute-force connectivity and linear sparse work", () => {
  const n = 100;
  const segments = Array.from({ length: n }, (_, i) => ({
    a: { x: i * 30, y: 0 },
    b: { x: i * 30 + 10, y: 0 },
  }));
  const points = segments.flatMap(({ a, b }) => [a, b]);
  const parent = points.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : find(parent[i] ?? i);
  for (const { a, b } of segments) {
    const ids = points
      .map((p, i) => {
        const cross = (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
        return Math.abs(cross) <= 1 &&
          p.x >= Math.min(a.x, b.x) - 1 &&
          p.x <= Math.max(a.x, b.x) + 1 &&
          p.y >= Math.min(a.y, b.y) - 1 &&
          p.y <= Math.max(a.y, b.y) + 1
          ? i
          : -1;
      })
      .filter((i) => i >= 0);
    const first = ids[0];
    if (first !== undefined)
      for (const i of ids.slice(1)) parent[find(i)] = find(first);
  }
  const source = `(kicad_sch (lib_symbols (symbol "Device:R" (symbol "R_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2"))))) ${segments.map(({ a }, i) => `(symbol (lib_id "Device:R") (at ${a.x} ${a.y} 0) (property "Reference" "R${i + 1}") (property "Value" "1k")) (wire (pts (xy ${a.x + 10} 0) (xy ${a.x} 0))) (label "L${i}" (at ${a.x} 0))`).join(" ")})`;
  const stats = {
    nodeVisits: 0,
    segmentCandidates: 0,
    diagonalWork: 0,
    labelVisits: 0,
  };
  const result = importKicad(source, {
    fileName: "generated.kicad_sch",
    stats,
  });
  expect(result.plan?.target.nets.map((net) => net.nodes)).toEqual(
    segments.map((_, i) =>
      points
        .map((__, j) =>
          find(j) === find(2 * i)
            ? { reference: `R${Math.floor(j / 2) + 1}`, pin: (j % 2) + 1 }
            : undefined,
        )
        .filter((p) => p !== undefined),
    ),
  );
  const sparseStats = {
    nodeVisits: 0,
    segmentCandidates: 0,
    diagonalWork: 0,
    labelVisits: 0,
  };
  const sparse = `(kicad_sch ${segments.map(({ a, b }, i) => `(wire (pts (xy ${a.x} 0) (xy ${b.x} 0))) (label "L${i}" (at ${a.x} 0))`).join(" ")})`;
  importKicad(sparse, { fileName: "sparse.kicad_sch", stats: sparseStats });
  expect(sparseStats.segmentCandidates).toBeLessThanOrEqual(3 * n);
});

test("schematic diagonal budget stops expensive inputs and leaves legacy imports unbudgeted", () => {
  const n = 1000;
  const g = n + 1;
  const source = `(kicad_sch ${Array.from({ length: n }, (_, i) => `(wire (pts (xy 0 ${i / 1000}) (xy ${(g * n) / 10000} ${(10 * i + g * (n + i)) / 10000})))`).join(" ")})`;
  const stats = {
    nodeVisits: 0,
    segmentCandidates: 0,
    diagonalWork: 0,
    labelVisits: 0,
    diagonalBudgetLimit: 0,
  };
  const result = importKicad(source, {
    fileName: "budget.kicad_sch",
    stats,
    diagonalBudget: "schematic",
  });
  expect(result.plan).toBeUndefined();
  expect(result.diagnostics.map((d) => d.code)).toContain(
    "schematic.importTooComplex",
  );
  expect(stats.diagonalBudgetLimit).toBe(diagonalBudgetLimit(n, 2 * n));
  expect(stats.diagonalWork).toBeLessThanOrEqual(stats.diagonalBudgetLimit + 1);
  const parsed = readSexpr(source);
  expect(parsed.root).toBeDefined();
  if (!parsed.root) return;
  const diagnostics = [...parsed.diagnostics];
  const plan = oracleImportSchematic(
    parsed.root,
    "budget.kicad_sch",
    diagnostics,
  );
  expect(importKicad(source, { fileName: "budget.kicad_sch" })).toEqual({
    plan,
    diagnostics,
  });
});

// Test-only legacy implementation: its segment scan and label filtering are the oracle.
type Point = { x: number; y: number };
type Pin = {
  source: string;
  name?: string;
  point: Point;
  unit: number;
  style: number;
};
type Component = {
  reference: string;
  value: string;
  lib: string;
  name: string;
  pins: Pin[];
  pinMap: ReadonlyMap<string, number>;
  type: BreadboardImportPart["type"];
  parameters: Readonly<Record<string, unknown>>;
};
/** Atom slots of `(at x y angle)`. */
const AT_SLOT = { x: 1, y: 2, angle: 3 } as const;
/** Atom slots of `(property "name" "value" ...)`. */
const PROPERTY_SLOT = { name: 1, value: 2 } as const;
/** KiCad unit and body-style numbers: 0 is shared by all, 1 is the default. */
const KICAD_VARIANT = { shared: 0, default: 1 } as const;

const lists = (list: SexprList, head: string) => children(list, head);
const text = (list: SexprList | undefined, head: string) => {
  const item = list ? child(list, head) : undefined;
  return item ? atomAt(item, SEXPR_SLOT.value) : undefined;
};
const propertyValue = (symbol: SexprList, name: string) => {
  const property = lists(symbol, "property").find(
    (p) => atomAt(p, PROPERTY_SLOT.name) === name,
  );
  return property ? atomAt(property, PROPERTY_SLOT.value) : undefined;
};
const angleOf = (
  list: SexprList | undefined,
  diagnostics: BreadboardImportDiagnostic[],
) => (list ? (numberAt(list, AT_SLOT.angle, diagnostics) ?? 0) : 0);
function point(
  list: SexprList | undefined,
  diagnostics: BreadboardImportDiagnostic[],
): Point | undefined {
  if (!list) return undefined;
  const x = numberAt(list, AT_SLOT.x, diagnostics);
  const y = numberAt(list, AT_SLOT.y, diagnostics);
  return x === undefined || y === undefined ? undefined : { x, y };
}
function collectLists(
  node: SexprList,
  head: string,
  out: SexprList[] = [],
): SexprList[] {
  for (const item of node.items)
    if (item.kind === "list") {
      if (atomAt(item, SEXPR_SLOT.keyword) === head) out.push(item);
      collectLists(item, head, out);
    }
  return out;
}
function transformed(
  pin: Point,
  at: Point,
  angle: number,
  mirror?: string,
): Point {
  let x = pin.x;
  let y = -pin.y;
  const turns = (((angle / 90) % 4) + 4) % 4;
  if (turns === 1) [x, y] = [y, -x];
  else if (turns === 2) [x, y] = [-x, -y];
  else if (turns === 3) [x, y] = [-y, x];
  if (mirror === "x") y = -y;
  if (mirror === "y") x = -x;
  return {
    x: Math.round((at.x + x) * 10000),
    y: Math.round((at.y + y) * 10000),
  };
}
const key = (p: Point) => `${p.x},${p.y}`;
function onSegment(p: Point, a: Point, b: Point): boolean {
  const cross = (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
  if (Math.abs(cross) > 1) return false;
  return (
    p.x >= Math.min(a.x, b.x) - 1 &&
    p.x <= Math.max(a.x, b.x) + 1 &&
    p.y >= Math.min(a.y, b.y) - 1 &&
    p.y <= Math.max(a.y, b.y) + 1
  );
}

function oracleImportSchematic(
  root: SexprList,
  fileName: string,
  diagnostics: BreadboardImportDiagnostic[],
): BreadboardImportPlan {
  const library = child(root, "lib_symbols");
  const libs = new Map<string, Pin[]>();
  const powerLibraries = new Set<string>();
  if (library)
    for (const libSymbol of lists(library, "symbol")) {
      const libName = atomAt(libSymbol, SEXPR_SLOT.name);
      if (!libName) continue;
      if (child(libSymbol, "power")) powerLibraries.add(libName);
      const pins: Pin[] = [];
      for (const subSymbol of collectLists(libSymbol, "symbol")) {
        const subName = atomAt(subSymbol, SEXPR_SLOT.name) ?? "";
        const suffix = subName.match(/_(?<unit>\d+)_(?<style>\d+)$/)?.groups;
        const unit = suffix ? Number(suffix.unit) : KICAD_VARIANT.shared;
        const style = suffix ? Number(suffix.style) : KICAD_VARIANT.shared;
        for (const pin of collectLists(subSymbol, "pin")) {
          const at = child(pin, "at");
          const position = point(at, diagnostics);
          const number = text(pin, "number");
          const name = text(pin, "name");
          if (position && number)
            pins.push({
              source: number,
              ...(name ? { name } : {}),
              point: position,
              unit,
              style,
            });
        }
      }
      libs.set(libName, pins);
    }
  let busReported = false;
  let sheetReported = false;
  if (
    collectLists(root, "bus").length ||
    collectLists(root, "bus_entry").length
  ) {
    diagnostics.push({
      severity: "warning",
      code: "kicad.bus",
      message: "Bus constructs are not imported.",
    });
    busReported = true;
  }
  if (collectLists(root, "sheet").length) {
    diagnostics.push({
      severity: "warning",
      code: "kicad.hierarchicalSheet",
      message: "Hierarchical sheets are not imported.",
    });
    sheetReported = true;
  }
  void busReported;
  void sheetReported;

  const componentMap = new Map<string, Component>();
  const pinPoints: {
    reference: string;
    source: string;
    mapped: number;
    point: Point;
    name?: string;
  }[] = [];
  for (const symbol of lists(root, "symbol")) {
    if (symbol === library) continue;
    const lib = text(symbol, "lib_name") ?? text(symbol, "lib_id") ?? "";
    const symbolName = lib.split(":").at(-1) ?? "";
    const property = (name: string) => propertyValue(symbol, name);
    const atList = child(symbol, "at");
    const at = point(atList, diagnostics) ?? { x: 0, y: 0 };
    const angleValue = angleOf(atList, diagnostics);
    const angle = Math.round(angleValue / 90) * 90;
    if (angleValue % 90 !== 0)
      diagnostics.push({
        severity: "warning",
        code: "kicad.unsupportedAngle",
        message: `Angle ${angleValue} on '${symbolName}' was rounded to ${angle}.`,
      });
    const mirror = child(symbol, "mirror")
      ? atomAt(child(symbol, "mirror") as SexprList, SEXPR_SLOT.value)
      : undefined;
    const [instancePath] = collectLists(
      child(symbol, "instances") ?? symbol,
      "path",
    );
    const instanceReference = instancePath
      ? text(instancePath, "reference")
      : undefined;
    const uuid = text(symbol, "uuid");
    const topInstances = child(root, "symbol_instances");
    const topPath = topInstances
      ? lists(topInstances, "path").find((p) =>
          (atomAt(p, SEXPR_SLOT.name) ?? "").endsWith(uuid ?? ""),
        )
      : undefined;
    const reference =
      instanceReference ??
      (topPath ? text(topPath, "reference") : undefined) ??
      property("Reference") ??
      "";
    const value = property("Value") ?? "";
    const footprint = property("Footprint");
    if (reference.startsWith("#") || value === "PWR_FLAG") continue;
    const sourcePins = libs.get(lib) ?? libs.get(symbolName);
    if (!sourcePins) {
      diagnostics.push({
        severity: "warning",
        code: "kicad.missingLibSymbol",
        reference,
        message: `Library symbol '${lib}' is missing; '${reference}' was skipped.`,
      });
      continue;
    }
    const unit = child(symbol, "unit")
      ? Number(text(symbol, "unit")) || KICAD_VARIANT.default
      : KICAD_VARIANT.default;
    const bodyStyle = child(symbol, "body_style")
      ? Number(text(symbol, "body_style"))
      : KICAD_VARIANT.default;
    const symbolPins = sourcePins.filter(
      (pin) =>
        pin.style === KICAD_VARIANT.shared ||
        pin.style === KICAD_VARIANT.default ||
        pin.style === bodyStyle,
    );
    const pins = symbolPins.filter(
      (pin) => pin.unit === KICAD_VARIANT.shared || pin.unit === unit,
    );
    const [libraryName = ""] = lib.split(":");
    const mapped = mapKicadSymbol({
      lib: libraryName,
      name: symbolName,
      reference,
      value,
      pins: symbolPins.map(({ source, name }) => ({
        number: source,
        ...(name ? { name } : {}),
      })),
      footprint,
    });
    diagnostics.push(...mapped.diagnostics);
    if (mapped.kind === "skip") continue;
    const component = componentMap.get(reference) ?? {
      reference,
      value,
      lib,
      name: symbolName,
      pins: [],
      pinMap: mapped.pinMap,
      type: mapped.type,
      parameters: mapped.parameters,
    };
    for (const pin of pins) {
      const mappedPin = mapped.pinMap.get(pin.source);
      if (!mappedPin || !/^[1-9]\d*$/.test(pin.source)) {
        diagnostics.push({
          severity: "warning",
          code: "kicad.unmappedPin",
          reference,
          message: `Pin '${pin.source}' on '${reference}' cannot be mapped.`,
        });
        continue;
      }
      const world = transformed(pin.point, at, angle, mirror);
      component.pins.push({
        source: pin.source,
        ...(pin.name ? { name: pin.name } : {}),
        point: world,
        unit: pin.unit,
        style: pin.style,
      });
      pinPoints.push({
        reference,
        source: pin.source,
        mapped: mappedPin,
        point: world,
        ...(pin.name ? { name: pin.name } : {}),
      });
    }
    componentMap.set(reference, component);
  }

  const segments: [Point, Point][] = [];
  for (const wire of lists(root, "wire")) {
    const pts = child(wire, "pts");
    const xy = pts ? lists(pts, "xy").map((xy) => point(xy, diagnostics)) : [];
    if (xy.some((p) => !p)) continue;
    for (let i = 1; i < xy.length; i += 1) {
      const a = xy[i - 1] as Point;
      const b = xy[i] as Point;
      segments.push([
        { x: Math.round(a.x * 10000), y: Math.round(a.y * 10000) },
        { x: Math.round(b.x * 10000), y: Math.round(b.y * 10000) },
      ]);
    }
  }
  const junctions = lists(root, "junction")
    .map((j) => point(child(j, "at"), diagnostics))
    .filter((p): p is Point => p !== undefined);
  const anchors: { point: Point; label?: string; power?: string }[] = [];
  for (const tag of ["label", "global_label", "hierarchical_label"])
    for (const label of lists(root, tag)) {
      const p = point(child(label, "at"), diagnostics);
      const value = atomAt(label, SEXPR_SLOT.name);
      if (p && value)
        anchors.push({
          point: { x: Math.round(p.x * 10000), y: Math.round(p.y * 10000) },
          label: value,
        });
    }
  const powerValues = new Map<string, string>();
  const powerPoints: Point[] = [];
  for (const symbol of lists(root, "symbol")) {
    const lib = text(symbol, "lib_id") ?? text(symbol, "lib_name") ?? "";
    if (!powerLibraries.has(lib)) continue;
    const libSymbol = libs.get(lib) ?? libs.get(lib.split(":").at(-1) ?? "");
    if (!libSymbol) continue;
    const value = propertyValue(symbol, "Value") ?? "";
    if (value === "PWR_FLAG") continue;
    const atList = child(symbol, "at");
    const at = point(atList, diagnostics);
    if (!at) continue;
    const [pin] = libSymbol;
    if (pin) {
      const powerPoint = transformed(
        pin.point,
        at,
        angleOf(atList, diagnostics),
      );
      powerPoints.push(powerPoint);
      powerValues.set(key(powerPoint), value ?? "");
    }
  }

  const points = [
    ...pinPoints.map((p) => p.point),
    ...segments.flat(),
    ...powerPoints,
    ...junctions.map((p) => ({
      x: Math.round(p.x * 10000),
      y: Math.round(p.y * 10000),
    })),
    ...anchors.map((a) => a.point),
  ];
  const parent = points.map((_, i) => i);
  const up = (i: number): number => parent[i] ?? i;
  const find = (i: number): number => {
    let p = i;
    while (up(p) !== p) p = up(p);
    let current = i;
    while (up(current) !== current) {
      const next = up(current);
      parent[current] = p;
      current = next;
    }
    return p;
  };
  const join = (a: number, b: number) => {
    const x = find(a);
    const y = find(b);
    if (x !== y) parent[y] = x;
  };
  const pointIndex = new Map<string, number[]>();
  points.forEach((p, i) =>
    pointIndex.set(key(p), [...(pointIndex.get(key(p)) ?? []), i]),
  );
  const joinAll = ([first, ...rest]: readonly number[]) => {
    if (first !== undefined) for (const other of rest) join(first, other);
  };
  for (const indices of pointIndex.values()) joinAll(indices);
  const segmentPointIndices: number[][] = segments.map(([a, b]) =>
    points.map((p, i) => (onSegment(p, a, b) ? i : -1)).filter((i) => i >= 0),
  );
  for (const ids of segmentPointIndices) joinAll(ids);
  const labelRoots = new Map<string, number>();
  const powerRoots = new Map<string, string>();
  for (const anchor of anchors) {
    const rootIndex = find(points.indexOf(anchor.point));
    if (anchor.label) {
      const first = labelRoots.get(anchor.label);
      if (first !== undefined) join(first, rootIndex);
      else labelRoots.set(anchor.label, rootIndex);
    }
  }
  for (const [pointKey, value] of powerValues) {
    const idx = pointIndex.get(pointKey)?.[0];
    if (idx === undefined || !value) continue;
    const first = labelRoots.get(value);
    if (first !== undefined) join(first, idx);
    else labelRoots.set(value, find(idx));
  }
  for (const [pointKey, value] of powerValues) {
    const idx = pointIndex.get(pointKey)?.[0];
    if (idx !== undefined) powerRoots.set(String(find(idx)), value);
  }
  const pinOffset = 0;
  const nodesByRoot = new Map<
    number,
    { reference: string; pin: number; source: string }[]
  >();
  pinPoints.forEach((pin, index) => {
    const rootIndex = find(pinOffset + index);
    nodesByRoot.set(rootIndex, [
      ...(nodesByRoot.get(rootIndex) ?? []),
      { reference: pin.reference, pin: pin.mapped, source: pin.source },
    ]);
  });
  const sortedParts = [...componentMap.values()].sort((a, b) =>
    compareReferences(a.reference, b.reference),
  );
  const order = new Map(
    sortedParts.map((part, index) => [part.reference, index]),
  );
  const netData = [...nodesByRoot.entries()]
    .map(([rootIndex, nodes]) => ({
      rootIndex,
      nodes: nodes.sort(
        (a, b) =>
          (order.get(a.reference) ?? 0) - (order.get(b.reference) ?? 0) ||
          a.pin - b.pin,
      ),
    }))
    .sort((a, b) => {
      const [an] = a.nodes;
      const [bn] = b.nodes;
      return (
        (an ? (order.get(an.reference) ?? 0) : 0) -
          (bn ? (order.get(bn.reference) ?? 0) : 0) ||
        (an?.pin ?? 0) - (bn?.pin ?? 0)
      );
    });
  const usedNames = new Set<string>();
  const nets = netData.map(({ rootIndex, nodes }) => {
    const power = powerRoots.get(String(find(rootIndex)));
    const labels = anchors
      .filter(
        (a) =>
          a.label &&
          pointIndex
            .get(key(a.point))
            ?.some((i) => find(i) === find(rootIndex)),
      )
      .map((a) => a.label as string)
      .sort();
    const [first] = nodes;
    const [firstLabel] = labels;
    const raw =
      power ||
      firstLabel ||
      (first ? `N_${first.reference}_${first.pin}` : `N_${rootIndex}`);
    let name = raw;
    let suffix = 2;
    while (usedNames.has(name)) name = `${raw}_${suffix++}`;
    usedNames.add(name);
    return {
      name,
      nodes: nodes.map(({ reference, pin }) => ({ reference, pin })),
    };
  });
  const parts: BreadboardImportPart[] = sortedParts.map(
    ({ reference, value, type, parameters }) => ({
      reference,
      value,
      type,
      parameters,
    }),
  );
  void pinOffset;
  void busReported;
  void sheetReported;
  return {
    title: fileName.replace(/\.[^.]*$/, ""),
    source: fileName,
    format: "kicad_sch",
    parts,
    target: {
      source: fileName,
      format: "kicad_sch",
      parts: parts.map(({ reference, value, type }) => ({
        reference,
        value,
        type,
      })),
      nets,
    },
  };
}

test("complete imports equal the legacy brute-force oracle", () => {
  const generated = [
    "(wire (pts (xy 0 0) (xy 20 0))) (wire (pts (xy 10 -10) (xy 10 10))) (junction (at 10 0))",
    "(wire (pts (xy 0 0) (xy 20 20))) (wire (pts (xy 0 10) (xy 20 30))) (junction (at 10 10))",
    "(wire (pts (xy 0 0) (xy 10 10))) (wire (pts (xy 0 0) (xy 10 20))) (junction (at 5 5))",
    "(wire (pts (xy 0 0) (xy 0 0))) (junction (at 0.0001 -0.0001))",
    "(wire (pts (xy 0 0) (xy 10 10))) (wire (pts (xy 30 0) (xy 40 20)))",
    "(wire (pts (xy 0 0) (xy 20 20))) (wire (pts (xy 5 5) (xy 15 15)))",
    "(wire (pts (xy 0 0) (xy 0.0002 0.0003))) (junction (at 0.0001 0.0001))",
    "(wire (pts (xy 100000 100000) (xy 100020 100020))) (junction (at 100010 100010))",
  ];
  const inputs = [
    ...readdirSync("test-fixtures/kicad")
      .filter((name) => name.endsWith(".kicad_sch"))
      .map((name) => ({ name, source: fixture(name) })),
    ...generated.map((geometry, i) => ({
      name: `generated-${i}.kicad_sch`,
      source: `(kicad_sch (lib_symbols (symbol "Device:R" (symbol "R_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2"))))) (symbol (lib_id "Device:R") (at 0 0 0) (property "Reference" "R1") (property "Value" "1k")) (symbol (lib_id "Device:R") (at 10 10 0) (property "Reference" "R2") (property "Value" "2k")) (label "SIG" (at 0 0)) ${geometry})`,
    })),
  ];
  for (const { name, source } of inputs) {
    const parsed = readSexpr(source);
    expect(parsed.root).toBeDefined();
    if (!parsed.root) continue;
    const diagnostics = [...parsed.diagnostics];
    const plan = oracleImportSchematic(parsed.root, name, diagnostics);
    expect(importKicad(source, { fileName: name })).toEqual({
      plan,
      diagnostics,
    });
    expect(
      importKicad(source, { fileName: name, diagonalBudget: "schematic" }),
    ).toEqual({ plan, diagnostics });
  }
});

test("large-coordinate diagonal workload observes the schematic budget", () => {
  const n = 1000;
  const g = n + 1;
  const offset = 1000000;
  const source = `(kicad_sch ${Array.from({ length: n }, (_, i) => `(wire (pts (xy ${offset} ${offset + i / 1000}) (xy ${offset + (g * n) / 10000} ${offset + (10 * i + g * (n + i)) / 10000})))`).join(" ")})`;
  const stats = {
    nodeVisits: 0,
    segmentCandidates: 0,
    diagonalWork: 0,
    labelVisits: 0,
    diagonalBudgetLimit: 0,
  };
  const result = importKicad(source, {
    fileName: "large.kicad_sch",
    stats,
    diagonalBudget: "schematic",
  });
  expect(result.plan).toBeUndefined();
  expect(result.diagnostics.map((d) => d.code)).toContain(
    "schematic.importTooComplex",
  );
  expect(stats.diagonalBudgetLimit).toBe(diagonalBudgetLimit(n, 2 * n));
  expect(stats.diagonalWork).toBeLessThanOrEqual(stats.diagonalBudgetLimit + 1);
});

test("label resolution visits each anchor and net once on disjoint nets", () => {
  const n = 500;
  const source = `(kicad_sch (lib_symbols (symbol "Device:R" (symbol "R_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2"))))) ${Array.from({ length: n }, (_, i) => `(symbol (lib_id "Device:R") (at ${i * 30} 0 0) (property "Reference" "R${i + 1}") (property "Value" "1k")) (label "L${i}" (at ${i * 30} 0))`).join(" ")})`;
  const stats = {
    nodeVisits: 0,
    segmentCandidates: 0,
    diagonalWork: 0,
    labelVisits: 0,
  };
  const result = importKicad(source, { fileName: "labels.kicad_sch", stats });
  expect(result.plan?.target.nets).toHaveLength(2 * n);
  expect(stats.labelVisits).toBe(n + (result.plan?.target.nets.length ?? 0));
});

test("stacked and duplicate labels match the legacy naming oracle", () => {
  const source = `(kicad_sch (lib_symbols (symbol "Device:R" (symbol "R_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2"))))) (symbol (lib_id "Device:R") (at 0 0 0) (property "Reference" "R1") (property "Value" "1k")) (symbol (lib_id "Device:R") (at 30 0 0) (property "Reference" "R2") (property "Value" "1k")) (label "ZETA" (at 0 0)) (global_label "ALPHA" (at 0 0)) (label "ZETA" (at 30 0)) (label "ZETA" (at 30 0)) (label "N_R1_2" (at 40 0)))`;
  const parsed = readSexpr(source);
  expect(parsed.root).toBeDefined();
  if (!parsed.root) return;
  const diagnostics = [...parsed.diagnostics];
  const plan = oracleImportSchematic(
    parsed.root,
    "stacked.kicad_sch",
    diagnostics,
  );
  const result = importKicad(source, {
    fileName: "stacked.kicad_sch",
    diagonalBudget: "schematic",
  });
  expect(result).toEqual({ plan, diagnostics });
  expect(result.plan?.target.nets.map((net) => net.name)).toEqual([
    "ALPHA",
    "N_R1_2",
    "N_R1_2_2",
  ]);
});
