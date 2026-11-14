// Pure box and element geometry for the interaction controller: resize
// handles and the box arithmetic behind them, and where on an element a
// double-click landed.

import type { Box, ResizeEdges, Vec } from "@nodetto/core";
import {
  ERD_TABLE_HEADER_HEIGHT,
  ERD_TABLE_ROW_HEIGHT,
  UML_CLASS_ROW_HEIGHT,
  erdColumnCount,
  isGroup,
  normalizeBox,
  rotatePoint,
  umlNameHeight,
} from "@nodetto/core";
import {
  UmlComponentType,
  getElementTypeDefinition,
  isDatabaseObjectType,
  type Element,
} from "@nodetto/ir";

export const RESIZE_HANDLES = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
] as const;

export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

/** Derived-height engineering boxes expose only their authored width axis. */
export function resizeHandlesFor(type: string): readonly ResizeHandle[] {
  return type === "erd.table" ||
    type === "uml.class" ||
    isDatabaseObjectType(type)
    ? (["e", "w"] as const)
    : RESIZE_HANDLES;
}

/** Nothing may be resized below this, in page units. */
export const MIN_SHAPE_SIZE = 8;

/**
 * Where on an element a double-click landed: the title band of a table or
 * class, one of its rows (counted across ERD columns, or UML attributes
 * then methods), or anywhere else.
 */
export type EditRegion = "body" | "title" | { readonly row: number };

export interface ResizeModifiers {
  /** Shift: keep the start box's aspect ratio. */
  readonly keepAspect?: boolean;
  /** Persisted ratio overrides a start box awaiting reconciliation. */
  readonly aspectRatio?: number;
  /** Alt/Option: grow both sides, keeping the centre where it was. */
  readonly fromCenter?: boolean;
}

/** True when two boxes overlap at all (touching edges count). */
export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  );
}

export function clampBox(box: Box): Box {
  return {
    x: box.x,
    y: box.y,
    width: Math.max(MIN_SHAPE_SIZE, box.width),
    height: Math.max(MIN_SHAPE_SIZE, box.height),
  };
}

/** Grow the edges the handle owns, then normalize and enforce a minimum. */
export function resizeBox(
  start: Box,
  handle: ResizeHandle,
  dx: number,
  dy: number,
): Box {
  const left = handle.includes("w") ? start.x + dx : start.x;
  const right = handle.includes("e")
    ? start.x + start.width + dx
    : start.x + start.width;
  const top = handle.includes("n") ? start.y + dy : start.y;
  const bottom = handle.includes("s")
    ? start.y + start.height + dy
    : start.y + start.height;
  return clampBox(normalizeBox({ x: left, y: top }, { x: right, y: bottom }));
}

/**
 * `resizeBox` with the shift and alt modifiers applied: the aspect ratio is
 * held against the start box, and a centred resize mirrors every owned
 * edge onto its opposite. Both are applied before snapping.
 */
export function resizeBoxConstrained(
  start: Box,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  modifiers: ResizeModifiers = {},
): Box {
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");
  const mirror = modifiers.fromCenter === true;

  let left = start.x;
  let right = start.x + start.width;
  let top = start.y;
  let bottom = start.y + start.height;
  if (west) {
    left += dx;
    if (mirror) {
      right -= dx;
    }
  }
  if (east) {
    right += dx;
    if (mirror) {
      left -= dx;
    }
  }
  if (north) {
    top += dy;
    if (mirror) {
      bottom -= dy;
    }
  }
  if (south) {
    bottom += dy;
    if (mirror) {
      top -= dy;
    }
  }

  const raw = normalizeBox({ x: left, y: top }, { x: right, y: bottom });
  let width = raw.width;
  let height = raw.height;
  if (modifiers.keepAspect === true && start.width > 0 && start.height > 0) {
    const aspect = modifiers.aspectRatio ?? start.width / start.height;
    const horizontal = west || east;
    const vertical = north || south;
    if (horizontal && vertical) {
      // A corner follows whichever axis the pointer pushed further.
      if (width / aspect >= height) {
        height = width / aspect;
      } else {
        width = height * aspect;
      }
    } else if (horizontal) {
      height = width / aspect;
    } else {
      width = height * aspect;
    }
  }

  const centerX = start.x + start.width / 2;
  const centerY = start.y + start.height / 2;
  // Where the box is pinned: the centre, or the edge opposite the handle.
  // An edge handle (n, s, e, w) keeps the other axis centred.
  const x = mirror
    ? centerX - width / 2
    : west
      ? start.x + start.width - width
      : east
        ? start.x
        : centerX - width / 2;
  const y = mirror
    ? centerY - height / 2
    : north
      ? start.y + start.height - height
      : south
        ? start.y
        : centerY - height / 2;

  if (modifiers.keepAspect !== true) {
    // Without the aspect constraint the raw box already sits where the
    // pointer put it, including past the opposite edge; a mirrored resize
    // is symmetric about the centre by construction.
    return clampBox(raw);
  }
  return clampBox({ x, y, width, height });
}

/** Resize in local axes, then rotate the changed center back into page space. */
export function resizeRotatedBox(
  start: Box,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  rotation: number,
  modifiers: ResizeModifiers = {},
): Box {
  const angle = ((rotation % 360) * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const local = resizeBoxConstrained(
    start,
    handle,
    dx * cosine + dy * sine,
    -dx * sine + dy * cosine,
    modifiers,
  );
  const center = boxCentre(start);
  const next = boxCentre(local);
  const cx = next.x - center.x;
  const cy = next.y - center.y;
  return {
    ...local,
    x: center.x + cx * cosine - cy * sine - local.width / 2,
    y: center.y + cx * sine + cy * cosine - local.height / 2,
  };
}

/** The edges a resize handle moves, in snapping's vocabulary. */
export function handleEdges(handle: ResizeHandle): ResizeEdges {
  return {
    left: handle.includes("w"),
    right: handle.includes("e"),
    top: handle.includes("n"),
    bottom: handle.includes("s"),
  };
}

function listLength(semantic: unknown, field: string): number {
  if (typeof semantic !== "object" || semantic === null) {
    return 0;
  }
  const value = (semantic as Record<string, unknown>)[field];
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Which part of `element` a point inside `box` falls on (design 3.3). Row
 * indices are clamped to rows that exist; the blank row an empty table or
 * compartment reserves counts as body.
 */
export function editRegionAt(
  element: Element,
  box: Box,
  point: Vec,
): EditRegion {
  const local =
    element.visual.rotation && !isConnector(element) && !isGroup(element)
      ? rotatePoint(point, boxCentre(box), -element.visual.rotation)
      : point;
  const dy = local.y - box.y;
  if (element.type === "erd.table") {
    if (dy < ERD_TABLE_HEADER_HEIGHT) {
      return "title";
    }
    const count = erdColumnCount(element.semantic);
    if (count === 0) {
      return "body";
    }
    const row = Math.floor(
      (dy - ERD_TABLE_HEADER_HEIGHT) / ERD_TABLE_ROW_HEIGHT,
    );
    return { row: Math.max(0, Math.min(count - 1, row)) };
  }
  if (element.type === "uml.class") {
    const nameHeight = umlNameHeight(element.semantic);
    if (dy < nameHeight) {
      return "title";
    }
    const attributes = listLength(element.semantic, "attributes");
    const methods = listLength(element.semantic, "methods");
    const row = Math.max(
      0,
      Math.floor((dy - nameHeight) / UML_CLASS_ROW_HEIGHT),
    );
    const attributeRows = Math.max(1, attributes);
    if (row < attributeRows) {
      return attributes === 0 ? "body" : { row: Math.min(row, attributes - 1) };
    }
    if (methods === 0) {
      return "body";
    }
    return { row: attributes + Math.min(row - attributeRows, methods - 1) };
  }
  return "body";
}

export function isConnector(element: Element): boolean {
  return getElementTypeDefinition(element.type)?.category === "edge";
}

export const MANUAL_ROUTE_TYPES: ReadonlySet<string> = new Set([
  "edge.generic",
  "erd.relation",
  "uml.association",
  "state.transition",
  "usecase.relationship",
  UmlComponentType.Relationship,
]);

/** Connectors a drag may end on the element it started from. */
export function selfConnects(connectorType: string | undefined): boolean {
  return (
    connectorType === "state.transition" || connectorType === "erd.relation"
  );
}

/** Something a connector may end on and a drag may snap to. */
export function isSolid(element: Element): boolean {
  return !isConnector(element) && !isGroup(element);
}

export function boxCentre(box: Box): Vec {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
