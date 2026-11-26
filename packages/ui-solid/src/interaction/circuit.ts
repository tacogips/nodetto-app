// PCB and breadboard page tools: drafting PCB tracks and vias, drafting
// breadboard wires point by point, editing a wire's bend points, pin and
// net hover feedback, and rotating parts from the keyboard.

import type { KeyPoint, Vec } from "@nodetto/core";
import {
  keyCoordinate,
  localCoordinateForKey,
  pointElementKey,
  wirePointKeys,
} from "@nodetto/core";
import { createSignal } from "solid-js";
import {
  breadboardPins,
  breadboardWirePoints,
  distanceToSegment,
  snapBreadboardPoint,
} from "@nodetto/core";
import {
  coordinateKey,
  type ElementId,
  isBreadboardPartType,
  isSchematicPartType,
  SCHEMATIC_COORDINATE_LIMIT,
} from "@nodetto/ir";
import {
  classifySchematicWireTarget,
  SCHEMATIC_LABEL_CROSSING_MESSAGE,
  type SchematicWireTarget,
  resolveSchematicWireClick,
  schematicWirePreview,
  SCHEMATIC_COORDINATE_RANGE_MESSAGE,
} from "./schematic-wire.ts";
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
import { rerouteSchematicWirePoint } from "./schematic-wire-edit.ts";

export interface CircuitTools {
  finishSchematicWirePoint(
    gesture: GestureOf<"breadboard-wire-point">,
  ): "commit" | "abort";
  nudgeSchematicWirePoint(
    id: ElementId,
    index: number,
    dx: number,
    dy: number,
  ): number | null;
  readonly schematicWireNotice: () => string | null;
  placeSchematicWirePoint(point: Vec, shiftKey: boolean): void;
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
  const [notice, setNotice] = createSignal<string | null>(null);
  let schematicDrop: SchematicWireTarget | null = null;
  let keys: readonly KeyPoint[] = [];
  let startJunction: KeyPoint | undefined;
  let lastJunction: KeyPoint | undefined;
  let lastClickRejected = false;
  const clearSchematic = () => {
    keys = [];
    startJunction = undefined;
    lastJunction = undefined;
    lastClickRejected = false;
    setNotice(null);
  };
  const finishSchematic = (
    candidateKeys: readonly KeyPoint[],
    endJunction: KeyPoint | undefined,
  ): boolean => {
    const first = candidateKeys[0];
    if (
      !first ||
      !candidateKeys.some((k) => k.kx !== first.kx || k.ky !== first.ky)
    )
      return true;
    const clamp = (k: number) => Math.max(-1e11, Math.min(1e11, k));
    const visual = {
      x: keyCoordinate(clamp(first.kx)),
      y: keyCoordinate(clamp(first.ky)),
    };
    const points = candidateKeys.map((k) => ({
      x: localCoordinateForKey(k.kx, visual.x),
      y: localCoordinateForKey(k.ky, visual.y),
    }));
    const junctions = [startJunction, endJunction]
      .filter((k): k is KeyPoint => k !== undefined)
      .filter(
        (k, i, all) =>
          all.findIndex((other) => other.kx === k.kx && other.ky === k.ky) ===
          i,
      )
      .filter(
        (k) =>
          !editor.store.getPageElements(editor.currentPageId).some((e) => {
            if (e.type !== "schematic.junction") return false;
            const existing = pointElementKey(e);
            return existing.kx === k.kx && existing.ky === k.ky;
          }),
      )
      .map((k) => ({ x: keyCoordinate(k.kx), y: keyCoordinate(k.ky) }));
    if (
      [visual, ...points, ...junctions].some(
        (p) =>
          !Number.isFinite(p.x) ||
          !Number.isFinite(p.y) ||
          Math.abs(p.x) > SCHEMATIC_COORDINATE_LIMIT ||
          Math.abs(p.y) > SCHEMATIC_COORDINATE_LIMIT,
      )
    ) {
      setNotice(SCHEMATIC_COORDINATE_RANGE_MESSAGE);
      lastClickRejected = true;
      return false;
    }
    const wire = editor.buildElement("schematic.wire", {
      visual,
      semantic: { points },
    });
    const elements = [
      wire,
      ...junctions.map((visual) =>
        editor.buildElement("schematic.junction", { visual }),
      ),
    ];
    editor.apply(
      elements.map((element) => ({ type: "createElement" as const, element })),
    );
    editor.selection.set([wire.id]);
    return true;
  };
  const placeSchematicWirePoint = (point: Vec, shiftKey: boolean): void => {
    if (!ctx.isSchematicPage() || editor.readOnly) return;
    if (state.wirePoints.length === 0) clearSchematic();
    const result = resolveSchematicWireClick(
      editor.store,
      editor.currentPageId,
      point,
      state.wirePoints,
      shiftKey,
    );
    if (result.action === "reject") {
      lastClickRejected = true;
      setNotice(result.message);
      return;
    }
    const previous = state.wirePoints.at(-1);
    const last = result.points.at(-1);
    const repeat =
      previous !== undefined &&
      last !== undefined &&
      result.points.length === state.wirePoints.length &&
      previous.x === last.x &&
      previous.y === last.y;
    if (repeat && result.action === "add") {
      lastClickRejected = false;
      setNotice(null);
      return;
    }
    if (result.action === "finish") {
      if (
        !finishSchematic(
          repeat ? keys : result.keys,
          repeat ? lastJunction : result.pendingJunction,
        )
      )
        return;
      state.wirePoints = [];
      ctx.setWireDraft(null);
      clearSchematic();
      options.setTool(Tool.Select);
      return;
    }
    if (state.wirePoints.length === 0) startJunction = result.pendingJunction;
    lastJunction = result.pendingJunction;
    keys = result.keys;
    state.wirePoints = result.points;
    ctx.setWireDraft(state.wirePoints);
    lastClickRejected = false;
    setNotice(null);
  };

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
      ctx.isSchematicPage() &&
      options.tool() === Tool.SchematicWire &&
      !editor.readOnly
    ) {
      if (!finishSchematic(keys, lastJunction)) return;
      state.wirePoints = [];
      ctx.setWireDraft(null);
      clearSchematic();
      options.setTool(Tool.Select);
      return;
    }
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
    if (
      ctx.isSchematicPage() &&
      options.tool() === Tool.SchematicWire &&
      state.wirePoints.length > 0
    ) {
      ctx.setWireDraft(
        schematicWirePreview(
          editor.store,
          editor.currentPageId,
          state.wirePoints,
          ctx.pagePoint(event),
          event.shiftKey,
        ),
      );
    }
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

  const inRange = (p: Vec): boolean =>
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Math.abs(p.x) <= SCHEMATIC_COORDINATE_LIMIT &&
    Math.abs(p.y) <= SCHEMATIC_COORDINATE_LIMIT;
  const validResult = (
    points: readonly Vec[],
    drop: SchematicWireTarget | null,
  ): boolean =>
    points.every(inRange) &&
    (!drop?.junctionAt ||
      inRange({
        x: keyCoordinate(drop.junctionAt.kx),
        y: keyCoordinate(drop.junctionAt.ky),
      }));
  const addDropJunction = (drop: SchematicWireTarget | null): void => {
    const k = drop?.junctionAt;
    if (
      !k ||
      editor.store.getPageElements(editor.currentPageId).some((e) => {
        if (e.type !== "schematic.junction") return false;
        const existing = pointElementKey(e);
        return existing.kx === k.kx && existing.ky === k.ky;
      })
    )
      return;
    const element = editor.buildElement("schematic.junction", {
      visual: { x: keyCoordinate(k.kx), y: keyCoordinate(k.ky) },
    });
    editor.apply([{ type: "createElement", element }]);
  };
  const finishSchematicWirePoint = (
    _gesture: GestureOf<"breadboard-wire-point">,
  ): "commit" | "abort" => {
    const drop = schematicDrop;
    schematicDrop = null;
    if (drop?.kind === "label-crossing") {
      setNotice(SCHEMATIC_LABEL_CROSSING_MESSAGE);
      return "abort";
    }
    addDropJunction(drop);
    return "commit";
  };
  const nudgeSchematicWirePoint = (
    id: ElementId,
    index: number,
    dx: number,
    dy: number,
  ): number | null => {
    const element = editor.store.get(id);
    if (
      !element ||
      element.type !== "schematic.wire" ||
      editor.readOnly ||
      element.page !== editor.currentPageId
    )
      return null;
    const points = (element.semantic as { points: readonly Vec[] }).points;
    const original = wirePointKeys(element)[index];
    if (!original) return null;
    const key = { kx: original.kx + dx * 100, ky: original.ky + dy * 100 };
    const end = index === 0 || index === points.length - 1;
    const drop = end
      ? classifySchematicWireTarget(
          editor.store,
          element.page,
          { x: keyCoordinate(key.kx), y: keyCoordinate(key.ky) },
          id,
        )
      : null;
    if (drop?.kind === "label-crossing") {
      setNotice(SCHEMATIC_LABEL_CROSSING_MESSAGE);
      return null;
    }
    const target = drop?.key ?? key;
    const result = rerouteSchematicWirePoint(points, index, {
      x: localCoordinateForKey(target.kx, element.visual.x ?? 0),
      y: localCoordinateForKey(target.ky, element.visual.y ?? 0),
    });
    if (!result) return null;
    if (!validResult(result.points, drop)) {
      setNotice(SCHEMATIC_COORDINATE_RANGE_MESSAGE);
      return null;
    }
    editor.beginBatch();
    editor.updateSchematicSemantic(id, { points: result.points });
    addDropJunction(drop);
    editor.endBatch();
    setNotice(null);
    return result.index;
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
    const element = editor.store.get(wireGesture.id);
    if (element?.type === "schematic.wire") {
      const raw = ctx.pagePoint(event);
      const end =
        wireGesture.index === 0 ||
        wireGesture.index === wireGesture.points.length - 1;
      const drop = end
        ? classifySchematicWireTarget(
            editor.store,
            element.page,
            raw,
            element.id,
          )
        : null;
      if (drop?.kind === "label-crossing") {
        schematicDrop = drop;
        return;
      }
      const snapped = snapBreadboardPoint(raw);
      const key = drop?.key ?? {
        kx: coordinateKey(snapped.x),
        ky: coordinateKey(snapped.y),
      };
      const result = rerouteSchematicWirePoint(
        wireGesture.points,
        wireGesture.index,
        {
          x: localCoordinateForKey(key.kx, wireGesture.origin.x),
          y: localCoordinateForKey(key.ky, wireGesture.origin.y),
        },
      );
      if (!result) return;
      if (!validResult(result.points, drop)) {
        setNotice(SCHEMATIC_COORDINATE_RANGE_MESSAGE);
        return;
      }
      editor.updateSchematicSemantic(element.id, { points: result.points });
      schematicDrop = drop;
      setNotice(null);
      return;
    }
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
    if (ctx.isSchematicPage() && options.tool() === Tool.SchematicWire) {
      if (state.wirePoints.length && !lastClickRejected) finishWireDraft();
      return true;
    }
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
      ctx.isSchematicPage() &&
      !event.altKey &&
      (key === "r" || key === "x")
    ) {
      const ids = [...editor.selection.ids()].filter((id) => {
        const element = editor.store.get(id);
        return (
          element !== undefined &&
          (isSchematicPartType(element.type) ||
            (key === "r" &&
              (element.type === "schematic.power" ||
                element.type === "schematic.label")))
        );
      });
      if (ids.length > 0) {
        event.preventDefault();
        if (!editor.readOnly) {
          if (key === "r")
            editor.rotateSchematicElements(ids, event.shiftKey ? -1 : 1);
          else editor.mirrorSchematicParts(ids);
        }
        return true;
      }
    }
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
      (element?.type !== "breadboard.wire" &&
        element?.type !== "schematic.wire") ||
      !editor.selection.has(id) ||
      editor.readOnly
    )
      return;
    const semantic = element.semantic as { points: readonly Vec[] };
    if (index < 0 || index >= semantic.points.length) return;
    event.stopPropagation();
    claim(event);
    schematicDrop = null;
    setNotice(null);
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
    schematicWireNotice: () => {
      if (keys.length > 0 && state.wirePoints.length === 0) clearSchematic();
      return notice();
    },
    placeSchematicWirePoint,
    finishSchematicWirePoint,
    nudgeSchematicWirePoint,
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
