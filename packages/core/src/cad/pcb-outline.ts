import {
  type Element,
  type ElementId,
  getElementTypeDefinition,
  isPlainObject,
  type PageId,
  type PcbGraphicSemantic,
  type PcbShape,
  roundNm,
} from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import { shapeBounds } from "../pcb-board/geometry.ts";
import {
  buildProfileLoops,
  type CadLoop,
  type CadProfilePath,
} from "./loops.ts";
import { tessellateArc, tessellateCircle } from "./tessellate.ts";
import { NM_PER_MM } from "./vec.ts";

export interface PcbOutline {
  readonly loops: readonly CadLoop[];
  readonly thickness: number;
  /** Source graphic per edge, in loop order. */
  readonly sources: readonly ElementId[];
}

type OutlineError = {
  error: "cad.pcb.noBoard" | "cad.pcb.noOutline" | "cad.pcb.openOutline";
  at?: ElementId;
};

export function isPcbOutlineGraphic(element: Element): boolean {
  return (
    element.type === "pcb.graphic" &&
    element.visual.hidden !== true &&
    isPlainObject(element.semantic) &&
    element.semantic["layer"] === "Edge.Cuts"
  );
}

type PageOutline = Pick<PcbOutline, "loops" | "sources">;

export interface PcbOutlineIndex {
  readonly boards: ReadonlyMap<ElementId, Element>;
  readonly graphics: ReadonlyMap<PageId, readonly Element[]>;
}

const outlineMemos = new WeakMap<
  PcbOutlineIndex,
  Map<PageId, PageOutline | OutlineError>
>();

export function pcbOutlineIndex(elements: readonly Element[]): PcbOutlineIndex {
  const boards = new Map<ElementId, Element>();
  const graphics = new Map<PageId, Element[]>();
  for (const element of elements) {
    if (element.type === "pcb.board") boards.set(element.id, element);
    else if (isPcbOutlineGraphic(element)) {
      const page = graphics.get(element.page);
      if (page) page.push(element);
      else graphics.set(element.page, [element]);
    }
  }
  for (const page of graphics.values())
    page.sort((a, b) => compareFractional(a.id, b.id));
  const index: PcbOutlineIndex = { boards, graphics };
  outlineMemos.set(index, new Map());
  return index;
}

export function pcbOutlineGraphics(
  elements: readonly Element[],
  page: PageId,
): Element[] {
  return elements
    .filter(isPcbOutlineGraphic)
    .filter((element) => element.page === page)
    .sort((a, b) => compareFractional(a.id, b.id));
}

function pathFor(
  id: ElementId,
  shape: Exclude<PcbShape, { kind: "text" }>,
): CadProfilePath | null {
  switch (shape.kind) {
    case "line":
      return { id, points: [...shape.start, ...shape.end] };
    case "arc": {
      if (
        ![...shape.start, ...shape.mid, ...shape.end].every(
          (value) => Math.abs(value * NM_PER_MM) <= Number.MAX_SAFE_INTEGER / 2,
        )
      )
        return null;
      const points = tessellateArc(shape.start, shape.mid, shape.end);
      return points && { id, points };
    }
    case "circle":
      return {
        id,
        points: tessellateCircle(shape.center, shape.radius),
        closed: true,
      };
    case "rect": {
      const [x, y] = shape.start;
      const [right, bottom] = shape.end;
      return {
        id,
        points: [x, y, right, y, right, bottom, x, bottom],
        closed: true,
      };
    }
    case "polygon": {
      const points = shape.points.flat();
      if (points[0] === points.at(-2) && points[1] === points.at(-1))
        points.length = Math.max(0, points.length - 2);
      return { id, points, closed: true };
    }
  }
}

export function pcbBoardOutline(
  elements: readonly Element[],
  boardId: ElementId,
): PcbOutline | OutlineError {
  return pcbBoardOutlineIndexed(pcbOutlineIndex(elements), boardId);
}

export function pcbBoardOutlineIndexed(
  index: PcbOutlineIndex,
  boardId: ElementId,
): PcbOutline | OutlineError {
  const board = index.boards.get(boardId);
  if (!board || !isPlainObject(board.semantic))
    return { error: "cad.pcb.noBoard" };
  const outlines = outlineMemos.get(index);
  if (!outlines) throw new TypeError("Invalid PCB outline index");
  let outline = outlines.get(board.page);
  if (!outline) {
    outline = pageOutline(index.graphics.get(board.page) ?? []);
    outlines.set(board.page, outline);
  }
  if ("error" in outline) return outline;
  const { thickness } = board.semantic;
  return {
    ...outline,
    thickness:
      typeof thickness === "number" &&
      Number.isFinite(thickness) &&
      thickness > 0
        ? thickness
        : 1.6,
  };
}

function pageOutline(graphics: readonly Element[]): PageOutline | OutlineError {
  const paths: CadProfilePath[] = [];
  let minX = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const { id, semantic } of graphics) {
    if (
      getElementTypeDefinition("pcb.graphic")?.validateSemantic(
        semantic,
        "semantic",
      ).length !== 0
    )
      return { error: "cad.pcb.openOutline", at: id };
    const { shape } = semantic as PcbGraphicSemantic;
    if (shape.kind === "text") continue;
    const path = pathFor(id, shape);
    if (!path) return { error: "cad.pcb.openOutline", at: id };
    paths.push(path);
    const bounds = shapeBounds(shape, 0);
    minX = Math.min(minX, bounds.minX);
    maxY = Math.max(maxY, bounds.maxY);
  }
  if (!paths.length) return { error: "cad.pcb.noOutline" };
  const profile = buildProfileLoops(
    paths.map(({ id, points, closed }) => ({
      id,
      ...(closed ? { closed } : {}),
      points: points.map((value, i) => {
        // Use the same micrometre key on both sides of a join. Interior
        // tessellation vertices retain the nanometre geometry precision.
        const endpoint = !closed && (i < 2 || i >= points.length - 2);
        const joined = endpoint ? Math.round(value * 1000) / 1000 : value;
        return roundNm(i % 2 === 0 ? joined - minX : maxY - joined);
      }),
    })),
  );
  if ("error" in profile)
    return {
      error: "cad.pcb.openOutline",
      ...(profile.at === undefined ? {} : { at: profile.at }),
    };
  return {
    loops: profile.loops,
    sources: profile.loops.flatMap(({ sources }) => sources),
  };
}
