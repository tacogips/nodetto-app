import {
  pcbRotate,
  roundNm,
  type BreadboardImportDiagnostic,
  type PcbGraphicItem,
  type PcbImportPlan,
  type PcbPad,
  type PcbPadPrimitive,
  type PcbShape,
  type PcbXY,
} from "@nodetto/ir";
import {
  atomAt,
  readSexpr,
  SEXPR_SLOT,
  type SexprAtom,
  type SexprList,
} from "./sexpr.ts";

type Fields = Map<string, SexprList[]>;
type Diagnostic = BreadboardImportDiagnostic;
const head = (list: SexprList) => atomAt(list, SEXPR_SLOT.keyword) ?? "";
const atoms = (list: SexprList) =>
  list.items.filter((item): item is SexprAtom => item.kind === "atom");

function fields(list: SexprList): Fields {
  const result: Fields = new Map();
  for (const item of list.items) {
    if (item.kind !== "list") continue;
    const key = head(item);
    const group = result.get(key);
    if (group) group.push(item);
    else result.set(key, [item]);
  }
  return result;
}
const one = (map: Fields, key: string) => map.get(key)?.[0];
const many = (map: Fields, key: string) => map.get(key) ?? [];
const value = (list: SexprList | undefined, index = 1) =>
  list ? atomAt(list, index) : undefined;

function number(
  list: SexprList | undefined,
  index: number,
  diagnostics: Diagnostic[],
): number | undefined {
  const token = list?.items[index];
  if (!list || token?.kind !== "atom") return undefined;
  const parsed = Number(token.text);
  if (Number.isFinite(parsed)) return parsed;
  diagnostics.push({
    severity: "warning",
    code: "kicad.badNumber",
    message: `Invalid number '${token.text}'.`,
    line: token.line,
    column: token.column,
  });
  return undefined;
}

function point(
  list: SexprList | undefined,
  diagnostics: Diagnostic[],
  xIndex = 1,
): PcbXY | undefined {
  if (!list) return undefined;
  const x = number(list, xIndex, diagnostics);
  const y = number(list, xIndex + 1, diagnostics);
  return x === undefined || y === undefined ? undefined : [x, y];
}
const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;
const layerName = (name: string, aliases: ReadonlyMap<string, string>) =>
  aliases.get(name) ?? name;

function readNet(
  list: SexprList | undefined,
  netNames: ReadonlyMap<number, string>,
): string {
  if (!list) return "";
  const values = atoms(list).slice(1);
  if (values.length > 1) {
    const code = Number(values[0]?.text);
    return code === 0 ? "" : (values[1]?.text ?? netNames.get(code) ?? "");
  }
  const atom = values[0];
  if (!atom) return "";
  if (!atom.quoted && Number.isInteger(Number(atom.text))) {
    const code = Number(atom.text);
    return code === 0 ? "" : (netNames.get(code) ?? "");
  }
  return atom.text;
}

function readAt(
  list: SexprList | undefined,
  diagnostics: Diagnostic[],
): { at: PcbXY; angle: number } | undefined {
  if (!list) return undefined;
  const at = point(list, diagnostics);
  if (!at) return undefined;
  const angle = number(list, 3, diagnostics) ?? 0;
  return { at, angle };
}

function kicad5ArcToThreePoint(
  center: PcbXY,
  start: PcbXY,
  angleDegrees: number,
) {
  // KiCad 5 arc angles are clockwise on screen; pcbRotate uses the board's
  // counter-clockwise screen convention, hence the negated angle.
  const vector: PcbXY = [start[0] - center[0], start[1] - center[1]];
  const endVector = pcbRotate(vector, -angleDegrees);
  const midVector = pcbRotate(vector, -angleDegrees / 2);
  return {
    kind: "arc" as const,
    start,
    mid: [
      roundNm(center[0] + midVector[0]),
      roundNm(center[1] + midVector[1]),
    ] as PcbXY,
    end: [
      roundNm(center[0] + endVector[0]),
      roundNm(center[1] + endVector[1]),
    ] as PcbXY,
  };
}

function readArc(map: Fields, diagnostics: Diagnostic[]): PcbShape | undefined {
  const startList = one(map, "start");
  const endList = one(map, "end");
  const midList = one(map, "mid");
  const start = point(startList, diagnostics);
  const end = point(endList, diagnostics);
  if (midList) {
    const mid = point(midList, diagnostics);
    return start && mid && end ? { kind: "arc", start, mid, end } : undefined;
  }
  const angleList = one(map, "angle");
  const angleAtom = angleList?.items[1];
  if (start && end && angleAtom?.kind === "atom") {
    const angle = number(angleList, 1, diagnostics);
    const center = start;
    return angle === undefined
      ? undefined
      : (kicad5ArcToThreePoint(center, end, angle) as PcbShape);
  }
  return undefined;
}

function readShape(
  kind: string,
  map: Fields,
  diagnostics: Diagnostic[],
): PcbShape | undefined {
  if (kind === "gr_line" || kind === "fp_line") {
    const start = point(one(map, "start"), diagnostics);
    const end = point(one(map, "end"), diagnostics);
    return start && end ? { kind: "line", start, end } : undefined;
  }
  if (kind === "gr_arc" || kind === "fp_arc") return readArc(map, diagnostics);
  if (kind === "gr_circle" || kind === "fp_circle") {
    const center = point(one(map, "center"), diagnostics);
    const end = point(one(map, "end"), diagnostics);
    if (!center || !end) return undefined;
    const dx = end[0] - center[0];
    const dy = end[1] - center[1];
    return {
      kind: "circle",
      center,
      radius: roundNm(Math.sqrt(dx * dx + dy * dy)),
    };
  }
  if (kind === "gr_rect" || kind === "fp_rect") {
    const start = point(one(map, "start"), diagnostics);
    const end = point(one(map, "end"), diagnostics);
    return start && end ? { kind: "rect", start, end } : undefined;
  }
  if (kind === "gr_poly" || kind === "fp_poly") {
    const pts = fields(
      one(map, "pts") ??
        ({ kind: "list", items: [], line: 1, column: 1 } as SexprList),
    );
    const points = many(pts, "xy")
      .map((xy) => point(xy, diagnostics))
      .filter((p): p is PcbXY => p !== undefined);
    return points.length >= 3 ? { kind: "polygon", points } : undefined;
  }
  return undefined;
}

function widthOf(map: Fields, diagnostics: Diagnostic[]): number {
  const direct = one(map, "width");
  if (direct) return number(direct, 1, diagnostics) ?? 0.12;
  const stroke = one(map, "stroke");
  return (
    number(stroke ? one(fields(stroke), "width") : undefined, 1, diagnostics) ??
    0.12
  );
}
function fillOf(map: Fields): boolean {
  const fill = one(map, "fill");
  const token = fill?.items[1];
  return (
    token?.kind === "atom" && (token.text === "solid" || token.text === "yes")
  );
}

function readText(
  list: SexprList,
  map: Fields,
  role?: "reference" | "value" | "user",
  diagnostics: Diagnostic[] = [],
): Extract<PcbShape, { kind: "text" }> | undefined {
  const at = readAt(one(map, "at"), diagnostics);
  if (!at) return undefined;
  const effects = fields(
    one(map, "effects") ??
      ({ kind: "list", items: [], line: 1, column: 1 } as SexprList),
  );
  const font = fields(
    one(effects, "font") ??
      ({ kind: "list", items: [], line: 1, column: 1 } as SexprList),
  );
  const size = point(one(font, "size"), diagnostics) ?? [1, 1];
  const justifyList = one(effects, "justify");
  const justifyAtoms = justifyList
    ? atoms(justifyList)
        .slice(1)
        .map((a) => a.text)
    : [];
  const hide =
    atoms(list).some((a) => a.text === "hide") ||
    atoms(
      one(map, "effects") ??
        ({ kind: "list", items: [], line: 1, column: 1 } as SexprList),
    ).some((a) => a.text === "hide") ||
    value(one(map, "hide")) === "yes";
  const thickness = number(one(font, "thickness"), 1, diagnostics) ?? 0.15;
  return {
    kind: "text",
    text: atoms(list)[1]?.text ?? "",
    at: at.at,
    rotation: at.angle,
    size,
    thickness,
    ...(role ? { role } : {}),
    ...(justifyAtoms.length
      ? {
          justify: {
            ...(justifyAtoms.includes("left")
              ? { horizontal: "left" as const }
              : justifyAtoms.includes("right")
                ? { horizontal: "right" as const }
                : {}),
            ...(justifyAtoms.includes("mirror") ? { mirror: true } : {}),
          },
        }
      : {}),
    ...(hide ? { hidden: true } : {}),
  };
}

function readPad(
  list: SexprList,
  aliases: ReadonlyMap<string, string>,
  netNames: ReadonlyMap<number, string>,
  footprintAngle: number,
  diagnostics: Diagnostic[],
): PcbPad | undefined {
  const map = fields(list);
  const a = readAt(one(map, "at"), diagnostics);
  const size = point(one(map, "size"), diagnostics);
  if (!a || !size) return undefined;
  const initialAtoms = atoms(list);
  const padType = initialAtoms[2]?.text ?? "smd";
  const sourceShape = initialAtoms[3]?.text ?? "custom";
  const validTypes = ["thru_hole", "smd", "np_thru_hole", "connect"] as const;
  const type = validTypes.includes(padType as (typeof validTypes)[number])
    ? (padType as PcbPad["type"])
    : "smd";
  const validShapes = ["circle", "rect", "oval", "roundrect", "trapezoid"];
  const shape = validShapes.includes(sourceShape)
    ? (sourceShape as PcbPad["shape"])
    : "custom";
  if (shape === "custom")
    diagnostics.push({
      severity: "warning",
      code: "kicad.padShape",
      message: `Unknown pad shape '${sourceShape}' was read as custom.`,
      line: list.line,
      column: list.column,
    });
  const layersList = one(map, "layers");
  const layers = layersList
    ? atoms(layersList)
        .slice(1)
        .map((a) => layerName(a.text, aliases))
    : [];
  const drillList = one(map, "drill");
  let drill: PcbPad["drill"];
  if (drillList) {
    const drillAtoms = atoms(drillList).slice(1);
    const oval = drillAtoms[0]?.text === "oval";
    const w = Number(drillAtoms[oval ? 1 : 0]?.text);
    const h = Number(
      drillAtoms[oval ? 2 : 0]?.text ?? drillAtoms[oval ? 1 : 0]?.text,
    );
    if (Number.isFinite(w) && Number.isFinite(h)) {
      const drillMap = fields(drillList);
      drill = {
        diameter: oval ? Math.min(w, h) : w,
        ...(oval ? { slot: [w, h] as PcbXY } : {}),
        ...(point(one(drillMap, "offset"), diagnostics)
          ? { offset: point(one(drillMap, "offset"), diagnostics) }
          : {}),
      };
    } else
      diagnostics.push({
        severity: "warning",
        code: "kicad.badNumber",
        message: "Invalid pad drill was skipped.",
        line: drillList.line,
        column: drillList.column,
      });
  }
  const rr = number(one(map, "roundrect_rratio"), 1, diagnostics);
  const delta = point(one(map, "rect_delta"), diagnostics);
  const mask = number(one(map, "solder_mask_margin"), 1, diagnostics);
  const primitives: PcbPadPrimitive[] = [];
  const primitiveList = one(map, "primitives");
  if (primitiveList) {
    for (const primitive of primitiveList.items) {
      if (primitive.kind !== "list") continue;
      const primitiveKind = head(primitive);
      const primitiveMap = fields(primitive);
      const primitiveShape = readShape(
        primitiveKind,
        primitiveMap,
        diagnostics,
      );
      if (primitiveShape)
        primitives.push({
          shape: primitiveShape,
          width: widthOf(primitiveMap, diagnostics),
          fill: fillOf(primitiveMap),
        });
      else
        diagnostics.push({
          severity: "warning",
          code: "kicad.unsupported",
          message: `Unsupported pad primitive '${primitiveKind}' was skipped.`,
          line: primitive.line,
          column: primitive.column,
        });
    }
  }
  return {
    number: initialAtoms[1]?.text ?? "",
    type,
    shape,
    at: a.at,
    rotation: normalizeAngle(a.angle - footprintAngle),
    size,
    layers,
    net: readNet(one(map, "net"), netNames),
    ...(drill ? { drill } : {}),
    ...(rr !== undefined ? { roundrectRatio: rr } : {}),
    ...(delta ? { trapezoidDelta: delta } : {}),
    ...(mask !== undefined ? { maskMargin: mask } : {}),
    ...(primitives.length ? { primitives } : {}),
  };
}

function readFootprint(
  list: SexprList,
  map: Fields,
  aliases: ReadonlyMap<string, string>,
  netNames: ReadonlyMap<number, string>,
  diagnostics: Diagnostic[],
) {
  const at = readAt(one(map, "at"), diagnostics) ?? {
    at: [0, 0] as PcbXY,
    angle: 0,
  };
  const layer = layerName(value(one(map, "layer")) ?? "F.Cu", aliases);
  const graphics: PcbGraphicItem[] = [];
  const props = many(map, "property");
  const propertyTexts = new Map<string, string>();
  for (const prop of props) {
    const propAtoms = atoms(prop);
    const name = propAtoms[1]?.text;
    const text = propAtoms[2]?.text;
    if (name && text !== undefined) propertyTexts.set(name, text);
  }
  for (const item of list.items) {
    if (item.kind !== "list") continue;
    const kind = head(item);
    const childMap = fields(item);
    const layerNameValue = layerName(
      value(one(childMap, "layer")) ?? layer,
      aliases,
    );
    if (
      ["fp_line", "fp_arc", "fp_circle", "fp_rect", "fp_poly"].includes(kind)
    ) {
      const shape = readShape(kind, childMap, diagnostics);
      if (shape)
        graphics.push({
          layer: layerNameValue,
          width: widthOf(childMap, diagnostics),
          fill: fillOf(childMap),
          shape,
        });
    } else if (kind === "fp_text") {
      const fpAtoms = atoms(item);
      const textKind = fpAtoms[1]?.text;
      const role =
        textKind === "reference"
          ? "reference"
          : textKind === "value"
            ? "value"
            : "user";
      const shape = readText(item, childMap, role, diagnostics);
      if (shape)
        graphics.push({
          layer: layerNameValue,
          width: shape.kind === "text" ? shape.thickness : 0.15,
          fill: false,
          shape: {
            ...shape,
            text: fpAtoms[2]?.text ?? "",
            rotation: normalizeAngle(
              (shape.kind === "text" ? shape.rotation : 0) - at.angle,
            ),
          },
        });
    }
  }
  for (const [name, role] of [
    ["Reference", "reference"],
    ["Value", "value"],
  ] as const) {
    const text = propertyTexts.get(name);
    if (
      text === undefined ||
      many(map, "fp_text").some((item) => atoms(item)[1]?.text === role)
    )
      continue;
    const prop = props.find((item) => atoms(item)[1]?.text === name);
    if (!prop) continue;
    const propMap = fields(prop);
    const shape = readText(prop, propMap, role, diagnostics);
    if (shape)
      graphics.push({
        layer: layerName(
          value(one(propMap, "layer")) ??
            (role === "reference" ? "F.SilkS" : "F.Fab"),
          aliases,
        ),
        width: shape.kind === "text" ? shape.thickness : 0.15,
        fill: false,
        shape: {
          ...shape,
          text,
          rotation: normalizeAngle(
            (shape.kind === "text" ? shape.rotation : 0) - at.angle,
          ),
        },
      });
  }
  const pads = many(map, "pad")
    .map((pad) => readPad(pad, aliases, netNames, at.angle, diagnostics))
    .filter((pad): pad is PcbPad => pad !== undefined);
  const legacyText = (role: "reference" | "value") => {
    const text = many(map, "fp_text").find(
      (item) => atoms(item)[1]?.text === role,
    )?.items[2];
    return text?.kind === "atom" ? text.text : "";
  };
  return {
    reference: propertyTexts.get("Reference") ?? legacyText("reference"),
    value: propertyTexts.get("Value") ?? legacyText("value"),
    library: atoms(list)[1]?.text ?? "",
    at: at.at,
    rotation: normalizeAngle(at.angle),
    side: layer === "B.Cu" ? ("bottom" as const) : ("top" as const),
    pads,
    graphics,
  };
}

function readPoints(
  list: SexprList | undefined,
  diagnostics: Diagnostic[],
): PcbXY[] {
  if (!list) return [];
  const result: PcbXY[] = [];
  let warnedArc = false;
  for (const item of list.items) {
    if (item.kind !== "list") continue;
    if (head(item) === "xy") {
      const p = point(item, diagnostics);
      if (p) result.push(p);
    } else if (head(item) === "arc") {
      if (!warnedArc) {
        diagnostics.push({
          severity: "warning",
          code: "kicad.polygonArc",
          message: "Polygon arcs were flattened to their listed points.",
          line: item.line,
          column: item.column,
        });
        warnedArc = true;
      }
      const arcFields = fields(item);
      for (const key of ["start", "mid", "end"]) {
        const p = point(one(arcFields, key), diagnostics);
        if (p) result.push(p);
      }
    }
  }
  return result;
}

function readZone(
  list: SexprList,
  map: Fields,
  aliases: ReadonlyMap<string, string>,
  netNames: ReadonlyMap<number, string>,
  diagnostics: Diagnostic[],
) {
  if (one(map, "keepout") || one(map, "rule_area")) {
    diagnostics.push({
      severity: "warning",
      code: "kicad.ruleArea",
      message: "Keepout and rule-area zones are not imported.",
      line: list.line,
      column: list.column,
    });
    return undefined;
  }
  const netName = value(one(map, "net_name"));
  const net = netName ?? readNet(one(map, "net"), netNames);
  let layers: string[] = [];
  const layer = one(map, "layer");
  const layerList = one(map, "layers");
  if (layer) layers = [layerName(value(layer) ?? "", aliases)];
  else if (layerList)
    layers = atoms(layerList)
      .slice(1)
      .map((a) => layerName(a.text, aliases));
  const polygon = one(map, "polygon");
  const outline = readPoints(
    polygon ? one(fields(polygon), "pts") : undefined,
    diagnostics,
  );
  const filledByLayer = new Map<string, PcbXY[][]>();
  for (const filledPolygon of many(map, "filled_polygon")) {
    const filledMap = fields(filledPolygon);
    const fillLayer = layerName(
      value(one(filledMap, "layer")) ?? layers[0] ?? "",
      aliases,
    );
    const pts = readPoints(one(filledMap, "pts"), diagnostics);
    if (pts.length < 3) continue;
    const current = filledByLayer.get(fillLayer);
    if (current) current.push(pts);
    else filledByLayer.set(fillLayer, [pts]);
  }
  return outline.length >= 3 && layers.length
    ? {
        layers,
        net,
        outline,
        filled: [...filledByLayer].map(([layer, polygons]) => ({
          layer,
          polygons,
        })),
      }
    : undefined;
}

function readTrack(
  kind: string,
  map: Fields,
  aliases: ReadonlyMap<string, string>,
  netNames: ReadonlyMap<number, string>,
  diagnostics: Diagnostic[],
) {
  const start = point(one(map, "start"), diagnostics);
  const end = point(one(map, "end"), diagnostics);
  const mid = point(one(map, "mid"), diagnostics);
  const width = number(one(map, "width"), 1, diagnostics);
  const layer = layerName(value(one(map, "layer")) ?? "", aliases);
  if (!start || !end || width === undefined || !layer) return undefined;
  return {
    layer,
    width,
    net: readNet(one(map, "net"), netNames),
    points: [start, end],
    ...(kind === "arc" && mid ? { mid } : {}),
  };
}

function readGraphic(
  list: SexprList,
  kind: string,
  map: Fields,
  aliases: ReadonlyMap<string, string>,
  diagnostics: Diagnostic[],
): PcbGraphicItem | undefined {
  const layer = layerName(value(one(map, "layer")) ?? "", aliases);
  if (!layer) return undefined;
  let shape: PcbShape | undefined;
  if (kind === "gr_text") shape = readText(list, map, "user", diagnostics);
  else shape = readShape(kind, map, diagnostics);
  return shape
    ? { layer, width: widthOf(map, diagnostics), fill: fillOf(map), shape }
    : undefined;
}

const layerRank = (name: string) =>
  name === "B.Cu" ? 0 : name === "F.Cu" ? 2 : name.endsWith(".Cu") ? 1 : 3;

export function importKicadPcb(text: string, options: { fileName: string }) {
  if (text.trimStart().startsWith("PCBNEW-BOARD"))
    return {
      diagnostics: [
        {
          severity: "error",
          code: "kicad.legacyFormat",
          message: "KiCad legacy PCB files are not supported.",
        } satisfies Diagnostic,
      ],
    };
  const parsed = readSexpr(text);
  const diagnostics: Diagnostic[] = [...parsed.diagnostics];
  const root = parsed.root;
  if (!root) return { diagnostics };
  if (head(root) !== "kicad_pcb") {
    diagnostics.push({
      severity: "error",
      code: "kicad.unknownRoot",
      message: `Unsupported KiCad root '${head(root)}'.`,
      line: root.line,
      column: root.column,
    });
    return { diagnostics };
  }
  const netNames = new Map<number, string>();
  const nets: string[] = [];
  const aliases = new Map<string, string>();
  const layers: { id: number; name: string; type: string }[] = [];
  const footprints: ReturnType<typeof readFootprint>[] = [];
  const graphics: PcbGraphicItem[] = [];
  const zones: NonNullable<ReturnType<typeof readZone>>[] = [];
  const tracks: NonNullable<ReturnType<typeof readTrack>>[] = [];
  const vias: {
    at: PcbXY;
    diameter: number;
    drill: number;
    layers: [string, string];
    net: string;
  }[] = [];
  const skipped = new Map<string, number>();
  let version = 0;
  let generator = "";
  let thickness: number | undefined;
  let maskExpansion = 0;
  // Root dispatch intentionally visits each top-level child exactly once.
  for (const item of root.items) {
    if (item.kind !== "list") continue;
    const kind = head(item);
    const map = fields(item);
    if (kind === "version") version = number(item, 1, diagnostics) ?? 0;
    else if (kind === "generator") generator = value(item) ?? "";
    else if (kind === "general")
      thickness = number(one(map, "thickness"), 1, diagnostics);
    else if (kind === "setup")
      maskExpansion =
        number(one(map, "pad_to_mask_clearance"), 1, diagnostics) ?? 0;
    else if (kind === "layers") {
      for (const layer of item.items) {
        if (layer.kind !== "list") continue;
        const layerAtoms = atoms(layer);
        const id = Number(layerAtoms[0]?.text);
        const name = layerAtoms[1]?.text ?? "";
        const type = layerAtoms[2]?.text ?? "signal";
        const userName = layerAtoms[3]?.text;
        if (!Number.isFinite(id) || !name) continue;
        layers.push({ id, name, type });
        if (userName) aliases.set(userName, name);
      }
    } else if (kind === "net") {
      const row = atoms(item);
      const code = Number(row[1]?.text);
      const name = row[2]?.text ?? "";
      if (Number.isFinite(code)) netNames.set(code, name);
      if (code !== 0 && name && !nets.includes(name)) nets.push(name);
    } else if (kind === "footprint" || kind === "module")
      footprints.push(readFootprint(item, map, aliases, netNames, diagnostics));
    else if (
      [
        "gr_line",
        "gr_arc",
        "gr_circle",
        "gr_rect",
        "gr_poly",
        "gr_text",
      ].includes(kind)
    ) {
      const graphic = readGraphic(item, kind, map, aliases, diagnostics);
      if (graphic) graphics.push(graphic);
    } else if (kind === "segment" || kind === "arc") {
      const track = readTrack(kind, map, aliases, netNames, diagnostics);
      if (track) tracks.push(track);
    } else if (kind === "via") {
      const at = point(one(map, "at"), diagnostics);
      const size = number(one(map, "size"), 1, diagnostics);
      const drill = number(one(map, "drill"), 1, diagnostics);
      const layerList = one(map, "layers");
      const layerAtoms = layerList
        ? atoms(layerList)
            .slice(1)
            .map((a) => layerName(a.text, aliases))
        : ["F.Cu", "B.Cu"];
      if (at && size !== undefined && drill !== undefined)
        vias.push({
          at,
          diameter: size,
          drill,
          layers: [layerAtoms[0] ?? "F.Cu", layerAtoms[1] ?? "B.Cu"],
          net: readNet(one(map, "net"), netNames),
        });
    } else if (kind === "zone") {
      const zone = readZone(item, map, aliases, netNames, diagnostics);
      if (zone) zones.push(zone);
    } else if (
      [
        "dimension",
        "target",
        "image",
        "gr_text_box",
        "gr_bbox",
        "model",
        "group",
      ].includes(kind)
    ) {
      skipped.set(kind, (skipped.get(kind) ?? 0) + 1);
    }
  }
  if (version > 0 && version < 20171130)
    diagnostics.push({
      severity: "warning",
      code: "kicad.oldVersion",
      message: `KiCad file version ${version} predates supported version 20171130.`,
      line: root.line,
      column: root.column,
    });
  for (const [kind, count] of skipped)
    diagnostics.push({
      severity: "warning",
      code: "kicad.unsupported",
      message: `Skipped ${count} ${kind} items.`,
      line: root.line,
      column: root.column,
    });
  tracks.sort((a, b) => layerRank(a.layer) - layerRank(b.layer));
  const board = {
    format: "kicad_pcb" as const,
    source: options.fileName,
    version,
    generator,
    ...(thickness !== undefined ? { thickness } : {}),
    maskExpansion,
    layers,
    nets,
  };
  const suffix = ".kicad_pcb";
  const title = options.fileName.toLowerCase().endsWith(suffix)
    ? options.fileName.slice(0, -suffix.length)
    : options.fileName;
  const plan: PcbImportPlan = {
    title,
    board,
    graphics,
    zones,
    tracks,
    vias,
    footprints,
  };
  return { plan, diagnostics };
}
