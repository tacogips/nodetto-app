import {
  type CadDisplayBody,
  type CadEngine,
  collectCadInput,
  type Editor,
  parseFaceName,
  type ViewportSize,
} from "@nodetto/core";
import type { ElementId, PageId } from "@nodetto/ir";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  CANVAS_DARK_CLASS,
  type CanvasMode,
} from "../canvas/canvas-background.ts";
import { isComposing } from "../NumberInput.tsx";
import { Tool, type ToolKind } from "../tools.ts";
import { createBoardPicker } from "./board-picker.tsx";
import {
  type Camera3d,
  fitBounds,
  orbit,
  pan,
  screenRay,
  viewProjection,
  zoomAt,
} from "./camera3d.ts";
import { createCadEvaluation } from "./evaluation.ts";
import { createExtrudeAuthoring } from "./extrude-authoring.ts";
import { CAD_DRAG_THRESHOLD } from "./extrude-interaction.ts";
import { type CadPick, pickBodies } from "./pick.ts";
import { type CadRenderer, createWebgl2Renderer } from "./renderer.ts";
import { handleCadSelectionKey } from "./selection-keys.ts";
import {
  createSketchAuthoring,
  type SketchViewportPoint,
} from "./sketch-authoring.ts";
import { pickSketchEntity } from "./sketch-overlay.ts";
import { cadStatusStoreFor } from "./status-store.ts";
import { createStlImport } from "./stl-import.tsx";
import { readCadTheme } from "./theme.ts";
import "./CadViewport.css";

export interface CadViewControls {
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly fit: () => void;
  readonly canFit: () => boolean;
}

export interface CadViewportProps {
  readonly editor: Editor;
  readonly engine: CadEngine | undefined;
  readonly canvasMode?: CanvasMode;
  readonly showGrid?: boolean;
  readonly tool?: ToolKind;
  readonly onToolChange?: (tool: ToolKind) => void;
  readonly onImportPicker?: (open: (() => void) | undefined) => void;
  readonly onViewControls?: (controls: CadViewControls | undefined) => void;
  readonly createRenderer?: (canvas: HTMLCanvasElement) => CadRenderer | null;
  readonly pageId?: PageId;
  readonly initialCamera?: Camera3d;
  readonly onCameraChange?: (camera: Camera3d) => void;
  readonly onViewportResize?: (size: ViewportSize) => void;
}

function fitBodies(
  bodies: readonly CadDisplayBody[],
  aspect: number,
  lines: readonly { segments: Float32Array }[] = [],
): Camera3d {
  const high = Number.POSITIVE_INFINITY;
  const low = Number.NEGATIVE_INFINITY;
  const min: [number, number, number] = [high, high, high];
  const max: [number, number, number] = [low, low, low];
  for (const positions of [
    ...bodies.map((body) => body.positions),
    ...lines.map((line) => line.segments),
  ]) {
    for (let i = 0; i < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = positions[i + axis];
        const lower = min[axis];
        const upper = max[axis];
        if (value === undefined || lower === undefined || upper === undefined)
          continue;
        min[axis] = Math.min(lower, value);
        max[axis] = Math.max(upper, value);
      }
    }
  }
  return fitBounds(min, max, aspect);
}

export function CadViewport(props: CadViewportProps) {
  let root!: HTMLDivElement;
  let canvas!: HTMLCanvasElement;
  const pageId = props.pageId ?? props.editor.currentPageId;
  const statusStore = cadStatusStoreFor(props.editor);
  const [revision, setRevision] = createSignal(props.editor.revision);
  const [selection, setSelection] = createSignal(props.editor.selection.ids());
  const [renderer, setRenderer] = createSignal<CadRenderer | null>(null);
  let mounted = false;
  const [themeUnavailable, setThemeUnavailable] = createSignal(false);
  const [picked, setPicked] = createSignal<CadPick | null>(null);
  const [camera, setCamera] = createSignal(
    props.initialCamera ?? fitBodies([], 1),
  );
  const [size, setSize] = createSignal<ViewportSize>({ width: 0, height: 0 });
  let fitted = props.initialCamera !== undefined;
  let provisional = false;
  let sketchPointer: { id: number; x: number; y: number } | undefined;
  let drag:
    | {
        readonly pointerId: number;
        readonly mode: "pan" | "orbit";
        readonly hit: CadPick | null;
        readonly entity: ElementId | null;
        readonly startX: number;
        readonly startY: number;
        x: number;
        y: number;
        moved: boolean;
      }
    | undefined;
  const tool = () => props.tool ?? Tool.Select;
  const collected = createMemo(() =>
    collectCadInput(props.editor.getSnapshot(), pageId, revision()),
  );
  const geometryElements = () => collected().elements;
  const authoring = {
    editor: props.editor,
    pageId,
    revision,
    selection,
    tool,
    selectTool: () => props.onToolChange?.(Tool.Select),
    focus: () => root.focus(),
    geometryElements,
    camera,
    changeCamera,
    size,
  };
  const sketch = createSketchAuthoring({ ...authoring, picked, renderer });
  const extrude = createExtrudeAuthoring(authoring);
  const board = createBoardPicker({ ...authoring, canvas: () => canvas });
  const stl = createStlImport({
    editor: props.editor,
    pageId,
    active: () => mounted,
  });

  function changeCamera(next: Camera3d): void {
    fitted = true;
    setCamera(next);
    props.onCameraChange?.(next);
  }

  const canFit = () =>
    size().width > 0 &&
    size().height > 0 &&
    !sketch.drawing() &&
    !extrude.dragging();

  function fit(): void {
    if (!canFit()) return;
    const { width, height } = size();
    const bodies = drawnBodies();
    changeCamera(
      fitBodies(
        bodies,
        width / height,
        bodies.length ? [] : sketch.entityLines(),
      ),
    );
  }

  function zoomBy(factor: number): void {
    if (!extrude.dragging()) changeCamera(zoomAt(camera(), factor));
  }

  onMount(() => {
    mounted = true;
    const registerImportPicker = props.onImportPicker;
    const registerViewControls = props.onViewControls;
    registerImportPicker?.(stl.openPicker);
    registerViewControls?.({
      zoomIn: () => zoomBy(1 / 1.25),
      zoomOut: () => zoomBy(1.25),
      fit,
      canFit,
    });
    const initialize = () =>
      setRenderer((props.createRenderer ?? createWebgl2Renderer)(canvas));
    initialize();
    root.focus();
    if (tool() === Tool.CadPcb) board.close(false);
    const unsubscribe = props.editor.subscribe(() =>
      setRevision(props.editor.revision),
    );
    const unsubscribeSelection = props.editor.selection.subscribe(setSelection);
    let lastSize: ViewportSize | undefined;
    const measure = () => {
      const { width, height } = root.getBoundingClientRect();
      if (lastSize?.width === width && lastSize.height === height) return;
      const next = { width, height };
      lastSize = next;
      setSize(next);
      props.onViewportResize?.(next);
    };
    const lost = (event: Event) => {
      event.preventDefault();
      renderer()?.dispose();
      setRenderer(null);
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", initialize);
    window.addEventListener("resize", measure);
    document.addEventListener("pointerdown", board.dismiss, true);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(root);
    measure();
    onCleanup(() => {
      mounted = false;
      registerImportPicker?.(undefined);
      registerViewControls?.(undefined);
      unsubscribe();
      unsubscribeSelection();
      document.removeEventListener("pointerdown", board.dismiss, true);
      if (tool() === Tool.CadPcb) board.close(false);
      window.removeEventListener("resize", measure);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", initialize);
      observer?.disconnect();
      // Browsers cap live WebGL contexts; do not wait for garbage collection.
      const current = renderer();
      current?.dispose();
      current?.releaseContext?.();
    });
  });

  const { bodies, failure } = createCadEvaluation({
    engine: () => props.engine,
    pageId,
    revision,
    collected,
    statusStore,
  });

  createEffect(() => {
    props.canvasMode;
    const view = renderer();
    if (!view) return;
    const computed = window.getComputedStyle(root);
    try {
      view.setTheme(readCadTheme((token) => computed.getPropertyValue(token)));
    } catch {
      setThemeUnavailable(true);
      return;
    }
    setThemeUnavailable(false);
  });

  const drawnBodies = createMemo<readonly CadDisplayBody[]>(
    (previousBodies) => {
      revision();
      const next = bodies().filter(
        ({ id }) => !props.editor.store.get(id)?.visual.hidden,
      );
      return previousBodies.length === next.length &&
        next.every((body, i) => body === previousBodies[i])
        ? previousBodies
        : next;
    },
    [],
  );
  createEffect(() => renderer()?.setBodies(drawnBodies()));
  createEffect(() => {
    const { width, height } = size();
    if (fitted || width <= 0 || height <= 0 || sketch.drawing()) return;
    if (drawnBodies().length > 0) {
      fit();
    } else if (!provisional) {
      const lines = sketch.entityLines();
      if (lines.some((line) => line.segments.length > 0)) {
        provisional = true;
        setCamera(fitBodies([], width / height, lines));
      }
    }
  });
  createEffect(() => {
    const view = renderer();
    const ids = selection();
    const hit = picked();
    const definingFeature = hit && parseFaceName(hit.faceName)?.feature;
    const current =
      hit &&
      (definingFeature ? ids.has(definingFeature) : ids.has(hit.bodyId)) &&
      drawnBodies().some(
        (body) =>
          body.id === hit.bodyId && body.faceNames.includes(hit.faceName),
      )
        ? hit
        : null;
    if (hit && !current) setPicked(null);
    const body = drawnBodies().find(({ id }) => ids.has(id));
    view?.setHighlight(
      current
        ? { bodyId: current.bodyId, faceName: current.faceName }
        : body
          ? { bodyId: body.id }
          : null,
    );
  });
  createEffect(() => renderer()?.setGridVisible?.(props.showGrid !== false));
  createEffect(() => {
    renderer()?.setOverlay(
      extrude.lines() ?? sketch.previewLines(),
      extrude.mesh(),
    );
  });
  createEffect(() => {
    const view = renderer();
    const current = camera();
    const { width, height } = size();
    props.canvasMode;
    props.showGrid;
    drawnBodies();
    selection();
    picked();
    revision();
    sketch.entityLines();
    sketch.previewLines();
    extrude.lines();
    extrude.mesh();
    if (!view || width <= 0 || height <= 0) return;
    const frame = window.requestAnimationFrame(() => {
      const scale = window.devicePixelRatio || 1;
      view.draw(current, Math.round(width * scale), Math.round(height * scale));
    });
    onCleanup(() => window.cancelAnimationFrame(frame));
  });

  function pointerPosition(event: PointerEvent): SketchViewportPoint | null {
    const { width, height, left, top } = canvas.getBoundingClientRect();
    if (width <= 0 || height <= 0) return null;
    return {
      width,
      height,
      x: (2 * (event.clientX - left)) / width - 1,
      y: 1 - (2 * (event.clientY - top)) / height,
    };
  }

  function pointerDown(event: PointerEvent): void {
    if (
      drag ||
      sketchPointer !== undefined ||
      extrude.dragging() ||
      (event.button !== 0 && event.button !== 1)
    )
      return;
    stl.clearNotice();
    const panning = event.button === 1 || event.shiftKey;
    const point = pointerPosition(event);
    if (!panning && extrude.start(event.pointerId, point)) {
      canvas.setPointerCapture?.(event.pointerId);
      root.focus();
      event.preventDefault();
      return;
    }
    if (sketch.drawing() && !panning) {
      sketchPointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      canvas.setPointerCapture?.(event.pointerId);
      root.focus();
      event.preventDefault();
      sketch.input("down", point, event.altKey);
      return;
    }
    const aspect = point ? point.width / point.height : 1;
    const hit =
      panning || !point
        ? null
        : pickBodies(
            drawnBodies(),
            screenRay(camera(), aspect, point.x, point.y),
          );
    const entity =
      panning || !point || tool() !== Tool.Select
        ? null
        : pickSketchEntity(
            sketch.entityLines(),
            viewProjection(camera(), aspect),
            point.x,
            point.y,
            point.width,
            point.height,
            hit?.point,
            sketch.sketchId(),
          );
    drag = {
      pointerId: event.pointerId,
      mode: panning ? "pan" : "orbit",
      hit,
      entity,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    canvas.setPointerCapture?.(event.pointerId);
    root.focus();
    event.preventDefault();
  }

  function pointerMove(event: PointerEvent): void {
    if (extrude.dragging()) {
      extrude.move(event.pointerId, pointerPosition(event));
      return;
    }
    if (
      !drag &&
      sketch.drawing() &&
      (sketchPointer === undefined || sketchPointer.id === event.pointerId)
    ) {
      sketch.input("move", pointerPosition(event), event.altKey);
      return;
    }
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <
        CAD_DRAG_THRESHOLD
    )
      return;
    drag.moved = true;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.mode === "pan") changeCamera(pan(camera(), dx, dy, size().height));
    if (drag.mode === "orbit")
      changeCamera(orbit({ ...camera(), ortho: false }, dx, dy));
  }

  function endDrag(event: PointerEvent): void {
    const commit = event.type === "pointerup";
    if (extrude.end(event.pointerId, pointerPosition(event), commit)) return;
    if (sketchPointer?.id === event.pointerId) {
      const { x, y } = sketchPointer;
      sketchPointer = undefined;
      if (!commit) sketch.cancelPointer();
      else if (
        Math.hypot(event.clientX - x, event.clientY - y) >= CAD_DRAG_THRESHOLD
      )
        sketch.input("up", pointerPosition(event), event.altKey);
      return;
    }
    if (drag?.pointerId !== event.pointerId) return;
    const { hit, entity, mode, moved } = drag;
    drag = undefined;
    if (event.type !== "pointerup" || moved || mode === "pan") return;
    const selectableEntity =
      entity && props.editor.store.has(entity) ? entity : null;
    const feature = hit && (parseFaceName(hit.faceName)?.feature ?? hit.bodyId);
    const selected =
      !selectableEntity && hit && feature && props.editor.store.has(feature)
        ? hit
        : null;
    batch(() => {
      setPicked(selected);
      const id = selectableEntity ?? (selected ? feature : undefined);
      props.editor.selection.set(id ? [id] : []);
    });
  }

  function zoom(event: WheelEvent): void {
    event.preventDefault();
    const unit =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size().height : 1;
    const delta = event.deltaY * unit;
    if (Number.isFinite(delta))
      zoomBy(Math.exp(Math.max(-4, Math.min(4, delta / 400))));
  }

  const status = () =>
    board.notice() ??
    extrude.status() ??
    sketch.status() ??
    (!props.engine
      ? "The CAD engine is unavailable."
      : !renderer()
        ? "WebGL2 is unavailable. The CAD model can still be edited in the panels."
        : themeUnavailable()
          ? "The CAD canvas colours are unavailable."
          : failure());

  function keyDown(event: KeyboardEvent): void {
    if (board.open() && ["Escape", "Backspace", "Delete"].includes(event.key)) {
      if (isComposing(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") board.close();
      return;
    }
    if (
      event.key === "Escape" &&
      !isComposing(event) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      (extrude.cancel() || sketch.cancel())
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    handleCadSelectionKey(props.editor, event);
  }

  return (
    <div
      ref={root}
      class="nodetto-canvas nodetto-cad-viewport"
      classList={{
        [CANVAS_DARK_CLASS]: props.canvasMode === "dark",
      }}
      tabindex="0"
      on:keydown={keyDown}
      on:dragover={(event) => {
        const transfer = event.dataTransfer;
        if (!transfer?.types.includes("Files")) return;
        event.preventDefault();
        transfer.dropEffect = stl.dropEffect();
      }}
      on:drop={(event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return;
        event.preventDefault();
        event.stopPropagation();
        stl.drop(files);
      }}
    >
      <stl.Input />
      <canvas
        ref={canvas}
        class="nodetto-cad-surface"
        aria-label="3D CAD viewport"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onWheel={zoom}
        onDblClick={fit}
      />
      <board.Menu />
      <Show when={stl.notice() || status()}>
        <div class="nodetto-cad-status" role="status">
          {[stl.notice(), status()].filter(Boolean).join(" ")}
        </div>
      </Show>
    </div>
  );
}
