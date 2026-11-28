import {
  type CadPlane,
  type CadXY,
  type Element,
  type ElementId,
  type PageId,
  roundNm,
} from "@nodetto/ir";
import type { Command } from "../commands.ts";
import {
  arcCommands,
  type CadIds,
  circleCommands,
  extrudeCommands,
  lineCommands,
  rectangleCommands,
  sketchCommands,
} from "./authoring.ts";
import { pcbBoardOutline } from "./pcb-outline.ts";

const MAX_CAD_LENGTH_MM = 10_000;

export type EnclosureOpenFace = "end" | "start" | "both";

export interface EnclosureShellInput {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly height: number;
  readonly wallThickness: number;
  readonly floorThickness: number;
  readonly cornerRadius?: number;
  readonly openFace?: EnclosureOpenFace;
}

export interface EnclosureShellSpec {
  readonly outerX0: number;
  readonly outerY0: number;
  readonly outerX1: number;
  readonly outerY1: number;
  readonly outerWidth: number;
  readonly outerHeight: number;
  readonly innerX0: number;
  readonly innerY0: number;
  readonly innerX1: number;
  readonly innerY1: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly height: number;
  readonly wallThickness: number;
  readonly floorThickness: number;
  readonly cavityDepth: number;
  readonly outerRadius: number;
  readonly innerRadius: number;
  readonly openFace: EnclosureOpenFace;
}

export interface PcbBoardBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
  readonly thickness: number;
}

export interface PcbEnclosureInput {
  readonly boardMinX: number;
  readonly boardMinY: number;
  readonly boardMaxX: number;
  readonly boardMaxY: number;
  readonly boardThickness: number;
  readonly clearance: number;
  readonly wallThickness: number;
  readonly floorThickness: number;
  readonly standoffHeight: number;
  readonly componentHeadroom: number;
  readonly cornerRadius?: number;
}

export interface PcbEnclosureDims {
  readonly cavityX0: number;
  readonly cavityY0: number;
  readonly cavityX1: number;
  readonly cavityY1: number;
  readonly baseOffsetZ: number;
  readonly shell: EnclosureShellSpec;
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function snapCoord(value: number): number {
  return roundNm(value);
}

function withinExtent(value: number): boolean {
  return Math.abs(value) <= MAX_CAD_LENGTH_MM;
}

/**
 * Validate and normalize parameters for a hollow enclosure shell.
 * Returns null when the parameters would produce a degenerate or out-of-bounds shell.
 */
export function computeShellSpec(
  input: EnclosureShellInput,
): EnclosureShellSpec | null {
  const {
    x0,
    y0,
    x1,
    y1,
    height: rawHeight,
    wallThickness: rawWall,
    floorThickness: rawFloor,
    cornerRadius: rawRadius = 0,
    openFace = "end",
  } = input;

  if (
    ![x0, y0, x1, y1, rawHeight, rawWall, rawFloor, rawRadius].every(finite)
  ) {
    return null;
  }

  const outerX0 = snapCoord(Math.min(x0, x1));
  const outerX1 = snapCoord(Math.max(x0, x1));
  const outerY0 = snapCoord(Math.min(y0, y1));
  const outerY1 = snapCoord(Math.max(y0, y1));
  const outerWidth = snapCoord(outerX1 - outerX0);
  const outerHeight = snapCoord(outerY1 - outerY0);
  const height = snapCoord(rawHeight);
  const wallThickness = snapCoord(rawWall);
  const floorThickness = openFace === "both" ? 0 : snapCoord(rawFloor);
  const requestedRadius = snapCoord(rawRadius);

  if (
    ![outerX0, outerX1, outerY0, outerY1, height].every(withinExtent) ||
    outerWidth <= 0 ||
    outerHeight <= 0 ||
    height <= 0 ||
    wallThickness <= 0 ||
    floorThickness < 0 ||
    requestedRadius < 0
  ) {
    return null;
  }

  if (
    openFace !== "both" &&
    (floorThickness <= 0 || floorThickness >= height)
  ) {
    return null;
  }

  const innerX0 = snapCoord(outerX0 + wallThickness);
  const innerY0 = snapCoord(outerY0 + wallThickness);
  const innerX1 = snapCoord(outerX1 - wallThickness);
  const innerY1 = snapCoord(outerY1 - wallThickness);
  const innerWidth = snapCoord(innerX1 - innerX0);
  const innerHeight = snapCoord(innerY1 - innerY0);
  if (innerWidth <= 0 || innerHeight <= 0) return null;

  const cavityDepth = snapCoord(height - floorThickness);
  if (cavityDepth <= 0) return null;

  const maxOuterRadius = snapCoord(Math.min(outerWidth, outerHeight) / 2);
  const outerRadius = snapCoord(Math.min(requestedRadius, maxOuterRadius));
  const innerRadius =
    outerRadius > wallThickness ? snapCoord(outerRadius - wallThickness) : 0;

  return {
    outerX0,
    outerY0,
    outerX1,
    outerY1,
    outerWidth,
    outerHeight,
    innerX0,
    innerY0,
    innerX1,
    innerY1,
    innerWidth,
    innerHeight,
    height,
    wallThickness,
    floorThickness,
    cavityDepth,
    outerRadius,
    innerRadius,
    openFace,
  };
}

/**
 * Compute enclosure dimensions around a PCB board with clearance, wall, floor,
 * standoff height, and component headroom.
 */
export function computePcbEnclosureDims(
  input: PcbEnclosureInput,
): PcbEnclosureDims | null {
  const {
    boardMinX,
    boardMinY,
    boardMaxX,
    boardMaxY,
    boardThickness: rawBoardThickness,
    clearance: rawClearance,
    wallThickness: rawWall,
    floorThickness: rawFloor,
    standoffHeight: rawStandoff,
    componentHeadroom: rawHeadroom,
    cornerRadius = 0,
  } = input;

  if (
    ![
      boardMinX,
      boardMinY,
      boardMaxX,
      boardMaxY,
      rawBoardThickness,
      rawClearance,
      rawWall,
      rawFloor,
      rawStandoff,
      rawHeadroom,
      cornerRadius,
    ].every(finite)
  ) {
    return null;
  }

  const minX = snapCoord(Math.min(boardMinX, boardMaxX));
  const maxX = snapCoord(Math.max(boardMinX, boardMaxX));
  const minY = snapCoord(Math.min(boardMinY, boardMaxY));
  const maxY = snapCoord(Math.max(boardMinY, boardMaxY));
  const boardThickness = snapCoord(rawBoardThickness);
  const clearance = snapCoord(rawClearance);
  const wallThickness = snapCoord(rawWall);
  const floorThickness = snapCoord(rawFloor);
  const standoffHeight = snapCoord(rawStandoff);
  const componentHeadroom = snapCoord(rawHeadroom);

  if (
    maxX <= minX ||
    maxY <= minY ||
    boardThickness <= 0 ||
    clearance < 0 ||
    wallThickness <= 0 ||
    floorThickness <= 0 ||
    standoffHeight < 0 ||
    componentHeadroom <= 0
  ) {
    return null;
  }

  const cavityX0 = snapCoord(minX - clearance);
  const cavityY0 = snapCoord(minY - clearance);
  const cavityX1 = snapCoord(maxX + clearance);
  const cavityY1 = snapCoord(maxY + clearance);
  const outerX0 = snapCoord(cavityX0 - wallThickness);
  const outerY0 = snapCoord(cavityY0 - wallThickness);
  const outerX1 = snapCoord(cavityX1 + wallThickness);
  const outerY1 = snapCoord(cavityY1 + wallThickness);
  const cavityDepth = snapCoord(
    standoffHeight + boardThickness + componentHeadroom,
  );
  const height = snapCoord(floorThickness + cavityDepth);
  const baseOffsetZ = snapCoord(-(floorThickness + standoffHeight));

  if (!withinExtent(baseOffsetZ)) return null;

  const shell = computeShellSpec({
    x0: outerX0,
    y0: outerY0,
    x1: outerX1,
    y1: outerY1,
    height,
    wallThickness,
    floorThickness,
    cornerRadius,
    openFace: "end",
  });
  if (!shell) return null;

  return { cavityX0, cavityY0, cavityX1, cavityY1, baseOffsetZ, shell };
}

function trackIds(
  ids: CadIds,
  initialLast?: string,
): {
  readonly ids: CadIds;
  last(): string | undefined;
  record(commands: readonly Command[]): void;
} {
  let lastIndex = initialLast;
  const wrapped: CadIds = {
    next: () => ids.next(),
    indexAfter: (previous) => {
      const next = ids.indexAfter(lastIndex ?? previous);
      lastIndex = next;
      return next;
    },
    lastEntityIndex: (sketch) => lastIndex ?? ids.lastEntityIndex?.(sketch),
  };
  return {
    ids: wrapped,
    last: () => lastIndex,
    record(commands) {
      const tail = commands.at(-1);
      if (tail?.type === "createElement") lastIndex = tail.element.index;
    },
  };
}

/**
 * Author a 2D rounded rectangle on a sketch using exact shared endpoints
 * (4 straight edges + 4 quarter-circle arcs, or fewer when degenerating to a
 * stadium/slot or circle). Zero new IR element types.
 */
export function roundedRectangleCommands(
  pageId: PageId,
  sketch: Element,
  p: CadXY,
  q: CadXY,
  radius: number,
  ids: CadIds,
): Command[] {
  if (![p[0], p[1], q[0], q[1], radius].every(finite)) return [];
  const x0 = snapCoord(Math.min(p[0], q[0]));
  const x1 = snapCoord(Math.max(p[0], q[0]));
  const y0 = snapCoord(Math.min(p[1], q[1]));
  const y1 = snapCoord(Math.max(p[1], q[1]));
  const w = snapCoord(x1 - x0);
  const h = snapCoord(y1 - y0);
  if (w <= 0 || h <= 0) return [];
  if (radius <= 0)
    return rectangleCommands(pageId, sketch, [x0, y0], [x1, y1], ids);

  const r = snapCoord(Math.min(radius, w / 2, h / 2));
  if (r <= 0) return rectangleCommands(pageId, sketch, [x0, y0], [x1, y1], ids);

  const tracker = trackIds(ids, ids.lastEntityIndex?.(sketch));
  if (snapCoord(2 * r) === w && snapCoord(2 * r) === h) {
    return circleCommands(
      pageId,
      sketch,
      [snapCoord((x0 + x1) / 2), snapCoord((y0 + y1) / 2)],
      r,
      tracker.ids,
    );
  }

  const k = snapCoord(r * (1 - Math.sqrt(0.5)));
  const b0: CadXY = [snapCoord(x0 + r), y0];
  const b1: CadXY = [snapCoord(x1 - r), y0];
  const r0: CadXY = [x1, snapCoord(y0 + r)];
  const r1: CadXY = [x1, snapCoord(y1 - r)];
  const t0: CadXY = [snapCoord(x1 - r), y1];
  const t1: CadXY = [snapCoord(x0 + r), y1];
  const l0: CadXY = [x0, snapCoord(y1 - r)];
  const l1: CadXY = [x0, snapCoord(y0 + r)];

  const out: Command[] = [];
  const emitLine = (a: CadXY, b: CadXY): boolean => {
    if (a[0] === b[0] && a[1] === b[1]) return true;
    const cmds = lineCommands(pageId, sketch, a, b, tracker.ids);
    if (!cmds.length) return false;
    tracker.record(cmds);
    out.push(...cmds);
    return true;
  };
  const emitArc = (a: CadXY, m: CadXY, b: CadXY): boolean => {
    const cmds = arcCommands(pageId, sketch, a, m, b, tracker.ids);
    if (!cmds.length) return false;
    tracker.record(cmds);
    out.push(...cmds);
    return true;
  };

  const ok =
    emitLine(b0, b1) &&
    emitArc(b1, [snapCoord(x1 - k), snapCoord(y0 + k)], r0) &&
    emitLine(r0, r1) &&
    emitArc(r1, [snapCoord(x1 - k), snapCoord(y1 - k)], t0) &&
    emitLine(t0, t1) &&
    emitArc(t1, [snapCoord(x0 + k), snapCoord(y1 - k)], l0) &&
    emitLine(l0, l1) &&
    emitArc(l1, [snapCoord(x0 + k), snapCoord(y0 + k)], b0);

  return ok ? out : [];
}

/**
 * Author a 2D slot (obround / stadium) between centers `a` and `b` with
 * half-width `radius` (useful for USB/port cutouts and adjustable screw slots).
 */
export function slotCommands(
  pageId: PageId,
  sketch: Element,
  a: CadXY,
  b: CadXY,
  radius: number,
  ids: CadIds,
): Command[] {
  if (![a[0], a[1], b[0], b[1], radius].every(finite)) return [];
  const p0: CadXY = [snapCoord(a[0]), snapCoord(a[1])];
  const p1: CadXY = [snapCoord(b[0]), snapCoord(b[1])];
  const r = snapCoord(radius);
  if (r <= 0 || r > MAX_CAD_LENGTH_MM) return [];

  const tracker = trackIds(ids, ids.lastEntityIndex?.(sketch));
  if (p0[0] === p1[0] && p0[1] === p1[1]) {
    return circleCommands(pageId, sketch, p0, r, tracker.ids);
  }

  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= 0) return [];
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  const aRight: CadXY = [snapCoord(p0[0] - nx * r), snapCoord(p0[1] - ny * r)];
  const bRight: CadXY = [snapCoord(p1[0] - nx * r), snapCoord(p1[1] - ny * r)];
  const bLeft: CadXY = [snapCoord(p1[0] + nx * r), snapCoord(p1[1] + ny * r)];
  const aLeft: CadXY = [snapCoord(p0[0] + nx * r), snapCoord(p0[1] + ny * r)];
  const bCap: CadXY = [snapCoord(p1[0] + ux * r), snapCoord(p1[1] + uy * r)];
  const aCap: CadXY = [snapCoord(p0[0] - ux * r), snapCoord(p0[1] - uy * r)];

  const out: Command[] = [];
  const emitLine = (start: CadXY, end: CadXY): boolean => {
    const cmds = lineCommands(pageId, sketch, start, end, tracker.ids);
    if (!cmds.length) return false;
    tracker.record(cmds);
    out.push(...cmds);
    return true;
  };
  const emitArc = (start: CadXY, mid: CadXY, end: CadXY): boolean => {
    const cmds = arcCommands(pageId, sketch, start, mid, end, tracker.ids);
    if (!cmds.length) return false;
    tracker.record(cmds);
    out.push(...cmds);
    return true;
  };

  const ok =
    emitLine(aRight, bRight) &&
    emitArc(bRight, bCap, bLeft) &&
    emitLine(bLeft, aLeft) &&
    emitArc(aLeft, aCap, aRight);

  return ok ? out : [];
}

export interface EnclosureShellResult {
  readonly spec: EnclosureShellSpec;
  readonly outerSketchId: ElementId;
  readonly outerExtrudeId: ElementId;
  readonly cavitySketchId: ElementId;
  readonly cavityExtrudeId: ElementId;
  readonly commands: Command[];
}

/**
 * Author a parametric hollow enclosure shell (outer solid + inset cavity cut
 * on the chosen open face) using standard CAD sketch and extrude elements.
 */
export function enclosureShellCommands(
  pageId: PageId,
  plane: CadPlane,
  input: EnclosureShellInput,
  ids: CadIds,
  options: { readonly name?: string; readonly after?: string } = {},
): EnclosureShellResult | null {
  const spec = computeShellSpec(input);
  if (!spec) return null;

  const baseName = options.name?.trim() || "Enclosure";
  const tracker = trackIds(ids, options.after);
  const commands: Command[] = [];

  const outerSketch = sketchCommands(
    pageId,
    plane,
    `${baseName} Outer Sketch`,
    tracker.ids,
    tracker.last(),
  );
  const outerSketchEl = outerSketch.commands[0];
  if (outerSketchEl?.type !== "createElement") return null;
  tracker.record(outerSketch.commands);
  commands.push(...outerSketch.commands);

  const outerProfile =
    spec.outerRadius > 0
      ? roundedRectangleCommands(
          pageId,
          outerSketchEl.element,
          [spec.outerX0, spec.outerY0],
          [spec.outerX1, spec.outerY1],
          spec.outerRadius,
          tracker.ids,
        )
      : rectangleCommands(
          pageId,
          outerSketchEl.element,
          [spec.outerX0, spec.outerY0],
          [spec.outerX1, spec.outerY1],
          tracker.ids,
        );
  if (!outerProfile.length) return null;
  tracker.record(outerProfile);
  commands.push(...outerProfile);

  const outerExtrude = extrudeCommands(
    pageId,
    outerSketchEl.element,
    {
      name: baseName,
      distance: spec.height,
      op: "new",
      bodies: [],
    },
    tracker.ids,
  );
  if (!outerExtrude.commands.length) return null;
  tracker.record(outerExtrude.commands);
  commands.push(...outerExtrude.commands);

  const cavityFaceRole = spec.openFace === "start" ? "start" : "end";
  const cavityDistance =
    spec.openFace === "start" ? spec.cavityDepth : -spec.cavityDepth;

  const cavitySketch = sketchCommands(
    pageId,
    { face: { feature: outerExtrude.id, role: cavityFaceRole } },
    `${baseName} Cavity Sketch`,
    tracker.ids,
    tracker.last(),
  );
  const cavitySketchEl = cavitySketch.commands[0];
  if (cavitySketchEl?.type !== "createElement") return null;
  tracker.record(cavitySketch.commands);
  commands.push(...cavitySketch.commands);

  const cavityProfile =
    spec.innerRadius > 0
      ? roundedRectangleCommands(
          pageId,
          cavitySketchEl.element,
          [spec.innerX0, spec.innerY0],
          [spec.innerX1, spec.innerY1],
          spec.innerRadius,
          tracker.ids,
        )
      : rectangleCommands(
          pageId,
          cavitySketchEl.element,
          [spec.innerX0, spec.innerY0],
          [spec.innerX1, spec.innerY1],
          tracker.ids,
        );
  if (!cavityProfile.length) return null;
  tracker.record(cavityProfile);
  commands.push(...cavityProfile);

  const cavityExtrude = extrudeCommands(
    pageId,
    cavitySketchEl.element,
    {
      name: `${baseName} Cavity`,
      distance: cavityDistance,
      op: "cut",
      bodies: [outerExtrude.id],
    },
    tracker.ids,
  );
  if (!cavityExtrude.commands.length) return null;
  tracker.record(cavityExtrude.commands);
  commands.push(...cavityExtrude.commands);

  return {
    spec,
    outerSketchId: outerSketch.id,
    outerExtrudeId: outerExtrude.id,
    cavitySketchId: cavitySketch.id,
    cavityExtrudeId: cavityExtrude.id,
    commands,
  };
}

/**
 * Compute axis-aligned bounds of a PCB board's Edge.Cuts outline in CAD board
 * coordinates (mm).
 */
export function pcbBoardBounds(
  elements: readonly Element[],
  boardId: ElementId,
): PcbBoardBounds | { readonly error: string } {
  const outline = pcbBoardOutline(elements, boardId);
  if ("error" in outline) return { error: outline.error };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const loop of outline.loops) {
    for (let i = 0; i + 1 < loop.points.length; i += 2) {
      const x = loop.points[i];
      const y = loop.points[i + 1];
      if (x === undefined || y === undefined) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (![minX, minY, maxX, maxY].every(finite)) {
    return { error: "cad.pcb.noOutline" };
  }
  const sx0 = snapCoord(minX);
  const sy0 = snapCoord(minY);
  const sx1 = snapCoord(maxX);
  const sy1 = snapCoord(maxY);
  return {
    minX: sx0,
    minY: sy0,
    maxX: sx1,
    maxY: sy1,
    width: snapCoord(sx1 - sx0),
    height: snapCoord(sy1 - sy0),
    thickness: snapCoord(outline.thickness),
  };
}

export interface PcbStandoffOptions {
  readonly positions: readonly CadXY[];
  readonly outerRadius: number;
  readonly height: number;
  readonly holeRadius?: number;
  readonly holeDepth?: number;
  readonly name?: string;
  readonly after?: string;
}

export interface PcbStandoffResult {
  readonly bossSketchId: ElementId;
  readonly bossExtrudeId: ElementId;
  readonly holeSketchId?: ElementId;
  readonly holeExtrudeId?: ElementId;
  readonly commands: Command[];
}

/**
 * Author cylindrical PCB mounting standoffs (and optional concentric screw
 * pilot holes) on an enclosure cavity floor face.
 */
export function pcbStandoffCommands(
  pageId: PageId,
  cavityExtrudeId: ElementId,
  targetBodyId: ElementId,
  options: PcbStandoffOptions,
  ids: CadIds,
): PcbStandoffResult | null {
  const outerR = snapCoord(options.outerRadius);
  const height = snapCoord(options.height);
  const holeR =
    options.holeRadius !== undefined ? snapCoord(options.holeRadius) : 0;
  const holeDepth =
    options.holeDepth !== undefined ? snapCoord(options.holeDepth) : height;
  if (
    !options.positions.length ||
    !finite(outerR) ||
    !finite(height) ||
    !finite(holeR) ||
    !finite(holeDepth) ||
    outerR <= 0 ||
    height <= 0 ||
    holeR < 0 ||
    (holeR > 0 && (holeR >= outerR || holeDepth <= 0))
  ) {
    return null;
  }

  const baseName = options.name?.trim() || "Standoffs";
  const tracker = trackIds(ids, options.after);
  const commands: Command[] = [];

  const bossSketch = sketchCommands(
    pageId,
    { face: { feature: cavityExtrudeId, role: "end" } },
    `${baseName} Sketch`,
    tracker.ids,
    tracker.last(),
  );
  const bossSketchEl = bossSketch.commands[0];
  if (bossSketchEl?.type !== "createElement") return null;
  tracker.record(bossSketch.commands);
  commands.push(...bossSketch.commands);

  for (const pos of options.positions) {
    const circle = circleCommands(
      pageId,
      bossSketchEl.element,
      pos,
      outerR,
      tracker.ids,
    );
    if (!circle.length) return null;
    tracker.record(circle);
    commands.push(...circle);
  }

  const bossExtrude = extrudeCommands(
    pageId,
    bossSketchEl.element,
    {
      name: baseName,
      distance: height,
      op: "add",
      bodies: [targetBodyId],
    },
    tracker.ids,
  );
  if (!bossExtrude.commands.length) return null;
  tracker.record(bossExtrude.commands);
  commands.push(...bossExtrude.commands);

  if (holeR <= 0) {
    return {
      bossSketchId: bossSketch.id,
      bossExtrudeId: bossExtrude.id,
      commands,
    };
  }

  const holeSketch = sketchCommands(
    pageId,
    { face: { feature: bossExtrude.id, role: "end" } },
    `${baseName} Holes Sketch`,
    tracker.ids,
    tracker.last(),
  );
  const holeSketchEl = holeSketch.commands[0];
  if (holeSketchEl?.type !== "createElement") return null;
  tracker.record(holeSketch.commands);
  commands.push(...holeSketch.commands);

  for (const pos of options.positions) {
    const circle = circleCommands(
      pageId,
      holeSketchEl.element,
      pos,
      holeR,
      tracker.ids,
    );
    if (!circle.length) return null;
    tracker.record(circle);
    commands.push(...circle);
  }

  const holeExtrude = extrudeCommands(
    pageId,
    holeSketchEl.element,
    {
      name: `${baseName} Holes`,
      distance: -holeDepth,
      op: "cut",
      bodies: [targetBodyId],
    },
    tracker.ids,
  );
  if (!holeExtrude.commands.length) return null;
  tracker.record(holeExtrude.commands);
  commands.push(...holeExtrude.commands);

  return {
    bossSketchId: bossSketch.id,
    bossExtrudeId: bossExtrude.id,
    holeSketchId: holeSketch.id,
    holeExtrudeId: holeExtrude.id,
    commands,
  };
}

export interface PcbEnclosureOptions {
  readonly clearance?: number;
  readonly wallThickness?: number;
  readonly floorThickness?: number;
  readonly standoffHeight?: number;
  readonly componentHeadroom?: number;
  readonly cornerRadius?: number;
  readonly standoffInset?: number;
  readonly standoffOuterRadius?: number;
  readonly standoffHoleRadius?: number;
  readonly name?: string;
  readonly after?: string;
}

export interface PcbEnclosureResult {
  readonly bounds: PcbBoardBounds;
  readonly dims: PcbEnclosureDims;
  readonly shell: EnclosureShellResult;
  readonly standoffs?: PcbStandoffResult;
  readonly commands: Command[];
}

/**
 * Author a complete enclosure around a referenced PCB board:
 * 1. Hollow shell positioned so the board sits at z = 0..thickness on top of standoffs.
 * 2. Optional 4-corner mounting standoffs (with optional pilot screw holes).
 */
export function pcbEnclosureCommands(
  pageId: PageId,
  elements: readonly Element[],
  boardId: ElementId,
  options: PcbEnclosureOptions,
  ids: CadIds,
): PcbEnclosureResult | { readonly error: string } {
  const bounds = pcbBoardBounds(elements, boardId);
  if ("error" in bounds) return bounds;

  const clearance = options.clearance ?? 1;
  const wallThickness = options.wallThickness ?? 2;
  const floorThickness = options.floorThickness ?? 2;
  const standoffHeight = options.standoffHeight ?? 3;
  const componentHeadroom = options.componentHeadroom ?? 12;
  const cornerRadius = options.cornerRadius ?? 2;

  const dims = computePcbEnclosureDims({
    boardMinX: bounds.minX,
    boardMinY: bounds.minY,
    boardMaxX: bounds.maxX,
    boardMaxY: bounds.maxY,
    boardThickness: bounds.thickness,
    clearance,
    wallThickness,
    floorThickness,
    standoffHeight,
    componentHeadroom,
    cornerRadius,
  });
  if (!dims) return { error: "cad.enclosure.invalid" };

  const tracker = trackIds(ids, options.after);
  const shell = enclosureShellCommands(
    pageId,
    { base: "xy", offset: dims.baseOffsetZ },
    {
      x0: dims.shell.outerX0,
      y0: dims.shell.outerY0,
      x1: dims.shell.outerX1,
      y1: dims.shell.outerY1,
      height: dims.shell.height,
      wallThickness: dims.shell.wallThickness,
      floorThickness: dims.shell.floorThickness,
      cornerRadius: dims.shell.outerRadius,
      openFace: "end",
    },
    tracker.ids,
    { name: options.name ?? "PCB Enclosure", after: tracker.last() },
  );
  if (!shell) return { error: "cad.enclosure.invalid" };
  tracker.record(shell.commands);

  const commands: Command[] = [...shell.commands];
  let standoffs: PcbStandoffResult | undefined;

  if (standoffHeight > 0 && options.standoffOuterRadius !== undefined) {
    const inset =
      options.standoffInset ?? Math.max(options.standoffOuterRadius, 3);
    const sx0 = snapCoord(bounds.minX + inset);
    const sx1 = snapCoord(bounds.maxX - inset);
    const sy0 = snapCoord(bounds.minY + inset);
    const sy1 = snapCoord(bounds.maxY - inset);
    if (sx0 < sx1 && sy0 < sy1) {
      const positions: CadXY[] = [
        [sx0, sy0],
        [sx1, sy0],
        [sx1, sy1],
        [sx0, sy1],
      ];
      const built = pcbStandoffCommands(
        pageId,
        shell.cavityExtrudeId,
        shell.outerExtrudeId,
        {
          positions,
          outerRadius: options.standoffOuterRadius,
          height: standoffHeight,
          ...(options.standoffHoleRadius !== undefined
            ? { holeRadius: options.standoffHoleRadius }
            : {}),
          name: `${options.name ?? "PCB Enclosure"} Standoffs`,
          after: tracker.last(),
        },
        tracker.ids,
      );
      if (built) {
        standoffs = built;
        tracker.record(built.commands);
        commands.push(...built.commands);
      }
    }
  }

  return {
    bounds,
    dims,
    shell,
    ...(standoffs ? { standoffs } : {}),
    commands,
  };
}

/**
 * Author a component keep-out volume on top of a `cad.pcb` reference body so
 * clearance against lids or internal ribs can be checked visually or via CLI
 * `capture` interference reporting.
 */
export function pcbKeepoutCommands(
  pageId: PageId,
  pcbFeatureId: ElementId,
  bounds: Pick<PcbBoardBounds, "minX" | "minY" | "maxX" | "maxY">,
  componentHeight: number,
  ids: CadIds,
  options: {
    readonly margin?: number;
    readonly name?: string;
    readonly after?: string;
  } = {},
): {
  readonly sketchId: ElementId;
  readonly extrudeId: ElementId;
  readonly commands: Command[];
} | null {
  const margin = snapCoord(options.margin ?? 0);
  const height = snapCoord(componentHeight);
  if (
    ![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, margin, height].every(
      finite,
    ) ||
    height <= 0
  ) {
    return null;
  }
  const x0 = snapCoord(bounds.minX - margin);
  const y0 = snapCoord(bounds.minY - margin);
  const x1 = snapCoord(bounds.maxX + margin);
  const y1 = snapCoord(bounds.maxY + margin);
  if (x1 <= x0 || y1 <= y0) return null;

  const name = options.name?.trim() || "Component Keep-out";
  const tracker = trackIds(ids, options.after);
  const sketch = sketchCommands(
    pageId,
    { face: { feature: pcbFeatureId, role: "end" } },
    `${name} Sketch`,
    tracker.ids,
    tracker.last(),
  );
  const sketchEl = sketch.commands[0];
  if (sketchEl?.type !== "createElement") return null;
  tracker.record(sketch.commands);

  const rect = rectangleCommands(
    pageId,
    sketchEl.element,
    [x0, y0],
    [x1, y1],
    tracker.ids,
  );
  if (!rect.length) return null;
  tracker.record(rect);

  const extrude = extrudeCommands(
    pageId,
    sketchEl.element,
    { name, distance: height, op: "new", bodies: [] },
    tracker.ids,
  );
  if (!extrude.commands.length) return null;

  return {
    sketchId: sketch.id,
    extrudeId: extrude.id,
    commands: [...sketch.commands, ...rect, ...extrude.commands],
  };
}
