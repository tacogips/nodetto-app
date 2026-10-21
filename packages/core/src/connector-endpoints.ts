import {
  getElementTypeDefinition,
  type ConnectorPort,
  type ElementId,
} from "@nodetto/ir";
import type { Editor } from "./editor.ts";
import { boxCenter, type Vec } from "./geometry.ts";
import {
  connectorWaypointFromPage,
  endpointReaderFor,
  resolveConnector,
} from "./shapes/connector.ts";

export type GenericConnectorEndpoint =
  | { readonly shape: ElementId; readonly port?: ConnectorPort }
  | { readonly point: Vec };

/** Reattach or detach a plain line without moving its authored intermediate points. */
export function setGenericConnectorEndpoint(
  editor: Editor,
  id: ElementId,
  end: "from" | "to",
  endpoint: GenericConnectorEndpoint,
): boolean {
  const edge = editor.store.get(id);
  const context = editor.createShapeContext();
  if (
    !edge ||
    edge.type !== "edge.generic" ||
    editor.readOnly ||
    context.isLocked?.(id)
  )
    return false;
  const semantic = edge.semantic as Record<string, unknown>;
  if (semantic["prototype"] === true) return false;
  let center: Vec;
  if ("shape" in endpoint) {
    const target = editor.store.get(endpoint.shape);
    const box = context.boundsOf(endpoint.shape);
    if (
      !target ||
      !box ||
      target.type === "group" ||
      getElementTypeDefinition(target.type)?.category === "edge" ||
      target.page !== edge.page ||
      context.isHidden?.(target.id) ||
      context.isLocked?.(target.id)
    )
      return false;
    if (
      semantic[end] === endpoint.shape &&
      semantic[`${end}Port`] === endpoint.port &&
      semantic[`${end}Point`] === undefined
    )
      return false;
    center = boxCenter(box);
  } else {
    if (
      !Number.isFinite(endpoint.point.x) ||
      !Number.isFinite(endpoint.point.y)
    )
      return false;
    const old = semantic[`${end}Point`] as Vec | undefined;
    if (old?.x === endpoint.point.x && old.y === endpoint.point.y) return false;
    center = endpoint.point;
  }
  const resolved = resolveConnector(
    edge,
    context,
    endpointReaderFor(edge.type),
  );
  if (!resolved) return false;
  const next = { ...semantic };
  delete next[end];
  delete next[`${end}Port`];
  delete next[`${end}Point`];
  if ("shape" in endpoint) {
    next[end] = endpoint.shape;
    if (endpoint.port) next[`${end}Port`] = endpoint.port;
  } else next[`${end}Point`] = { ...endpoint.point };
  if (resolved.waypointPoints && semantic["routing"] === "manual") {
    const from = end === "from" ? center : boxCenter(resolved.fromBox);
    const to = end === "to" ? center : boxCenter(resolved.toBox);
    next["routingWaypoints"] = resolved.waypointPoints.map((point) =>
      connectorWaypointFromPage(point, from, to),
    );
  }
  editor.apply([{ type: "updateSemantic", id, semantic: next }]);
  return true;
}
