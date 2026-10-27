// The connector ShapeUtil factory and the endpoint spellings it reads.

import { distanceToSegment, unionBoxes, type Vec } from "../../geometry.ts";
import type { ShapeUtil } from "../../shape-util.ts";
import { resolveConnector } from "./resolve.ts";
import type { EndpointReader } from "./route.ts";

/** Screen-space pick tolerance for a connector, in CSS pixels. */
export const CONNECTOR_HIT_TOLERANCE = 8;

/**
 * A ShapeUtil for an element type whose geometry is entirely derived from
 * two referenced elements. `edge.generic`, `erd.relation` and
 * `uml.association` differ only in how the two ids are spelled.
 */
export function createConnectorUtil(options: {
  readonly type: string;
  readonly readEndpoints: EndpointReader;
  readonly defaultSemantic: () => unknown;
}): ShapeUtil {
  return {
    type: options.type,
    canResize: false,
    getBounds(element, context) {
      const resolved = resolveConnector(
        element,
        context,
        options.readEndpoints,
      );
      if (!resolved) {
        return null;
      }
      return unionBoxes(
        resolved.points.map((point) => ({
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
        })),
      );
    },
    hitTest(element, point, context) {
      const resolved = resolveConnector(
        element,
        context,
        options.readEndpoints,
      );
      if (!resolved) {
        return false;
      }
      const tolerance = CONNECTOR_HIT_TOLERANCE / Math.max(context.zoom, 1e-6);
      return resolved.points
        .slice(1)
        .some(
          (to, index) =>
            distanceToSegment(point, resolved.points[index] as Vec, to) <=
            tolerance,
        );
    },
    defaultSemantic: options.defaultSemantic,
    defaultVisual() {
      return {};
    },
  };
}

/** Reads `{ from, to }` where both are plain element ids. */
export const readDirectEndpoints: EndpointReader = (semantic) => {
  if (typeof semantic !== "object" || semantic === null) {
    return null;
  }
  const record = semantic as Record<string, unknown>;
  const from = record["from"];
  const to = record["to"];
  if (
    (typeof from !== "string" && !record["fromPoint"]) ||
    (typeof to !== "string" && !record["toPoint"])
  )
    return null;
  return {
    from: typeof from === "string" ? from : "",
    to: typeof to === "string" ? to : "",
  };
};

/** Reads `{ from: { table }, to: { table } }` as used by `erd.relation`. */
export const readTableEndpoints: EndpointReader = (semantic) => {
  if (typeof semantic !== "object" || semantic === null) {
    return null;
  }
  const record = semantic as Record<string, unknown>;
  const from = record["from"];
  const to = record["to"];
  const fromTable =
    typeof from === "object" && from !== null
      ? (from as Record<string, unknown>)["table"]
      : undefined;
  const toTable =
    typeof to === "object" && to !== null
      ? (to as Record<string, unknown>)["table"]
      : undefined;
  if (typeof fromTable !== "string" || typeof toTable !== "string") {
    return null;
  }
  return { from: fromTable, to: toTable };
};

/** Which endpoint spelling an element type uses. */
export function endpointReaderFor(type: string): EndpointReader {
  return type === "erd.relation" ? readTableEndpoints : readDirectEndpoints;
}
