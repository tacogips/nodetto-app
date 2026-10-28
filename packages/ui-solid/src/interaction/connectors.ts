// Connector gestures: drawing a new connector out of an element, dragging
// an existing end to another element, and editing a connector's route
// (the orthogonal bend and manual waypoints).

import type { Vec } from "@nodetto/core";
import {
  boxCenter,
  connectScreenTransition,
  connectionPorts,
  connectorWaypointFromPage,
  connectorWaypointsWithInsertion,
  endpointReaderFor,
  isUmlComponentEndpoint,
  resolveConnector,
  screenFrame,
  setGenericConnectorEndpoint,
} from "@nodetto/core";
import {
  CONNECTOR_ENDPOINT_TYPES,
  type ConnectorPort,
  type Element,
  type ElementId,
  UmlComponentType,
  connectorEndpointIssues,
} from "@nodetto/ir";
import {
  removeConnectorWaypoint,
  straightenConnectors,
} from "../connector-routing.ts";
import { Tool, componentRelationshipFor, typedConnectorFor } from "../tools.ts";
import type { InteractionContext } from "./context.ts";
import { MANUAL_ROUTE_TYPES, boxCentre, selfConnects } from "./geometry.ts";
import type { HitTesting } from "./hit-testing.ts";
import type { GestureLifecycle } from "./lifecycle.ts";
import type { ConnectorEnd, GestureOf } from "./types.ts";

export interface ConnectorGestures {
  beginConnect(from: ElementId, point: Vec, port?: ConnectorPort): void;
  moveRoutingBend(
    gesture: GestureOf<"routing-bend">,
    event: PointerEvent,
  ): void;
  moveRoutingWaypoint(
    gesture: GestureOf<"routing-waypoint">,
    event: PointerEvent,
  ): void;
  moveConnecting(gesture: GestureOf<"connecting">, event: PointerEvent): void;
  moveReconnecting(
    gesture: GestureOf<"reconnecting">,
    event: PointerEvent,
  ): void;
  /** Create the connector a `connecting` drag released over. */
  finishConnecting(gesture: GestureOf<"connecting">, event: PointerEvent): void;
  /** Re-point the dragged end of a `reconnecting` drag. */
  finishReconnecting(
    gesture: GestureOf<"reconnecting">,
    event: PointerEvent,
  ): void;
  /**
   * Double-click on a waypoint or bend handle of the one selected
   * connector: remove the waypoint, or straighten the bend. True when the
   * click was consumed.
   */
  editSelectedRouteHandle(event: MouseEvent, point: Vec): boolean;
  /** Double-click on a manually routable connector inserts a waypoint. */
  insertRouteWaypoint(
    event: MouseEvent,
    hit: ElementId,
    element: Element,
    point: Vec,
  ): void;
  startRouteBend(id: ElementId, event: PointerEvent): void;
  startRouteWaypoint(id: ElementId, index: number, event: PointerEvent): void;
  startReconnect(id: ElementId, end: ConnectorEnd, event: PointerEvent): void;
  startConnect(
    from: ElementId,
    event: PointerEvent,
    port?: ConnectorPort,
  ): void;
}

export function createConnectorGestures(
  ctx: InteractionContext,
  hits: HitTesting,
  lifecycle: GestureLifecycle,
): ConnectorGestures {
  const { editor, options, state } = ctx;
  const { nearestPort, targetUnder, acceptsEndpoint } = hits;
  const { owns, claim, flushNudge } = lifecycle;

  const beginConnect = (
    from: ElementId,
    point: Vec,
    port?: ConnectorPort,
  ): void => {
    const connectorType = typedConnectorFor(options.tool());
    const screenTransition = options.tool() === Tool.ScreenTransition;
    if (screenTransition && !screenFrame(editor, from)) return;
    if (
      connectorType &&
      !CONNECTOR_ENDPOINT_TYPES[connectorType]?.includes(
        editor.store.get(from)?.type ?? "",
      )
    )
      return;
    state.gesture = {
      kind: "connecting",
      startPage: point,
      fromPort: port ?? nearestPort(from, point)?.id,
      from,
      componentKind: componentRelationshipFor(options.tool()),
      screenTransition,
      connectorType,
      logicalRelation: options.tool() === Tool.Relation,
    };
    const bounds = editor.getBounds(from);
    const element = editor.store.get(from);
    const start = element
      ? connectionPorts(element, editor.createShapeContext()).find(
          (candidate) =>
            candidate.id === (port ?? nearestPort(from, point)?.id),
        )?.point
      : undefined;
    ctx.setPending({
      from: start ?? (bounds ? boxCentre(bounds) : point),
      to: point,
    });
  };

  const moveRoutingBend = (
    gesture: GestureOf<"routing-bend">,
    event: PointerEvent,
  ): void => {
    const element = editor.store.get(gesture.id);
    if (!element) return;
    const span = gesture.to - gesture.from;
    if (Math.abs(span) < 1e-9) return;
    const point = ctx.pagePoint(event);
    const bend = Math.max(
      0,
      Math.min(1, (point[gesture.axis] - gesture.from) / span),
    );
    const semantic =
      typeof element.semantic === "object" && element.semantic !== null
        ? (element.semantic as Record<string, unknown>)
        : {};
    if (semantic["routingBend"] === bend) return;
    editor.apply([
      {
        type: "updateSemantic",
        id: gesture.id,
        semantic: { ...semantic, routingBend: bend },
      },
    ]);
  };

  const moveRoutingWaypoint = (
    gesture: GestureOf<"routing-waypoint">,
    event: PointerEvent,
  ): void => {
    const element = editor.store.get(gesture.id);
    if (!element) return;
    const semantic =
      typeof element.semantic === "object" && element.semantic !== null
        ? (element.semantic as Record<string, unknown>)
        : {};
    const waypoints = semantic["routingWaypoints"];
    if (!Array.isArray(waypoints) || !waypoints[gesture.index]) return;
    const next = connectorWaypointFromPage(
      ctx.pagePoint(event),
      gesture.fromCenter,
      gesture.toCenter,
    );
    const waypointIndex = gesture.index;
    editor.apply([
      {
        type: "updateSemantic",
        id: gesture.id,
        semantic: {
          ...semantic,
          routingWaypoints: waypoints.map((waypoint, index) =>
            index === waypointIndex ? next : waypoint,
          ),
        },
      },
    ]);
  };

  const moveConnecting = (
    gesture: GestureOf<"connecting">,
    event: PointerEvent,
  ): void => {
    const from = editor.getBounds(gesture.from);
    const point = ctx.pagePoint(event);
    const target = targetUnder(
      point,
      selfConnects(gesture.connectorType) ? [] : [gesture.from],
    );
    const source = editor.store.get(gesture.from);
    const fromPort = gesture.fromPort;
    const start = source
      ? connectionPorts(source, editor.createShapeContext()).find(
          (port) => port.id === fromPort,
        )?.point
      : undefined;
    ctx.setPending({
      from: start ?? gesture.fromPoint ?? (from ? boxCentre(from) : point),
      to: target ? (nearestPort(target, point)?.point ?? point) : point,
    });
    ctx.setHoverTarget(
      target &&
        acceptsEndpoint(gesture.connectorType, target) &&
        (!gesture.screenTransition || Boolean(screenFrame(editor, target)))
        ? target
        : null,
    );
  };

  const moveReconnecting = (
    gesture: GestureOf<"reconnecting">,
    event: PointerEvent,
  ): void => {
    const point = ctx.pagePoint(event);
    const target = targetUnder(point, [gesture.id, gesture.other]);
    ctx.setPending({
      from: gesture.anchor,
      to: target ? (nearestPort(target, point)?.point ?? point) : point,
    });
    ctx.setHoverTarget(
      target && acceptsEndpoint(editor.store.get(gesture.id)?.type, target)
        ? target
        : null,
    );
  };

  /**
   * Point the dragged end of a connector at `target`: one `updateSemantic`
   * carrying the whole payload with that end rewritten. Nothing is written
   * when the end already points there.
   */
  const reconnect = (
    id: ElementId,
    end: ConnectorEnd,
    target: ElementId,
    port?: ConnectorPort,
  ): void => {
    let endpoint = target;
    const element = editor.store.get(id);
    if (!element) {
      return;
    }
    if (
      element.type === UmlComponentType.Relationship &&
      !isUmlComponentEndpoint(editor.store.get(target)?.type ?? "")
    )
      return;
    if (
      element.type === "edge.generic" &&
      !(element.semantic as { prototype?: boolean }).prototype
    ) {
      setGenericConnectorEndpoint(editor, id, end, {
        shape: target,
        ...(port ? { port } : {}),
      });
      return;
    }
    if (element.type.startsWith("bpmn.")) {
      editor.reconnectBpmnFlow(id, end, target, {}, port);
      return;
    }
    if (
      element.type === "edge.generic" &&
      (element.semantic as { prototype?: boolean }).prototype &&
      end === "to"
    ) {
      const frame = screenFrame(editor, target);
      if (!frame) return;
      endpoint = frame;
    }
    const current = endpointReaderFor(element.type)(element.semantic);
    const portKey = end === "from" ? "fromPort" : "toPort";
    if (
      current &&
      current[end] === endpoint &&
      (element.semantic as Record<string, unknown>)[portKey] === port
    ) {
      return;
    }
    const base: Record<string, unknown> =
      typeof element.semantic === "object" && element.semantic !== null
        ? { ...(element.semantic as Record<string, unknown>) }
        : {};
    // An ERD relation names a table (and optionally a column); the column
    // belonged to the old table, so the new endpoint carries none.
    if (current?.[end] !== endpoint)
      base[end] =
        element.type === "erd.relation" ? { table: endpoint } : endpoint;
    delete base[portKey];
    if (port && endpoint === target) base[portKey] = port;
    if (
      connectorEndpointIssues(element.type, base, element.page, (id) =>
        editor.store.get(id),
      ).length
    )
      return;
    editor.apply([{ type: "updateSemantic", id, semantic: base }]);
  };

  const finishConnecting = (
    gesture: GestureOf<"connecting">,
    event: PointerEvent,
  ): void => {
    const point = ctx.pagePoint(event);
    const dropped = targetUnder(
      point,
      selfConnects(gesture.connectorType) ? [] : [gesture.from],
    );
    // A click on a table with the relation tool is not a self-reference;
    // ending on the source needs a drag.
    const target =
      dropped === gesture.from &&
      gesture.connectorType === "erd.relation" &&
      Math.hypot(point.x - gesture.startPage.x, point.y - gesture.startPage.y) *
        editor.camera.get().z <
        4
        ? null
        : dropped;
    const sourceType = editor.store.get(gesture.from)?.type ?? "";
    const canDrawFree =
      options.tool() === Tool.Connector ||
      gesture.fromPoint ||
      !["erd.", "uml.", "state.", "sequence.", "bpmn."].some((prefix) =>
        sourceType.startsWith(prefix),
      );
    const sourceUnder =
      !target && !gesture.fromPoint && targetUnder(point, []) === gesture.from;
    const freeLine =
      canDrawFree &&
      !sourceUnder &&
      (gesture.fromPoint || !target) &&
      !gesture.screenTransition &&
      !gesture.componentKind &&
      (!gesture.connectorType || gesture.connectorType === "edge.generic");
    if (
      freeLine &&
      Math.hypot(point.x - gesture.startPage.x, point.y - gesture.startPage.y) *
        editor.camera.get().z >=
        4
    ) {
      const toPort = target ? nearestPort(target, point)?.id : undefined;
      const semantic = {
        ...(gesture.fromPoint
          ? { fromPoint: gesture.fromPoint }
          : {
              from: gesture.from,
              ...(gesture.fromPort ? { fromPort: gesture.fromPort } : {}),
            }),
        ...(target
          ? { to: target, ...(toPort ? { toPort } : {}) }
          : { toPoint: point }),
        ...(editor.store.getPage(editor.currentPageId)?.kind === "flowchart"
          ? { routing: "orthogonal" }
          : {}),
        arrowheads: { end: "arrow" },
      };
      const created = editor.createElement("edge.generic", { semantic });
      editor.selection.set([created]);
    } else if (
      target &&
      acceptsEndpoint(gesture.connectorType, gesture.from) &&
      acceptsEndpoint(gesture.connectorType, target)
    ) {
      const targetPort =
        !gesture.screenTransition || screenFrame(editor, target) === target
          ? nearestPort(target, ctx.pagePoint(event))?.id
          : undefined;
      const ports = {
        ...(gesture.fromPort ? { fromPort: gesture.fromPort } : {}),
        ...(targetPort ? { toPort: targetPort } : {}),
      };
      const created = gesture.screenTransition
        ? connectScreenTransition(
            editor,
            gesture.from,
            target,
            undefined,
            ports,
          )
        : gesture.componentKind
          ? editor.connectComponent(
              gesture.from,
              target,
              gesture.componentKind,
              {},
              ports,
            )
          : gesture.connectorType === "erd.relation"
            ? editor.connectErdRelation(
                gesture.from,
                target,
                gesture.logicalRelation === true,
                {},
                ports,
              )
            : editor.connectSmart(gesture.from, target, {}, ports);
      if (created) {
        editor.selection.set([created]);
      }
    }
  };

  const finishReconnecting = (
    gesture: GestureOf<"reconnecting">,
    event: PointerEvent,
  ): void => {
    const target = targetUnder(ctx.pagePoint(event), [
      gesture.id,
      gesture.other,
    ]);
    if (target) {
      reconnect(
        gesture.id,
        gesture.end,
        target,
        nearestPort(target, ctx.pagePoint(event))?.id,
      );
    } else if (
      targetUnder(ctx.pagePoint(event), [gesture.id]) !== gesture.other
    ) {
      setGenericConnectorEndpoint(editor, gesture.id, gesture.end, {
        point: ctx.pagePoint(event),
      });
    }
  };

  const editSelectedRouteHandle = (event: MouseEvent, point: Vec): boolean => {
    if (editor.selection.size === 1) {
      const selected = editor.store.get(
        [...editor.selection.ids()][0] as ElementId,
      );
      if (selected && MANUAL_ROUTE_TYPES.has(selected.type)) {
        const resolved = resolveConnector(
          selected,
          editor.createShapeContext(),
          endpointReaderFor(selected.type),
        );
        const close = (at: Vec) =>
          Math.hypot(at.x - point.x, at.y - point.y) <=
          8 / editor.camera.get().z;
        const index = resolved?.waypointPoints?.findIndex(close) ?? -1;
        if (index >= 0) {
          event.preventDefault();
          removeConnectorWaypoint(editor, selected.id, index);
          return true;
        }
        if (resolved?.bendPoint && close(resolved.bendPoint)) {
          event.preventDefault();
          straightenConnectors(editor, [selected.id]);
          return true;
        }
      }
    }
    return false;
  };

  const insertRouteWaypoint = (
    event: MouseEvent,
    hit: ElementId,
    element: Element,
    point: Vec,
  ): void => {
    const context = editor.createShapeContext();
    const semantic =
      typeof element.semantic === "object" && element.semantic !== null
        ? (element.semantic as Record<string, unknown>)
        : {};
    const resolved = resolveConnector(
      element,
      context,
      endpointReaderFor(element.type),
    );
    const routingWaypoints = resolved
      ? connectorWaypointsWithInsertion(
          resolved,
          point,
          semantic["routing"] === "manual",
        )
      : null;
    if (routingWaypoints && !context.isLocked?.(hit)) {
      flushNudge();
      event.preventDefault();
      editor.apply([
        {
          type: "updateSemantic",
          id: hit,
          semantic: { ...semantic, routing: "manual", routingWaypoints },
        },
      ]);
      editor.selection.set([hit]);
    }
  };

  // --------------------------------------------------------------- handles

  const startRouteBend = (id: ElementId, event: PointerEvent): void => {
    const element = editor.store.get(id);
    const context = editor.createShapeContext();
    const resolved = element
      ? resolveConnector(element, context, endpointReaderFor(element.type))
      : null;
    if (
      !owns(event) ||
      event.button !== 0 ||
      !element ||
      !resolved ||
      !resolved.bendPoint ||
      !resolved.bendAxis ||
      context.isLocked?.(id)
    )
      return;
    const axis = resolved.bendAxis;
    event.stopPropagation();
    claim(event);
    editor.beginBatch();
    state.gesture = {
      kind: "routing-bend",
      startScreen: ctx.screenPoint(event),
      moved: false,
      id,
      axis,
      from: resolved.start[axis],
      to: resolved.end[axis],
    };
  };

  const startRouteWaypoint = (
    id: ElementId,
    index: number,
    event: PointerEvent,
  ): void => {
    const element = editor.store.get(id);
    const context = editor.createShapeContext();
    const readEndpoints = element ? endpointReaderFor(element.type) : null;
    const resolved =
      element && readEndpoints
        ? resolveConnector(element, context, readEndpoints)
        : null;
    const fromBox = resolved?.fromBox;
    const toBox = resolved?.toBox;
    if (
      !owns(event) ||
      event.button !== 0 ||
      !element ||
      !fromBox ||
      !toBox ||
      !resolved?.waypointPoints?.[index] ||
      context.isLocked?.(id)
    )
      return;
    event.stopPropagation();
    claim(event);
    editor.beginBatch();
    state.gesture = {
      kind: "routing-waypoint",
      startScreen: ctx.screenPoint(event),
      moved: false,
      id,
      index,
      fromCenter: boxCenter(fromBox),
      toCenter: boxCenter(toBox),
    };
  };

  const startReconnect = (
    id: ElementId,
    end: ConnectorEnd,
    event: PointerEvent,
  ): void => {
    if (!owns(event)) {
      return;
    }
    const element = editor.store.get(id);
    if (!element) {
      return;
    }
    const reader = endpointReaderFor(element.type);
    const ids = reader(element.semantic);
    const resolved = resolveConnector(
      element,
      editor.createShapeContext(),
      reader,
    );
    if (!ids || !resolved) {
      return;
    }
    event.stopPropagation();
    claim(event);
    const point = ctx.pagePoint(event);
    // The end that stays is the rubber band's fixed point.
    const anchor = end === "from" ? resolved.end : resolved.start;
    state.gesture = {
      kind: "reconnecting",
      id,
      end,
      other: end === "from" ? ids.to : ids.from,
      anchor,
    };
    ctx.setPending({ from: anchor, to: point });
  };

  const startConnect = (
    from: ElementId,
    event: PointerEvent,
    port?: ConnectorPort,
  ): void => {
    if (!owns(event) || !editor.store.has(from)) {
      return;
    }
    event.stopPropagation();
    claim(event);
    beginConnect(from, ctx.pagePoint(event), port);
  };

  return {
    beginConnect,
    moveRoutingBend,
    moveRoutingWaypoint,
    moveConnecting,
    moveReconnecting,
    finishConnecting,
    finishReconnecting,
    editSelectedRouteHandle,
    insertRouteWaypoint,
    startRouteBend,
    startRouteWaypoint,
    startReconnect,
    startConnect,
  };
}
