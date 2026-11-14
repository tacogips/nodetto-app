// What the selection overlay shows handles for, derived from the selection,
// the active tool and the interaction's hover state. Every target is a memo
// so the overlay only re-renders when its own inputs change.

import type { Box, Editor, ShapeContext, Vec } from "@nodetto/core";
import {
  boxCenter,
  canRotateElement,
  canRotateSelection,
  connectionPorts,
  createSelectionResizeSnapshot,
  endpointReaderFor,
  insideClip,
  isGroup,
  resolveConnector,
  rotatedBox,
  rotatePoint,
  unionBoxes,
} from "@nodetto/core";
import type { ConnectorPort, Element, ElementId } from "@nodetto/ir";
import { type Accessor, createMemo } from "solid-js";
import type { EditorSignals } from "../adapter.ts";
import {
  type Interaction,
  RESIZE_HANDLES,
  type ResizeHandle,
  resizeHandlesFor,
} from "../interaction.ts";
import { Tool, type ToolKind, isConnectorTool } from "../tools.ts";
import {
  type ConnectorHandles,
  handleCenter,
  isConnector,
} from "./geometry.ts";

export type RotatedBox = Box & { rotation: number };

export interface ResizeTarget {
  id: ElementId;
  box: Box;
  rotation: number;
  handles: readonly ResizeHandle[];
}

export interface SelectionResizeTarget {
  box: Box;
  handles: readonly ResizeHandle[];
}

export interface ConnectionTarget {
  id?: ConnectorPort;
  point: Vec;
  elementId: ElementId;
}

export type RotateTarget =
  | { readonly kind: "element"; readonly id: ElementId; x: number; y: number }
  | {
      readonly kind: "selection";
      readonly center: Vec;
      x: number;
      y: number;
    };

export interface CropTarget {
  element: Element;
  box: Box;
}

export interface GradientTarget {
  element: Element;
  box: Box;
  paint: "fill" | "stroke";
}

export interface OverlayTargets {
  readonly selectionBoxes: Accessor<readonly RotatedBox[]>;
  /** The one selected element, or `null` for none or several. */
  readonly single: Accessor<Element | null>;
  readonly resizeTarget: Accessor<ResizeTarget | null>;
  readonly selectionResizeTarget: Accessor<SelectionResizeTarget | null>;
  readonly connectorHandles: Accessor<ConnectorHandles | null>;
  readonly connectionTargets: Accessor<readonly ConnectionTarget[]>;
  readonly hoverBox: Accessor<RotatedBox | null>;
  readonly rotateTarget: Accessor<RotateTarget | null>;
  readonly cropTarget: Accessor<CropTarget | null>;
  readonly gradientTarget: Accessor<GradientTarget | null>;
}

export interface OverlayTargetDeps {
  /** The canvas props; read on every use, as the canvas does. */
  readonly props: { readonly editor: Editor; readonly tool: ToolKind };
  readonly signals: EditorSignals;
  readonly readOnly: Accessor<boolean>;
  readonly context: Accessor<ShapeContext>;
  readonly zoom: Accessor<number>;
  readonly interaction: Interaction;
}

export function createOverlayTargets(deps: OverlayTargetDeps): OverlayTargets {
  const { props, signals, readOnly, context, zoom, interaction } = deps;

  const boundsOf = (id: ElementId): Box | null => {
    const element = props.editor.store.get(id);
    if (!element) {
      return null;
    }
    return props.editor
      .getShapeUtil(element.type)
      .getBounds(element, context());
  };

  const selectionBoxes = createMemo<readonly RotatedBox[]>(() => {
    const out: RotatedBox[] = [];
    for (const id of signals.selection()) {
      const box = boundsOf(id);
      if (box) {
        const element = props.editor.store.get(id);
        out.push({
          ...box,
          rotation:
            element && !isConnector(element) && !isGroup(element)
              ? (element.visual.rotation ?? 0)
              : 0,
        });
      }
    }
    return out;
  });

  /** The one selected element, or `null` for none or several. */
  const single = createMemo<Element | null>(() => {
    if (readOnly()) return null;
    const ids = [...signals.selection()];
    const id = ids.length === 1 ? ids[0] : undefined;
    if (id === undefined) {
      return null;
    }
    signals.rev();
    if (context().isHidden?.(id) || context().isLocked?.(id)) return null;
    return props.editor.store.get(id) ?? null;
  });

  /** Handles are offered only for a single resizable selection. */
  const resizeTarget = createMemo<ResizeTarget | null>(() => {
    if (props.tool !== Tool.Select) return null;
    const element = single();
    if (!element) {
      return null;
    }
    const util = props.editor.getShapeUtil(element.type);
    if (!util.canResize) {
      return null;
    }
    const box = util.getBounds(element, context());
    return box
      ? {
          id: element.id,
          box,
          rotation: element.visual.rotation ?? 0,
          handles: resizeHandlesFor(element.type),
        }
      : null;
  });

  /** A temporary multi-selection scales from one page-axis envelope. */
  const selectionResizeTarget = createMemo<SelectionResizeTarget | null>(() => {
    if (readOnly()) return null;
    if (props.tool !== "select" || signals.selection().size < 2) return null;
    signals.rev();
    const snapshot = createSelectionResizeSnapshot(props.editor);
    return snapshot ? { box: snapshot.bounds, handles: RESIZE_HANDLES } : null;
  });

  /** Endpoint handles for a single selected connector that resolves. */
  const connectorHandles = createMemo<ConnectorHandles | null>(() => {
    if (props.tool !== Tool.Select) return null;
    const element = single();
    if (!element || !isConnector(element)) {
      return null;
    }
    const resolved = resolveConnector(
      element,
      context(),
      endpointReaderFor(element.type),
    );
    if (!resolved) return null;
    return {
      id: element.id,
      start: resolved.start,
      end: resolved.end,
      ...(resolved.bendPoint ? { bend: resolved.bendPoint } : {}),
      ...(resolved.waypointPoints
        ? { waypoints: resolved.waypointPoints }
        : {}),
    };
  });

  /** One geometry source for painted points, hit testing and saved connectors. */
  const connectionTargets = createMemo<readonly ConnectionTarget[]>(() => {
    signals.rev();
    if (
      readOnly() ||
      (props.tool !== Tool.Select && !isConnectorTool(props.tool))
    )
      return [];
    const selected = single();
    const ids = new Set([selected?.id, interaction.hoverTarget()]);
    return [...ids].flatMap<ConnectionTarget>((id) => {
      const element = id ? props.editor.store.get(id) : undefined;
      if (
        !element ||
        context().isHidden?.(element.id) ||
        context().isLocked?.(element.id)
      )
        return [];
      if (
        element.type === "sequence.participant" &&
        selected?.id === element.id
      ) {
        // Sequence quick-connect controls create the next timeline row, rather
        // than pinning messages to the participant header or bounding box.
        const box = context().boundsOf(element.id);
        if (!box) return [];
        const offset = 14 / zoom();
        const outer = {
          x: box.x - offset,
          y: box.y - offset,
          width: box.width + offset * 2,
          height: box.height + offset * 2,
        };
        return (["n", "e", "s", "w"] as const).map((side) => ({
          elementId: element.id,
          point: rotatePoint(
            handleCenter(outer, side),
            boxCenter(box),
            element.visual.rotation ?? 0,
          ),
        }));
      }
      return connectionPorts(element, context())
        .filter((port) => insideClip(context(), element.id, port.point))
        .map((port) => {
          // Keep quick-connect controls outside the resize handles in Select.
          // The connection gesture itself starts at the actual outline point.
          const box = context().boundsOf(element.id);
          const center = box ? boxCenter(box) : port.point;
          const dx = port.point.x - center.x;
          const dy = port.point.y - center.y;
          const length = Math.hypot(dx, dy) || 1;
          const offset =
            props.tool === Tool.Select &&
            !interaction.pending() &&
            selected?.id === element.id
              ? 14 / zoom()
              : 0;
          return {
            ...port,
            point: {
              x: port.point.x + (dx / length) * offset,
              y: port.point.y + (dy / length) * offset,
            },
            elementId: element.id,
          };
        });
    });
  });

  const hoverBox = createMemo<RotatedBox | null>(() => {
    const id = interaction.hoverTarget();
    const box = id === null ? null : boundsOf(id);
    return box && id
      ? { ...box, rotation: props.editor.store.get(id)?.visual.rotation ?? 0 }
      : null;
  });

  const rotateTarget = createMemo<RotateTarget | null>(() => {
    if (readOnly()) return null;
    const selected = [...signals.selection()];
    if (props.tool !== "select") return null;
    if (selected.length > 1) {
      signals.rev();
      if (!canRotateSelection(props.editor)) return null;
      const bounds = unionBoxes(
        selectionBoxes().map(({ rotation, ...box }) =>
          rotatedBox(box, rotation),
        ),
      );
      if (!bounds) return null;
      const center = boxCenter(bounds);
      return {
        kind: "selection",
        center,
        x: center.x,
        y: bounds.y - 32 / signals.camera().z,
      };
    }
    const element = single();
    if (!element || !canRotateElement(element)) return null;
    const box = boundsOf(element.id);
    if (!box) return null;
    const angle = ((element.visual.rotation ?? 0) * Math.PI) / 180;
    const radius = box.height / 2 + 32 / signals.camera().z;
    return {
      kind: "element",
      id: element.id,
      x: box.x + box.width / 2 + Math.sin(angle) * radius,
      y: box.y + box.height / 2 - Math.cos(angle) * radius,
    };
  });

  const cropTarget = createMemo(() => {
    const element = single();
    if (props.tool !== "crop" || element?.type !== "image.raster") return null;
    const box = boundsOf(element.id);
    return box ? { element, box } : null;
  });

  const gradientTarget = createMemo<GradientTarget | null>(() => {
    const element = single();
    const paint =
      props.tool === "edit.paint"
        ? "fill"
        : props.tool === "edit.stroke-paint"
          ? "stroke"
          : null;
    const gradient =
      paint === "fill"
        ? element?.visual.style?.fillGradient
        : paint === "stroke"
          ? element?.visual.style?.strokeGradient
          : undefined;
    if (!element || !paint || !gradient) return null;
    const box = boundsOf(element.id);
    return box ? { element, box, paint } : null;
  });

  return {
    selectionBoxes,
    single,
    resizeTarget,
    selectionResizeTarget,
    connectorHandles,
    connectionTargets,
    hoverBox,
    rotateTarget,
    cropTarget,
    gradientTarget,
  };
}
