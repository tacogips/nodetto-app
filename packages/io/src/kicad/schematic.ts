import {
  compareReferences,
  type BreadboardImportDiagnostic,
  type BreadboardImportPart,
  type BreadboardImportPlan,
} from "@nodetto/ir";
import { atomAt, child, children, numberAt, type SexprList } from "./sexpr.ts";
import { mapKicadSymbol } from "./symbol-map.ts";

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
const lists = (list: SexprList, head: string) => children(list, head);
const text = (list: SexprList | undefined, head: string) => {
  const item = list ? child(list, head) : undefined;
  return item ? atomAt(item, 1) : undefined;
};
function point(
  list: SexprList | undefined,
  diagnostics: BreadboardImportDiagnostic[],
): Point | undefined {
  if (!list) return undefined;
  const x = numberAt(list, 1, diagnostics);
  const y = numberAt(list, 2, diagnostics);
  return x === undefined || y === undefined ? undefined : { x, y };
}
function collectLists(
  node: SexprList,
  head: string,
  out: SexprList[] = [],
): SexprList[] {
  for (const item of node.items)
    if (item.kind === "list") {
      if (atomAt(item, 0) === head) out.push(item);
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

export function importSchematic(
  root: SexprList,
  fileName: string,
  diagnostics: BreadboardImportDiagnostic[],
): BreadboardImportPlan {
  const library = child(root, "lib_symbols");
  const libs = new Map<string, Pin[]>();
  const powerLibraries = new Set<string>();
  if (library)
    for (const libSymbol of lists(library, "symbol")) {
      const libName = atomAt(libSymbol, 1);
      if (!libName) continue;
      if (child(libSymbol, "power")) powerLibraries.add(libName);
      const pins: Pin[] = [];
      for (const subSymbol of collectLists(libSymbol, "symbol")) {
        const subName = atomAt(subSymbol, 1) ?? "";
        const suffix = subName.match(/_(\d+)_(\d+)$/);
        const unit = suffix ? Number(suffix[1]) : 0;
        const style = suffix ? Number(suffix[2]) : 0;
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
    const props = lists(symbol, "property");
    const property = (name: string) =>
      props.find((p) => atomAt(p, 1) === name)
        ? atomAt(props.find((p) => atomAt(p, 1) === name) as SexprList, 2)
        : undefined;
    const atList = child(symbol, "at");
    const at = point(atList, diagnostics) ?? { x: 0, y: 0 };
    const angleValue = atList ? (numberAt(atList, 3, diagnostics) ?? 0) : 0;
    const angle = Math.round(angleValue / 90) * 90;
    if (angleValue % 90 !== 0)
      diagnostics.push({
        severity: "warning",
        code: "kicad.unsupportedAngle",
        message: `Angle ${angleValue} on '${symbolName}' was rounded to ${angle}.`,
      });
    const mirror = child(symbol, "mirror")
      ? atomAt(child(symbol, "mirror") as SexprList, 1)
      : undefined;
    const instancePath = collectLists(
      child(symbol, "instances") ?? symbol,
      "path",
    )[0];
    const instanceReference = instancePath
      ? text(instancePath, "reference")
      : undefined;
    const uuid = text(symbol, "uuid");
    const topInstances = child(root, "symbol_instances");
    const topPath = topInstances
      ? lists(topInstances, "path").find((p) =>
          (atomAt(p, 1) ?? "").endsWith(uuid ?? ""),
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
      ? Number(atomAt(child(symbol, "unit") as SexprList, 1)) || 1
      : 1;
    const bodyStyle = child(symbol, "body_style")
      ? Number(atomAt(child(symbol, "body_style") as SexprList, 1))
      : 1;
    const symbolPins = sourcePins.filter(
      (pin) => pin.style === 0 || pin.style === 1 || pin.style === bodyStyle,
    );
    const pins = symbolPins.filter(
      (pin) => pin.unit === 0 || pin.unit === unit,
    );
    const mapped = mapKicadSymbol({
      lib: lib.split(":")[0] ?? "",
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
      const value = atomAt(label, 1);
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
    const value = lists(symbol, "property").find(
      (p) => atomAt(p, 1) === "Value",
    )
      ? atomAt(
          lists(symbol, "property").find(
            (p) => atomAt(p, 1) === "Value",
          ) as SexprList,
          2,
        )
      : "";
    if (value === "PWR_FLAG") continue;
    const atList = child(symbol, "at");
    const at = point(atList, diagnostics);
    if (!at) continue;
    const pin = libSymbol[0];
    if (pin) {
      const powerPoint = transformed(
        pin.point,
        at,
        atList ? (numberAt(atList, 3, diagnostics) ?? 0) : 0,
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
  const find = (i: number): number => {
    let p = i;
    while (parent[p] !== p) p = parent[p];
    let current = i;
    while (parent[current] !== current) {
      const next = parent[current];
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
  for (const indices of pointIndex.values())
    for (let i = 1; i < indices.length; i += 1) join(indices[0], indices[i]);
  const segmentPointIndices: number[][] = segments.map(([a, b]) =>
    points.map((p, i) => (onSegment(p, a, b) ? i : -1)).filter((i) => i >= 0),
  );
  for (const ids of segmentPointIndices)
    for (let i = 1; i < ids.length; i += 1) join(ids[0], ids[i]);
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
    .sort(
      (a, b) =>
        (order.get(a.nodes[0].reference) ?? 0) -
          (order.get(b.nodes[0].reference) ?? 0) ||
        a.nodes[0].pin - b.nodes[0].pin,
    );
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
    const raw = power || labels[0] || `N_${nodes[0].reference}_${nodes[0].pin}`;
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
