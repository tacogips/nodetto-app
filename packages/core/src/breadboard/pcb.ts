// Breadboard to PCB: fabrication files a board house such as JLCPCB accepts.
//
// The PCB keeps the breadboard's geometry. Every hole a part lead or wire end
// uses becomes a plated through hole, and each breadboard strip becomes a
// bottom-layer trace joining the holes used in it, so the nets are the
// breadboard's nets by construction. A wire becomes a top-layer trace when
// its path clears every other pad and trace; otherwise it stays a jumper wire
// drawn on the silkscreen. Parts not seated in this board's holes are left
// off with a warning.

import type {
  BreadboardPartType,
  BreadboardTransistorSemantic,
  Document,
  Element,
  ElementId,
  PageId,
} from "@nodetto/ir";
import { BREADBOARD_PART_TYPES, BREADBOARD_PITCH } from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import type { Vec } from "../geometry.ts";
import { boxCenter, rotatePoint } from "../geometry.ts";
import { encodeStoredZip } from "../zip.ts";
import { boardHoles, boardLayout, type BreadboardHole } from "./board.ts";
import {
  breadboardBox,
  breadboardPins,
  breadboardWirePoints,
  type BreadboardPagePin,
} from "./catalogue.ts";
import { computeBreadboardConnectivity } from "./connectivity.ts";
import {
  boxClearOfKeepouts,
  clipLegendStroke,
  type LegendKeepout,
  type LegendRect,
  PCB_LAYER_COUNT,
  type PadShape,
  type PcbDesign,
  type PcbFile,
  type PcbPoint,
  type PcbTrace,
  pcbFabricationFiles,
  strokeFontSupports,
  strokeText,
  strokeTextWidth,
  trimPcbToUsed,
} from "../pcb/index.ts";

/** Design rules in millimetres, within common board-house minimums. */
export const BREADBOARD_PCB_RULES = {
  /** 0.1 inch: the breadboard hole pitch. */
  pitch: 2.54,
  drill: 1.0,
  pad: 1.8,
  maskOpening: 1.9,
  stripTrace: 0.8,
  wireTrace: 0.5,
  clearance: 0.3,
  legendLine: 0.18,
  legendText: 1.0,
  edgeLine: 0.1,
  /** Keeps routed traces this far inside the board edge. */
  edgeKeepout: 0.5,
  /** Minimum distance from legend ink to a solder mask opening. */
  legendPadClearance: 0.15,
  /** Minimum distance from legend ink to the board edge. */
  legendEdgeClearance: 0.2,
  /** Extra board-house margin around the used geometry. */
  usedMargin: 1.0,
} satisfies Record<string, number>;

const rules = BREADBOARD_PCB_RULES;
const GENERATOR = "Nodetto,Breadboard PCB";

export type BreadboardPcbFile = PcbFile;

export interface BreadboardPcb {
  readonly boardId: ElementId;
  /** Board outline size in millimetres. */
  readonly width: number;
  readonly height: number;
  readonly files: readonly BreadboardPcbFile[];
  readonly warnings: readonly string[];
  readonly notes: readonly string[];
}

export interface BreadboardPcbOptions {
  /** Board element id, or a unique prefix of one; needed with several boards. */
  readonly board?: string;
  /** Base name of the files in the archive. */
  readonly name?: string;
  /** Emit the full board or trim the outline around the used geometry. */
  readonly outline?: "board" | "used";
}

interface UsedHole {
  readonly hole: BreadboardHole;
  readonly at: PcbPoint;
  shape: PadShape;
}

interface RoutedTrace {
  readonly net: number | undefined;
  readonly points: readonly PcbPoint[];
}

function elementOrder(left: Element, right: Element): number {
  return (
    compareFractional(left.index, right.index) ||
    compareFractional(left.id, right.id)
  );
}

function pageElements(document: Document, pageId: PageId): readonly Element[] {
  return document.elements
    .filter(
      (element) => element.page === pageId && element.visual.hidden !== true,
    )
    .sort(elementOrder);
}

function isPart(element: Element): boolean {
  return BREADBOARD_PART_TYPES.includes(element.type as BreadboardPartType);
}

function reference(element: Element): string {
  return (element.semantic as { reference?: string }).reference || "?";
}

function holeKey(x: number, y: number): string {
  return `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
}

function roundMm(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function boardSize(board: Element): "full" | "half" | "mini" {
  const size = (board.semantic as { size?: string }).size;
  return size === "full" || size === "mini" ? size : "half";
}

function selectBoard(
  boards: readonly Element[],
  query: string | undefined,
): Element | string {
  if (query !== undefined) {
    const matches = boards.filter((board) => board.id.startsWith(query));
    const [match, ...others] = matches;
    if (!match)
      return `No board on this page has an id starting with ${query}.`;
    if (others.length)
      return `${matches.length} boards have an id starting with ${query}; give more of the id.`;
    return match;
  }
  const [only, ...others] = boards;
  if (!only) return "The breadboard page has no board.";
  if (!others.length) return only;
  return `The page has ${boards.length} boards; choose one:\n${boards
    .map(
      (board) =>
        `  ${board.id} (${boardSize(board)} board at ${board.visual.x ?? 0}, ${board.visual.y ?? 0})`,
    )
    .join("\n")}`;
}

/** Maps page coordinates into the board's frame: millimetres, y up. */
function boardFrame(
  board: Element,
  heightPitches: number,
): (point: Vec) => PcbPoint {
  const box = breadboardBox(board);
  const pivot = box ? boxCenter(box) : { x: 0, y: 0 };
  const rotation = board.visual.rotation ?? 0;
  const originX = board.visual.x ?? 0;
  const originY = board.visual.y ?? 0;
  return (point) => {
    const local = rotation ? rotatePoint(point, pivot, -rotation) : point;
    return {
      x: roundMm(((local.x - originX) / BREADBOARD_PITCH) * rules.pitch),
      y: roundMm(
        (heightPitches - (local.y - originY) / BREADBOARD_PITCH) * rules.pitch,
      ),
    };
  };
}

function distanceToSegment(
  point: PcbPoint,
  from: PcbPoint,
  to: PcbPoint,
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - from.x) * dx + (point.y - from.y) * dy) / length,
          ),
        );
  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy));
}

function orientation(a: PcbPoint, b: PcbPoint, c: PcbPoint): number {
  return Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
}

function segmentsCross(
  a: PcbPoint,
  b: PcbPoint,
  c: PcbPoint,
  d: PcbPoint,
): boolean {
  return (
    orientation(a, b, c) * orientation(a, b, d) < 0 &&
    orientation(c, d, a) * orientation(c, d, b) < 0
  );
}

function segmentDistance(
  a: PcbPoint,
  b: PcbPoint,
  c: PcbPoint,
  d: PcbPoint,
): number {
  if (segmentsCross(a, b, c, d)) return 0;
  return Math.min(
    distanceToSegment(a, c, d),
    distanceToSegment(b, c, d),
    distanceToSegment(c, a, b),
    distanceToSegment(d, a, b),
  );
}

function segments(
  points: readonly PcbPoint[],
): readonly (readonly [PcbPoint, PcbPoint])[] {
  const result: (readonly [PcbPoint, PcbPoint])[] = [];
  points.forEach((point, index) => {
    const next = points[index + 1];
    if (next) result.push([point, next]);
  });
  return result;
}

function padRadius(shape: PadShape): number {
  return shape === "circle" ? rules.pad / 2 : (rules.pad / 2) * Math.SQRT2;
}

/** Direction away from the other pins, using deterministic arithmetic. */
function markDirection(pin: PcbPoint, others: readonly PcbPoint[]): PcbPoint {
  const centre = others.length
    ? {
        x: others.reduce((sum, point) => sum + point.x, 0) / others.length,
        y: others.reduce((sum, point) => sum + point.y, 0) / others.length,
      }
    : { x: pin.x + 1, y: pin.y };
  const dx = others.length ? pin.x - centre.x : -1;
  const dy = others.length ? pin.y - centre.y : 0;
  const length = Math.sqrt(dx * dx + dy * dy);
  return length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
}

function polarityMark(
  part: Element,
  pin: BreadboardPagePin,
): string | undefined {
  switch (part.type) {
    case "breadboard.led":
      return pin.name === "A" ? "+" : undefined;
    case "breadboard.diode":
      return pin.name === "K" ? "K" : undefined;
    case "breadboard.capacitor":
    case "breadboard.battery":
      return pin.name === "+" ? "+" : undefined;
    default:
      return undefined;
  }
}

function legendLabel(part: Element): string {
  const ref = reference(part);
  return part.type === "breadboard.transistor"
    ? `${ref} ${(part.semantic as BreadboardTransistorSemantic).pinout}`
    : ref;
}

interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function around(at: PcbPoint, width: number, height: number): Bounds {
  return {
    minX: at.x - width / 2,
    minY: at.y - height / 2,
    maxX: at.x + width / 2,
    maxY: at.y + height / 2,
  };
}

function textBounds(text: string, at: PcbPoint): Bounds {
  return around(
    at,
    strokeTextWidth(text, rules.legendText) + rules.legendLine,
    rules.legendText + rules.legendLine,
  );
}

function boundsOf(points: readonly PcbPoint[]): Bounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function overlaps(left: Bounds, right: Bounds): boolean {
  return (
    left.minX < right.maxX &&
    right.minX < left.maxX &&
    left.minY < right.maxY &&
    right.minY < left.maxY
  );
}

function contains(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.minY >= outer.minY &&
    inner.maxX <= outer.maxX &&
    inner.maxY <= outer.maxY
  );
}

function fileBaseName(name: string | undefined): string {
  const cleaned = (name ?? "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "breadboard";
}

export function exportBreadboardPcb(
  document: Document,
  pageId: PageId,
  options: BreadboardPcbOptions = {},
): BreadboardPcb | string {
  const elements = pageElements(document, pageId);
  const board = selectBoard(
    elements.filter((element) => element.type === "breadboard.board"),
    options.board,
  );
  if (typeof board === "string") return board;

  const layout = boardLayout(boardSize(board));
  const width = roundMm(layout.width * rules.pitch);
  const height = roundMm(layout.height * rules.pitch);
  const frame = boardFrame(board, layout.height);
  const holeAt = (hole: BreadboardHole): PcbPoint => ({
    x: roundMm(hole.x * rules.pitch),
    y: roundMm((layout.height - hole.y) * rules.pitch),
  });
  const holesByPosition = new Map(
    boardHoles(board).map((hole) => [holeKey(hole.pageX, hole.pageY), hole]),
  );
  const findHole = (point: Vec): BreadboardHole | undefined =>
    holesByPosition.get(holeKey(point.x, point.y));

  const warnings: string[] = [];
  /** What goes through each hole: part leads and jumper wire ends. */
  const leads = new Map<string, string[]>();
  const addLead = (hole: BreadboardHole, lead: string) =>
    leads.set(hole.id, [...(leads.get(hole.id) ?? []), lead]);
  const used = new Map<string, UsedHole>();
  const use = (hole: BreadboardHole, shape: PadShape = "circle"): UsedHole => {
    const existing = used.get(hole.id);
    if (existing) {
      if (shape === "square") existing.shape = shape;
      return existing;
    }
    const entry: UsedHole = { hole, at: holeAt(hole), shape };
    used.set(hole.id, entry);
    return entry;
  };

  const partLegends: { outline: readonly PcbPoint[]; label: string }[] = [];
  const marks: {
    text: string;
    pinAt: PcbPoint;
    othersAt: readonly PcbPoint[];
    ref: string;
    pinName: string;
  }[] = [];
  const parts = elements.filter(isPart);
  let placed = 0;
  for (const part of parts) {
    const pins = breadboardPins(part);
    const seated = pins.map((pin) => ({ pin, hole: findHole(pin) }));
    const loose = seated.filter((entry) => !entry.hole);
    if (loose.length === pins.length) {
      warnings.push(
        `${reference(part)} is not seated on this board and is left off the PCB.`,
      );
      continue;
    }
    if (loose.length) {
      warnings.push(
        `${reference(part)} has pin ${loose.map((entry) => entry.pin.name).join(", ")} outside the board holes and is left off the PCB.`,
      );
      continue;
    }
    placed += 1;
    for (const { pin, hole } of seated)
      if (hole) addLead(hole, `${reference(part)} pin ${pin.name}`);
    const pads = seated.map(({ pin, hole }) =>
      use(
        hole as BreadboardHole,
        pin.number === 1 &&
          (part.type === "breadboard.ic" || part.type === "breadboard.header")
          ? "square"
          : "circle",
      ),
    );

    const box = breadboardBox(part);
    if (box) {
      const pivot = boxCenter(box);
      const rotation = part.visual.rotation ?? 0;
      const corners = [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height },
        { x: box.x, y: box.y },
      ].map((corner) =>
        frame(rotation ? rotatePoint(corner, pivot, rotation) : corner),
      );
      const label = legendLabel(part);
      if ([...label].some((character) => !strokeFontSupports(character)))
        warnings.push(
          `${label} has characters the silkscreen font cannot draw; they are omitted.`,
        );
      partLegends.push({ outline: corners, label });
    }

    seated.forEach(({ pin }, index) => {
      const mark = polarityMark(part, pin);
      const pad = pads[index];
      if (!mark || !pad) return;
      marks.push({
        text: mark,
        pinAt: pad.at,
        othersAt: pads
          .filter((_, other) => other !== index)
          .map((entry) => entry.at),
        ref: reference(part),
        pinName: pin.name,
      });
    });
  }

  const connectivity = computeBreadboardConnectivity(document, pageId);
  const stripNets = new Map<string, number>();
  for (const net of connectivity.nets)
    for (const strip of net.strips)
      if (strip.boardId === board.id) stripNets.set(strip.strip, net.id);

  const wires = elements.filter(
    (element) => element.type === "breadboard.wire",
  );
  const seatedWires: {
    wire: Element;
    ends: readonly [BreadboardHole, BreadboardHole];
    points: readonly PcbPoint[];
  }[] = [];
  for (const wire of wires) {
    const points = breadboardWirePoints(wire);
    const first = points.at(0);
    const last = points.at(-1);
    if (!first || !last || points.length < 2) continue;
    const ends = [findHole(first), findHole(last)];
    const [start, end] = ends;
    if (!start || !end) {
      const seatedEnd = start ?? end;
      warnings.push(
        seatedEnd
          ? `The wire from ${seatedEnd.id} leaves this board and is left off the PCB.`
          : "A wire with no end on this board is left off the PCB.",
      );
      continue;
    }
    use(start);
    use(end);
    seatedWires.push({ wire, ends: [start, end], points: points.map(frame) });
  }

  if (placed === 0 && seatedWires.length === 0)
    return "Nothing is seated on this board, so there is no PCB to make.";

  const usedHoles = [...used.values()];
  const routed: RoutedTrace[] = [];
  const jumpers: (readonly PcbPoint[])[] = [];
  const inside = (point: PcbPoint) => {
    const margin = rules.edgeKeepout + rules.wireTrace / 2;
    return (
      point.x >= margin &&
      point.y >= margin &&
      point.x <= width - margin &&
      point.y <= height - margin
    );
  };
  for (const { wire, ends, points } of seatedWires) {
    const net = connectivity.netOfWire(wire.id);
    const sameNet = (other: number | undefined) =>
      net !== undefined && other === net;
    const clear =
      points.every(inside) &&
      segments(points).every(
        ([from, to]) =>
          usedHoles.every(
            (pad) =>
              ends.includes(pad.hole) ||
              sameNet(stripNets.get(pad.hole.strip)) ||
              distanceToSegment(pad.at, from, to) >=
                padRadius(pad.shape) + rules.wireTrace / 2 + rules.clearance,
          ) &&
          routed.every(
            (trace) =>
              sameNet(trace.net) ||
              segments(trace.points).every(
                ([otherFrom, otherTo]) =>
                  segmentDistance(from, to, otherFrom, otherTo) >=
                  rules.wireTrace + rules.clearance,
              ),
          ),
      );
    if (clear) routed.push({ net, points });
    else {
      jumpers.push(points);
      for (const hole of ends) addLead(hole, "a jumper wire end");
    }
  }
  for (const [hole, through] of leads)
    if (through.length > 1)
      warnings.push(
        `Hole ${hole} holds ${through.join(" and ")}; a PCB hole takes one lead, so move one of them to another hole in the same strip.`,
      );

  const strips = new Map<string, PcbPoint[]>();
  for (const pad of usedHoles) {
    const members = strips.get(pad.hole.strip) ?? [];
    members.push(pad.at);
    strips.set(pad.hole.strip, members);
  }
  const bottomTraces: PcbTrace[] = [];
  for (const members of strips.values()) {
    if (members.length < 2) continue;
    members.sort((left, right) => left.x - right.x || left.y - right.y);
    const first = members.at(0);
    const last = members.at(-1);
    if (first && last)
      bottomTraces.push({ width: rules.stripTrace, points: [first, last] });
  }

  const keepouts: LegendKeepout[] = usedHoles.map((pad) => ({
    x: pad.at.x,
    y: pad.at.y,
    radius:
      rules.maskOpening / 2 +
      rules.legendPadClearance +
      rules.legendLine / 2 +
      (pad.shape === "square" ? (rules.maskOpening / 2) * (Math.SQRT2 - 1) : 0),
  }));
  const legendRect: LegendRect = {
    minX: rules.legendEdgeClearance + rules.legendLine / 2,
    minY: rules.legendEdgeClearance + rules.legendLine / 2,
    maxX: width - rules.legendEdgeClearance - rules.legendLine / 2,
    maxY: height - rules.legendEdgeClearance - rules.legendLine / 2,
  };
  const legendStrokes: {
    points: readonly PcbPoint[];
    kind: "label" | "other";
    group?: number;
  }[] = [];
  const textStrokes = (text: string, at: PcbPoint) =>
    strokeText(text, at.x, at.y, rules.legendText);
  const taken: Bounds[] = [];
  for (const [group, label] of layout.labels.entries()) {
    const at = {
      x: roundMm(label.x * rules.pitch),
      y: roundMm((layout.height - label.y) * rules.pitch),
    };
    for (const points of textStrokes(label.text, at))
      legendStrokes.push({ points, kind: "label", group });
    taken.push(textBounds(label.text, at));
  }
  const edge: Bounds = {
    minX: rules.legendEdgeClearance,
    minY: rules.legendEdgeClearance,
    maxX: width - rules.legendEdgeClearance,
    maxY: height - rules.legendEdgeClearance,
  };
  for (const mark of marks) {
    const direction = markDirection(mark.pinAt, mark.othersAt);
    const diagonal = (text: string) => {
      const bounds = textBounds(text, { x: 0, y: 0 });
      const textWidth = bounds.maxX - bounds.minX;
      const textHeight = bounds.maxY - bounds.minY;
      return Math.sqrt(textWidth * textWidth + textHeight * textHeight) / 2;
    };
    const padIndex = usedHoles.findIndex(
      (pad) => pad.at.x === mark.pinAt.x && pad.at.y === mark.pinAt.y,
    );
    const pinKeepout = keepouts[padIndex];
    if (!pinKeepout) continue;
    const distance = pinKeepout.radius + diagonal(mark.text);
    const s = Math.SQRT1_2;
    const directions = [
      direction,
      {
        x: (direction.x - direction.y) * s,
        y: (direction.x + direction.y) * s,
      },
      {
        x: (direction.x + direction.y) * s,
        y: (-direction.x + direction.y) * s,
      },
      { x: -direction.y, y: direction.x },
      { x: direction.y, y: -direction.x },
    ];
    const candidate = directions
      .map((vector) => ({
        x: mark.pinAt.x + vector.x * distance,
        y: mark.pinAt.y + vector.y * distance,
      }))
      .find((at) => {
        const bounds = textBounds(mark.text, at);
        return contains(edge, bounds) && boxClearOfKeepouts(bounds, keepouts);
      });
    if (!candidate) {
      warnings.push(
        `The ${mark.text} mark at ${mark.ref} pin ${mark.pinName} has no room clear of the pads and is left off the silkscreen.`,
      );
      continue;
    }
    for (const points of textStrokes(mark.text, candidate))
      legendStrokes.push({ points, kind: "other" });
    taken.push(textBounds(mark.text, candidate));
  }
  for (const { outline: corners, label } of partLegends) {
    legendStrokes.push({ points: corners, kind: "other" });
    const box = boundsOf(corners);
    const half = rules.legendText / 2;
    const gap = 0.3;
    const textWidth = strokeTextWidth(label, rules.legendText);
    const centreX = (box.minX + box.maxX) / 2;
    const centreY = (box.minY + box.maxY) / 2;
    const candidates = [
      { x: centreX, y: box.maxY + gap + half },
      { x: centreX, y: box.minY - gap - half },
      { x: box.maxX + gap + textWidth / 2, y: centreY },
      { x: box.minX - gap - textWidth / 2, y: centreY },
    ];
    const free = candidates.find((candidate) => {
      const bounds = textBounds(label, candidate);
      return (
        contains(edge, bounds) &&
        taken.every((other) => !overlaps(other, bounds)) &&
        boxClearOfKeepouts(bounds, keepouts)
      );
    });
    const at = free ?? candidates[0] ?? { x: centreX, y: centreY };
    for (const points of textStrokes(label, at))
      legendStrokes.push({ points, kind: "other" });
    taken.push(textBounds(label, at));
  }
  for (const points of jumpers) legendStrokes.push({ points, kind: "other" });

  const clippedStrokes = legendStrokes.flatMap((stroke) =>
    clipLegendStroke(stroke.points, legendRect, keepouts, rules.legendLine).map(
      (points) => ({ ...stroke, points }),
    ),
  );

  const full: PcbDesign = {
    width,
    height,
    rules: {
      pad: rules.pad,
      maskOpening: rules.maskOpening,
      drill: rules.drill,
      legendLine: rules.legendLine,
      edgeLine: rules.edgeLine,
    },
    pads: usedHoles.map(({ at, shape }) => ({ at, shape })),
    topTraces: routed.map((trace) => ({
      width: rules.wireTrace,
      points: trace.points,
    })),
    bottomTraces,
    // Board labels are grouped so a trimmed outline drops a label whole.
    legend: clippedStrokes.map((stroke) =>
      stroke.kind === "label" && stroke.group !== undefined
        ? { points: stroke.points, group: stroke.group }
        : { points: stroke.points },
    ),
  };
  const design =
    options.outline === "used"
      ? trimPcbToUsed(full, {
          margin: rules.usedMargin,
          legendEdgeClearance: rules.legendEdgeClearance,
        })
      : full;
  const files = pcbFabricationFiles(design, {
    name: fileBaseName(options.name),
    generator: GENERATOR,
    drillTitle: "Nodetto breadboard PCB",
  });

  const notes = [
    `Board ${design.width} x ${design.height} mm, ${PCB_LAYER_COUNT} layers, ${design.pads.length} plated holes of ${rules.drill} mm, ${placed} part(s).`,
  ];
  if (seatedWires.length)
    notes.push(
      jumpers.length
        ? `${routed.length} of ${seatedWires.length} wire(s) are top-layer traces; solder the other ${jumpers.length} as jumper wires along their silkscreen lines.`
        : `All ${seatedWires.length} wire(s) are top-layer traces.`,
    );
  return {
    boardId: board.id,
    width: design.width,
    height: design.height,
    files,
    warnings,
    notes,
  };
}

/** The Gerber and drill files as one ZIP, the upload format board houses take. */
export function encodeBreadboardPcbZip(pcb: BreadboardPcb): Uint8Array {
  const encoder = new TextEncoder();
  return encodeStoredZip(
    pcb.files.map((file) => ({
      path: file.path,
      contents: encoder.encode(file.text),
    })),
    "PCB archive",
  );
}
