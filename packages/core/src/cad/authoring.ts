import {
  type CadExtrudeSemantic,
  type CadFaceRef,
  type CadPlane,
  type CadSketchSemantic,
  type CadXY,
  type Element,
  type ElementId,
  getElementTypeDefinition,
  isPlainObject,
  type PageId,
  roundNm,
  type SemanticByType,
} from "@nodetto/ir";
import type { Command } from "../commands.ts";
import { compareFractional } from "../fractional.ts";
import { faceBody, faceOutwardSign, isSketchEntity } from "./history.ts";
import { tessellateArc } from "./tessellate.ts";

export { sketchFrameLookup, sketchFrameOf } from "./history.ts";

export interface CadIds {
  next(): ElementId;
  indexAfter(previous: string | undefined): string;
  lastEntityIndex?(sketch: Element): string | undefined;
}

type SketchElementType = "cad.sketch" | "cad.line" | "cad.circle" | "cad.arc";
type Create = Extract<Command, { type: "createElement" }>;

function create<T extends SketchElementType | "cad.extrude">(
  page: PageId,
  type: T,
  semantic: SemanticByType[T],
  ids: CadIds,
  after: string | undefined,
): Create {
  return {
    type: "createElement",
    element: {
      id: ids.next(),
      page,
      type,
      index: ids.indexAfter(after),
      semantic,
      visual: {},
    },
  };
}

export function sketchCommands(
  pageId: PageId,
  plane: CadPlane,
  name: string,
  ids: CadIds,
  after?: string,
): { id: ElementId; commands: Command[] } {
  const snapped =
    "base" in plane && plane.offset !== undefined
      ? { base: plane.base, offset: roundNm(plane.offset) }
      : plane;
  const command = create(
    pageId,
    "cad.sketch",
    { name, plane: snapped },
    ids,
    after,
  );
  return { id: command.element.id, commands: [command] };
}

export function sketchParentOf(element: Element): ElementId | undefined {
  const { type, semantic } = element;
  return isSketchEntity(type) &&
    isPlainObject(semantic) &&
    typeof semantic.sketch === "string"
    ? semantic.sketch
    : undefined;
}

function snap(p: CadXY): CadXY {
  return [roundNm(p[0]), roundNm(p[1])];
}

function entityWriter(pageId: PageId, sketch: Element, ids: CadIds) {
  const commands: Command[] = [];
  let after = ids.lastEntityIndex?.(sketch) ?? sketch.index;
  function add<T extends Exclude<SketchElementType, "cad.sketch">>(
    type: T,
    semantic: SemanticByType[T],
  ): void {
    if (
      sketch.type !== "cad.sketch" ||
      sketch.page !== pageId ||
      getElementTypeDefinition(type)?.validateSemantic(semantic, "semantic")
        .length
    )
      return;
    const command = create(pageId, type, semantic, ids, after);
    commands.push(command);
    after = command.element.index;
  }
  return { commands, add };
}

export function lineCommands(
  pageId: PageId,
  sketch: Element,
  a: CadXY,
  b: CadXY,
  ids: CadIds,
): Command[] {
  const start = snap(a);
  const end = snap(b);
  if (start[0] === end[0] && start[1] === end[1]) return [];
  const writer = entityWriter(pageId, sketch, ids);
  writer.add("cad.line", { sketch: sketch.id, a: start, b: end });
  return writer.commands;
}

export function rectangleCommands(
  pageId: PageId,
  sketch: Element,
  p: CadXY,
  q: CadXY,
  ids: CadIds,
): Command[] {
  const a = snap(p);
  const c = snap(q);
  if (a[0] === c[0] || a[1] === c[1]) return [];
  const b: CadXY = [c[0], a[1]];
  const d: CadXY = [a[0], c[1]];
  const writer = entityWriter(pageId, sketch, ids);
  for (const [start, end] of [
    [a, b],
    [b, c],
    [c, d],
    [d, a],
  ] as const)
    writer.add("cad.line", { sketch: sketch.id, a: start, b: end });
  return writer.commands.length === 4 ? writer.commands : [];
}

export function circleCommands(
  pageId: PageId,
  sketch: Element,
  c: CadXY,
  r: number,
  ids: CadIds,
): Command[] {
  const radius = roundNm(r);
  if (radius > 10_000) return [];
  const writer = entityWriter(pageId, sketch, ids);
  writer.add("cad.circle", { sketch: sketch.id, c: snap(c), r: radius });
  return writer.commands;
}

export function arcCommands(
  pageId: PageId,
  sketch: Element,
  a: CadXY,
  m: CadXY,
  b: CadXY,
  ids: CadIds,
): Command[] {
  const writer = entityWriter(pageId, sketch, ids);
  const start = snap(a);
  const middle = snap(m);
  const end = snap(b);
  if (
    ![...start, ...middle, ...end].every(Number.isFinite) ||
    !tessellateArc(start, middle, end)
  )
    return [];
  writer.add("cad.arc", { sketch: sketch.id, a: start, m: middle, b: end });
  return writer.commands;
}

function sketchFace(sketch: Element | undefined): CadFaceRef | undefined {
  if (
    sketch?.type !== "cad.sketch" ||
    getElementTypeDefinition("cad.sketch")?.validateSemantic(
      sketch.semantic,
      "semantic",
    ).length !== 0
  )
    return undefined;
  const { plane } = sketch.semantic as CadSketchSemantic;
  return "face" in plane ? plane.face : undefined;
}

export function defaultExtrude(
  elements: readonly Element[],
  sketchId: ElementId,
): {
  op: "new" | "add" | "cut";
  bodies: readonly ElementId[];
  distance: number;
} {
  const face = sketchFace(elements.find(({ id }) => id === sketchId));
  if (face) {
    const body = faceBody(elements, face);
    const outward = body === null ? 0 : faceOutwardSign(elements, face);
    if (body !== null && outward !== 0)
      return { op: "add", bodies: [body], distance: 10 * outward };
  }
  return { op: "new", bodies: [], distance: 10 };
}

export function extrudeIntent(
  elements: readonly Element[],
  sketch: Element,
  distance: number,
  currentOp: CadExtrudeSemantic["op"] = "new",
): CadExtrudeSemantic["op"] {
  const face = sketchFace(sketch);
  const signed = face ? distance * faceOutwardSign(elements, face) : 0;
  return signed > 0 ? "add" : signed < 0 ? "cut" : currentOp;
}

export function extrudeCommands(
  pageId: PageId,
  sketch: Element,
  params: {
    distance: number;
    op: CadExtrudeSemantic["op"];
    bodies: readonly ElementId[];
    name: string;
  },
  ids: CadIds,
): { id: ElementId; commands: Command[] } {
  const { distance, op, bodies, name } = params;
  const semantic: CadExtrudeSemantic = {
    sketch: sketch.id,
    distance: roundNm(distance),
    op,
    name,
    ...(op !== "new" && bodies.length ? { bodies: [...bodies] } : {}),
  };
  if (
    sketch.type !== "cad.sketch" ||
    sketch.page !== pageId ||
    Math.abs(semantic.distance) > 10_000 ||
    getElementTypeDefinition("cad.extrude")?.validateSemantic(
      semantic,
      "semantic",
    ).length !== 0
  )
    return { id: "", commands: [] };
  const last = ids.lastEntityIndex?.(sketch);
  const after =
    last !== undefined && compareFractional(last, sketch.index) > 0
      ? last
      : sketch.index;
  const command = create(pageId, "cad.extrude", semantic, ids, after);
  return { id: command.element.id, commands: [command] };
}
