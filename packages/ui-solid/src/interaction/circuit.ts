// PCB and breadboard page tools: drafting PCB tracks and vias, drafting
// breadboard wires point by point, editing a wire's bend points, pin and
// net hover feedback, and rotating parts from the keyboard.

import type { Vec } from "@nodetto/core";
import {
  breadboardPins,
  breadboardWirePoints,
  distanceToSegment,
  snapBreadboardPoint,
} from "@nodetto/core";
import { type ElementId, isBreadboardPartType } from "@nodetto/ir";
import {
  pcbSnapTarget,
  pcbTrackDraft,
  pcbViaInput,
} from "../pcb-interaction.ts";
import { pcbHiddenLayers, pcbToolOptions } from "../pcb-state.ts";
import { Tool, type ToolKind } from "../tools.ts";
import type { InteractionContext } from "./context.ts";
import { CLICK_SLOP_PX } from "./events.ts";
import type { HitTesting } from "./hit-testing.ts";
import type { GestureLifecycle } from "./lifecycle.ts";
import type { GestureOf } from "./types.ts";

export interface CircuitTools {
  finishPcbTrack(): void;
  finishWireDraft(): void;
  /** Place a via, or start or extend the PCB track draft. */
  placePcbTool(point: Vec, tool: ToolKind): void;
  /** Add one snapped point to the breadboard wire draft. */
  placeBreadboardWirePoint(point: Vec): void;
  /** Net, pin and wire-draft feedback while no gesture is running. */
  updateIdleHover(event: PointerEvent): void;
  moveWirePoint(
    gesture: GestureOf<"breadboard-wire-point">,
    event: PointerEvent,
  ): void;
  /**
   * Double-click finishing a track or wire draft, or adding or removing a
   * bend point on the selected breadboard wire. True when consumed.
   */
  handleDoubleClick(event: MouseEvent, point: Vec): boolean;
  /** R / Shift+R on selected breadboard parts or PCB footprints. */
  rotatePartsByKey(event: KeyboardEvent, key: string): boolean;
  startBreadboardWirePoint(
    id: ElementId,
    index: number,
    event: PointerEvent,
  ): void;
}

export function createCircuitTools(
  ctx: InteractionContext,
  hits: HitTesting,
  lifecycle: GestureLifecycle,
): CircuitTools {
  const { editor, options, state } = ctx;
  const { owns, claim } = lifecycle;

  const finishPcbTrack = (): void => {
    if (
      !ctx.isPcbPage() ||
      editor.readOnly ||
      !state.pcbTrackState ||
      state.pcbTrackState.vertices.length === 0
    )
      return;
    const last =
      state.pcbTrackState.vertices.at(-1) ?? state.pcbTrackState.start;
    const result = pcbTrackDraft(
      state.pcbTrackState,
      { kind: "finish", point: last },
      pcbToolOptions(),
    );
    if (result.input) {
      const id = editor.addPcbTrack(editor.currentPageId, result.input);
      if (id) editor.selection.set([id]);
    }
    state.pcbTrackState = null;
    ctx.setPcbDraftPoints(null);
  };

  const finishWireDraft = (): void => {
    if (
      state.wirePoints.length >= 2 &&
      ctx.isBreadboardPage() &&
      !editor.readOnly
    ) {
      const [first] = state.wirePoints;
      if (first) {
        const points = state.wirePoints.map((point) => ({
          x: point.x - first.x,
          y: point.y - first.y,
        }));
        const id = editor.createBreadboardPart("breadboard.wire", first, {
          points,
        });
        if (id) editor.selection.set([id]);
      }
    }
    state.wirePoints = [];
    ctx.setWireDraft(null);
    options.setTool(Tool.Select);
  };

  const updateBreadboardHover = (point: Vec): void => {
    if (!ctx.isBreadboardPage()) {
      ctx.setBreadboardHover(null);
      return;
    }
    const pageElements = editor.store.getPageElements(editor.currentPageId);
    for (let index = pageElements.length - 1; index >= 0; index -= 1) {
      const element = pageElements[index];
      if (!element || element.visual.hidden === true) continue;
      if (isBreadboardPartType(element.type)) {
        const pin = breadboardPins(element).find(
          (candidate) =>
            Math.hypot(candidate.x - point.x, candidate.y - point.y) <= 4,
        );
        if (pin) {
          ctx.setBreadboardHover({ elementId: element.id, pin: pin.number });
          return;
        }
      } else if (
        element.type === "breadboard.wire" &&
        hits.canvasHitTest(point) === element.id
      ) {
        ctx.setBreadboardHover({ wireId: element.id });
        return;
      }
    }
    ctx.setBreadboardHover(null);
  };

  const placePcbTool = (point: Vec, tool: ToolKind): void => {
    if (!ctx.isPcbPage() || editor.readOnly) return;
    const pageId = editor.currentPageId;
    const pointMm = [point.x / 10, point.y / 10] as const;
    const hidden = pcbHiddenLayers(pageId);
    const snap = pcbSnapTarget(editor.getSnapshot(), pageId, pointMm, hidden);
    if (tool === Tool.PcbVia) {
      const id = editor.addPcbVia(
        pageId,
        pcbViaInput(pointMm, snap, pcbToolOptions()),
      );
      if (id) editor.selection.set([id]);
      return;
    }
    if (!state.pcbTrackState) {
      const result = pcbTrackDraft(
        null,
        { kind: "start", point: pointMm, target: snap },
        pcbToolOptions(),
      );
      state.pcbTrackState = result.draft;
      ctx.setPcbDraftPoints(
        state.pcbTrackState
          ? [
              {
                x: state.pcbTrackState.start[0] * 10,
                y: state.pcbTrackState.start[1] * 10,
              },
            ]
          : null,
      );
    } else {
      const targetPoint = snap?.point ?? pointMm;
      const result = pcbTrackDraft(
        state.pcbTrackState,
        { kind: "vertex", point: targetPoint },
        pcbToolOptions(),
      );
      state.pcbTrackState = result.draft;
      ctx.setPcbDraftPoints(
        state.pcbTrackState
          ? [
              {
                x: state.pcbTrackState.start[0] * 10,
                y: state.pcbTrackState.start[1] * 10,
              },
              ...state.pcbTrackState.vertices.map(([x, y]) => ({
                x: x * 10,
                y: y * 10,
              })),
            ]
          : null,
      );
    }
  };

  const placeBreadboardWirePoint = (point: Vec): void => {
    if (!ctx.isBreadboardPage()) return;
    const snapped = snapBreadboardPoint(point);
    const previous = state.wirePoints.at(-1);
    if (!previous || previous.x !== snapped.x || previous.y !== snapped.y) {
      state.wirePoints = [...state.wirePoints, snapped];
    }
    ctx.setWireDraft(state.wirePoints);
  };

  const updateIdleHover = (event: PointerEvent): void => {
    if (ctx.isPcbPage()) {
      const point = ctx.pagePoint(event);
      const target = pcbSnapTarget(
        editor.getSnapshot(),
        editor.currentPageId,
        [point.x / 10, point.y / 10],
        pcbHiddenLayers(editor.currentPageId),
      );
      ctx.setPcbHover(target?.net ?? "");
    } else ctx.setPcbHover("");
    if (ctx.isBreadboardPage()) {
      const point = ctx.pagePoint(event);
      updateBreadboardHover(point);
      if (
        options.tool() === Tool.BreadboardWire &&
        state.wirePoints.length > 0
      ) {
        const cursor = snapBreadboardPoint(point);
        const last = state.wirePoints.at(-1);
        ctx.setWireDraft(
          last && last.x === cursor.x && last.y === cursor.y
            ? state.wirePoints
            : [...state.wirePoints, cursor],
        );
      }
    } else {
      ctx.setBreadboardHover(null);
    }
  };

  const moveWirePoint = (
    wireGesture: GestureOf<"breadboard-wire-point">,
    event: PointerEvent,
  ): void => {
    const screen = ctx.screenPoint(event);
    if (
      !wireGesture.moved &&
      Math.hypot(
        screen.x - wireGesture.startScreen.x,
        screen.y - wireGesture.startScreen.y,
      ) <= CLICK_SLOP_PX
    )
      return;
    wireGesture.moved = true;
    const point = snapBreadboardPoint(ctx.pagePoint(event));
    const points = wireGesture.points.map((entry, index) =>
      index === wireGesture.index
        ? {
            x: point.x - wireGesture.origin.x,
            y: point.y - wireGesture.origin.y,
          }
        : entry,
    );
    editor.updateBreadboardSemantic(wireGesture.id, { points });
  };

  const handleDoubleClick = (event: MouseEvent, point: Vec): boolean => {
    if (
      state.pcbTrackState &&
      options.tool() === Tool.PcbTrack &&
      ctx.isPcbPage()
    ) {
      event.preventDefault();
      const pointMm = [point.x / 10, point.y / 10] as const;
      const snap = pcbSnapTarget(
        editor.getSnapshot(),
        editor.currentPageId,
        pointMm,
        pcbHiddenLayers(editor.currentPageId),
      );
      const last = state.pcbTrackState.vertices.at(-1);
      if (!last || last[0] !== pointMm[0] || last[1] !== pointMm[1]) {
        const next = pcbTrackDraft(
          state.pcbTrackState,
          { kind: "vertex", point: snap?.point ?? pointMm },
          pcbToolOptions(),
        );
        state.pcbTrackState = next.draft;
      }
      finishPcbTrack();
      return true;
    }
    if (state.wirePoints.length > 0 && options.tool() === Tool.BreadboardWire) {
      event.preventDefault();
      finishWireDraft();
      return true;
    }
    if (editor.selection.size === 1) {
      const [selectedId] = editor.selection.ids();
      const selected = selectedId ? editor.store.get(selectedId) : undefined;
      if (selected?.type === "breadboard.wire") {
        const points = breadboardWirePoints(selected);
        const tolerance = 8 / editor.camera.get().z;
        const handleIndex = points.findIndex(
          (at) => Math.hypot(at.x - point.x, at.y - point.y) <= tolerance,
        );
        const origin = { x: selected.visual.x ?? 0, y: selected.visual.y ?? 0 };
        const relative = (values: readonly Vec[]) =>
          values.map((at) => ({ x: at.x - origin.x, y: at.y - origin.y }));
        if (handleIndex > 0 && handleIndex < points.length - 1) {
          event.preventDefault();
          editor.updateBreadboardSemantic(selected.id, {
            points: relative(
              points.filter((_, index) => index !== handleIndex),
            ),
          });
          return true;
        }
        if (handleIndex < 0) {
          let nearest = -1;
          let distance = Number.POSITIVE_INFINITY;
          for (let index = 1; index < points.length; index += 1) {
            const from = points[index - 1];
            const to = points[index];
            if (!from || !to) continue;
            const next = distanceToSegment(point, from, to);
            if (next < distance) {
              nearest = index;
              distance = next;
            }
          }
          if (nearest > 0 && distance <= tolerance) {
            const snapped = snapBreadboardPoint(point);
            const inserted = [...points];
            inserted.splice(nearest, 0, snapped);
            event.preventDefault();
            editor.updateBreadboardSemantic(selected.id, {
              points: relative(inserted),
            });
            return true;
          }
        }
      }
    }
    return false;
  };

  const rotatePartsByKey = (event: KeyboardEvent, key: string): boolean => {
    if (
      ctx.isBreadboardPage() &&
      (key === "r" || (event.shiftKey && key === "r"))
    ) {
      const ids = [...editor.selection.ids()].filter((id) => {
        const element = editor.store.get(id);
        return element !== undefined && isBreadboardPartType(element.type);
      });
      if (ids.length > 0) {
        event.preventDefault();
        if (!editor.readOnly)
          editor.rotateBreadboardParts(ids, event.shiftKey ? -1 : 1);
        return true;
      }
    }

    if (ctx.isPcbPage() && key === "r") {
      const ids = [...editor.selection.ids()].filter(
        (id) => editor.store.get(id)?.type === "pcb.footprint",
      );
      if (ids.length > 0) {
        event.preventDefault();
        if (!editor.readOnly)
          editor.rotatePcbFootprints(ids, event.shiftKey ? -90 : 90);
        return true;
      }
    }
    return false;
  };

  const startBreadboardWirePoint = (
    id: ElementId,
    index: number,
    event: PointerEvent,
  ): void => {
    const element = editor.store.get(id);
    if (
      !owns(event) ||
      event.button !== 0 ||
      element?.type !== "breadboard.wire" ||
      !editor.selection.has(id) ||
      editor.readOnly
    )
      return;
    const semantic = element.semantic as { points: readonly Vec[] };
    if (index < 0 || index >= semantic.points.length) return;
    event.stopPropagation();
    claim(event);
    editor.beginBatch();
    state.gesture = {
      kind: "breadboard-wire-point",
      id,
      index,
      points: semantic.points.map((point) => ({ ...point })),
      origin: { x: element.visual.x ?? 0, y: element.visual.y ?? 0 },
      startScreen: ctx.screenPoint(event),
      moved: false,
    };
  };

  return {
    finishPcbTrack,
    finishWireDraft,
    placePcbTool,
    placeBreadboardWirePoint,
    updateIdleHover,
    moveWirePoint,
    handleDoubleClick,
    rotatePartsByKey,
    startBreadboardWirePoint,
  };
}
