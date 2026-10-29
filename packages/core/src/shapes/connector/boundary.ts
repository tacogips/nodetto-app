// Where a connector meets an element: outline intersections, rotation,
// pinned ports and ERD row anchors.

import {
  CONNECTOR_PORTS,
  type ConnectorPort,
  type Element,
  erdEndpointColumnIds,
  type ErdEndpoint,
  type ErdTableSemantic,
  type FreehandSemantic,
  type GeoShapeSemantic,
  getElementTypeDefinition,
  UmlComponentType,
} from "@nodetto/ir";
import {
  type Box,
  boxCenter,
  ellipseBoundaryIntersection,
  rectBoundaryIntersection,
  rotatePoint,
  type Vec,
} from "../../geometry.ts";
import type { ShapeContext } from "../../shape-util.ts";
import { flattenStroke } from "../../stroke-path.ts";
import { ERD_TABLE_HEADER_HEIGHT, ERD_TABLE_ROW_HEIGHT } from "../erdTable.ts";
import { freehandGeometry } from "../freehand.ts";
import { elementOutlinePolygon } from "../outline.ts";
import { type ConnectorEndpoints, withRoute } from "./route.ts";

/**
 * Where the line between two boxes meets each box's border. Self-connections
 * are not modelled in phase 0, so identical boxes simply collapse to their
 * shared centre.
 */
export function connectorEndpoints(
  fromBox: Box,
  toBox: Box,
  fromRotation = 0,
  toRotation = 0,
): ConnectorEndpoints {
  const fromCenter = boxCenter(fromBox);
  const toCenter = boxCenter(toBox);
  const start = rotatedBoundary(fromBox, toCenter, fromRotation);
  const end = rotatedBoundary(toBox, fromCenter, toRotation);
  return withRoute(start, end, fromBox, toBox);
}

function rotatedBoundary(box: Box, target: Vec, rotation: number): Vec {
  const center = boxCenter(box);
  const localTarget = rotatePoint(target, center, -rotation);
  return rotatePoint(
    rectBoundaryIntersection(center, localTarget, box),
    center,
    rotation,
  );
}

function cross(a: Vec, b: Vec): number {
  return a.x * b.y - a.y * b.x;
}

/** Last outline crossing from `origin` towards `target`. */
function outlineBoundary(
  origin: Vec,
  target: Vec,
  points: readonly Vec[],
  closed = true,
): Vec | null {
  const direction = { x: target.x - origin.x, y: target.y - origin.y };
  if (
    (direction.x === 0 && direction.y === 0) ||
    points.length < (closed ? 3 : 2)
  )
    return null;
  const limit = closed ? points.length : points.length - 1;
  let best = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < limit; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (!a || !b) continue;
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) <= 1e-9) continue;
    const offset = { x: a.x - origin.x, y: a.y - origin.y };
    const t = cross(offset, edge) / denominator;
    const u = cross(offset, direction) / denominator;
    if (t >= -1e-9 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.max(best, t);
  }
  return Number.isFinite(best)
    ? {
        x: origin.x + direction.x * best,
        y: origin.y + direction.y * best,
      }
    : null;
}

/** Endpoint boundary in the element's unrotated page coordinate system. */
function elementBoundary(
  element: Element,
  box: Box,
  origin: Vec,
  target: Vec,
  context: ShapeContext,
): Vec {
  if (element.type === "state.node") {
    const kind = (element.semantic as { kind: string }).kind;
    if (kind === "initial" || kind === "final")
      return ellipseBoundaryIntersection(origin, target, box);
    if (kind === "choice") {
      return (
        outlineBoundary(origin, target, [
          { x: box.x + box.width / 2, y: box.y },
          { x: box.x + box.width, y: box.y + box.height / 2 },
          { x: box.x + box.width / 2, y: box.y + box.height },
          { x: box.x, y: box.y + box.height / 2 },
        ]) ?? origin
      );
    }
  }
  if (
    element.type === "usecase.node" &&
    (element.semantic as { kind?: string }).kind === "usecase"
  )
    return ellipseBoundaryIntersection(origin, target, {
      x: box.x + 1,
      y: box.y + 1,
      width: Math.max(0, box.width - 2),
      height: Math.max(0, box.height - 2),
    });
  if (element.type === UmlComponentType.Interface) {
    return ellipseBoundaryIntersection(origin, target, {
      x: box.x + 2,
      y: box.y + 2,
      width: Math.max(1, box.width - 4),
      height: Math.max(1, box.height - 4),
    });
  }
  if (element.type === "shape.geo") {
    const kind = (element.semantic as GeoShapeSemantic).geo;
    if (kind === "ellipse") {
      const inset = {
        x: box.x + 1,
        y: box.y + 1,
        width: Math.max(0, box.width - 2),
        height: Math.max(0, box.height - 2),
      };
      return ellipseBoundaryIntersection(origin, target, inset);
    }
  }
  if (element.type === "draw.freehand") {
    const geometry = freehandGeometry(element);
    if (geometry) {
      const closed = (element.semantic as FreehandSemantic).closed === true;
      const points = flattenStroke(geometry.points, closed, 0.5).map(
        (point) => ({
          x: geometry.box.x + point.x,
          y: geometry.box.y + point.y,
        }),
      );
      const boundary = outlineBoundary(origin, target, points, closed);
      if (boundary) return boundary;
    }
  }
  const polygon = elementOutlinePolygon(element, context);
  if (polygon) {
    const boundary = outlineBoundary(origin, target, polygon);
    if (boundary) return boundary;
  }
  if (element.type === "erd.table") {
    const horizontal =
      Math.abs(target.x - origin.x) >= Math.abs(target.y - origin.y);
    return horizontal
      ? {
          x: target.x >= origin.x ? box.x + box.width : box.x,
          y: Math.max(box.y, Math.min(box.y + box.height, origin.y)),
        }
      : {
          x: Math.max(box.x, Math.min(box.x + box.width, origin.x)),
          y: target.y >= origin.y ? box.y + box.height : box.y,
        };
  }
  return rectBoundaryIntersection(origin, target, box);
}

export function resolvedBoundary(
  element: Element,
  box: Box,
  target: Vec,
  context: ShapeContext,
  origin: Vec = boxCenter(box),
): Vec {
  const rotation = endpointRotation(element);
  if (!rotation) return elementBoundary(element, box, origin, target, context);
  const center = boxCenter(box);
  const localOrigin = rotatePoint(origin, center, -rotation);
  const localTarget = rotatePoint(target, center, -rotation);
  return rotatePoint(
    elementBoundary(element, box, localOrigin, localTarget, context),
    center,
    rotation,
  );
}

/** Stable, local-side attachment points on the actual rendered outline. */
export function connectionPorts(
  element: Element,
  context: ShapeContext,
): readonly { id: ConnectorPort; point: Vec }[] {
  const box = context.boundsOf(element.id);
  if (
    !box ||
    getElementTypeDefinition(element.type)?.category === "edge" ||
    element.type === "group" ||
    element.type === "sequence.participant"
  )
    return [];
  const center = boxCenter(box);
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  return CONNECTOR_PORTS.map((id, index) => {
    const direction = directions[index] as Vec;
    const target = rotatePoint(
      {
        x: center.x + direction.x * (box.width + 1),
        y: center.y + direction.y * (box.height + 1),
      },
      center,
      endpointRotation(element),
    );
    return { id, point: resolvedBoundary(element, box, target, context) };
  });
}

export function pinnedPort(
  element: Element,
  context: ShapeContext,
  port: unknown,
): Vec | undefined {
  if (!CONNECTOR_PORTS.includes(port as ConnectorPort)) return undefined;
  return connectionPorts(element, context).find(
    (candidate) => candidate.id === port,
  )?.point;
}

function erdTableRowAnchor(
  element: Element,
  box: Box,
  endpoint: ErdEndpoint,
): Vec {
  if (element.type !== "erd.table") return boxCenter(box);
  const semantic = element.semantic as ErdTableSemantic;
  const indexes = erdEndpointColumnIds(endpoint).flatMap((columnId) => {
    const index = semantic.columns.findIndex(
      (column) => column.id === columnId,
    );
    return index < 0 ? [] : [index];
  });
  if (!indexes.length) return boxCenter(box);
  const y =
    box.y +
    ERD_TABLE_HEADER_HEIGHT +
    (indexes.reduce((sum, index) => sum + index, 0) / indexes.length + 0.5) *
      ERD_TABLE_ROW_HEIGHT;
  return rotatePoint(
    { x: box.x + box.width / 2, y },
    boxCenter(box),
    element.visual.rotation ?? 0,
  );
}

export function erdRelationAnchors(
  element: Element,
  from: Element,
  to: Element,
  fromBox: Box,
  toBox: Box,
): readonly [Vec, Vec] | null {
  if (element.type !== "erd.relation") return null;
  if (typeof element.semantic !== "object" || element.semantic === null)
    return null;
  const semantic = element.semantic as Record<string, unknown>;
  const fromEndpoint = semantic["from"];
  const toEndpoint = semantic["to"];
  if (
    typeof fromEndpoint !== "object" ||
    fromEndpoint === null ||
    typeof toEndpoint !== "object" ||
    toEndpoint === null
  )
    return null;
  return [
    erdTableRowAnchor(from, fromBox, fromEndpoint as ErdEndpoint),
    erdTableRowAnchor(to, toBox, toEndpoint as ErdEndpoint),
  ];
}

export function endpointRotation(element: Element | undefined): number {
  return !element ||
    element.type === "group" ||
    getElementTypeDefinition(element.type)?.category === "edge"
    ? 0
    : (element.visual.rotation ?? 0);
}
