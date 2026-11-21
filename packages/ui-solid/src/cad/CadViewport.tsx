import {
  type CadDisplayBody,
  type CadEngine,
  type CadEngineInput,
  type CadEngineResult,
  CadSupersededError,
  collectCadInput,
  type Editor,
  type ViewportSize,
} from "@nodetto/core";
import { isCadTypeName, type PageId } from "@nodetto/ir";
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
import { handleCadSelectionKey } from "./selection-keys.ts";
import { cadStatusStoreFor } from "./status-store.ts";
import {
  type Camera3d,
  fitBounds,
  orbit,
  pan,
  screenRay,
  zoomAt,
} from "./camera3d.ts";
import { type CadPick, pickBodies } from "./pick.ts";
import { type CadRenderer, createWebgl2Renderer } from "./renderer.ts";
import { readCadTheme } from "./theme.ts";
import "./CadViewport.css";

export interface CadViewportProps {
  readonly editor: Editor;
  readonly engine: CadEngine | undefined;
  readonly canvasMode?: CanvasMode;
  readonly showGrid?: boolean;
  readonly createRenderer?: (canvas: HTMLCanvasElement) => CadRenderer | null;
  readonly pageId?: PageId;
  readonly initialCamera?: Camera3d;
  readonly onCameraChange?: (camera: Camera3d) => void;
  readonly onViewportResize?: (size: ViewportSize) => void;
}

function fitBodies(
  bodies: readonly CadDisplayBody[],
  aspect: number,
): Camera3d {
  const high = Number.POSITIVE_INFINITY;
  const low = Number.NEGATIVE_INFINITY;
  const min: [number, number, number] = [high, high, high];
  const max: [number, number, number] = [low, low, low];
  for (const { positions } of bodies) {
    for (let i = 0; i < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = positions[i + axis];
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
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
  const [bodies, setBodies] = createSignal<readonly CadDisplayBody[]>([]);
  const [failure, setFailure] = createSignal<string>();
  const [themeUnavailable, setThemeUnavailable] = createSignal(false);
  const [picked, setPicked] = createSignal<CadPick | null>(null);
  const [camera, setCamera] = createSignal(
    props.initialCamera ?? fitBodies([], 1),
  );
  const [size, setSize] = createSignal<ViewportSize>({ width: 0, height: 0 });
  let fitted = props.initialCamera !== undefined;
  let drag:
    | {
        readonly pointerId: number;
        readonly mode: "pan" | "orbit" | "pick";
        readonly hit: CadPick | null;
        readonly startX: number;
        readonly startY: number;
        x: number;
        y: number;
        moved: boolean;
      }
    | undefined;

  function changeCamera(next: Camera3d): void {
    fitted = true;
    setCamera(next);
    props.onCameraChange?.(next);
  }

  function fit(): void {
    const { width, height } = size();
    changeCamera(fitBodies(drawnBodies(), width / height));
  }

  onMount(() => {
    const initialize = () =>
      setRenderer((props.createRenderer ?? createWebgl2Renderer)(canvas));
    initialize();
    root.focus();
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
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(root);
    measure();
    onCleanup(() => {
      unsubscribe();
      unsubscribeSelection();
      window.removeEventListener("resize", measure);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", initialize);
      observer?.disconnect();
      renderer()?.dispose();
    });
  });

  let previous: { engine: CadEngine; input: CadEngineInput } | undefined;
  createEffect(() => {
    const version = revision();
    const engine = props.engine;
    if (!engine) {
      previous = undefined;
      statusStore.clear(pageId);
      return;
    }
    // The editor snapshot contains plain IR records. Compare the collected
    // records so neither unrelated pages nor shared carriers trigger CAD work,
    // and any foreign records collected by the engine participate too.
    const collected = collectCadInput(
      props.editor.getSnapshot(),
      pageId,
      version,
    );
    const input = {
      ...collected,
      elements: collected.elements.filter(
        ({ page, type }) => page !== pageId || isCadTypeName(type),
      ),
    };
    if (
      previous?.engine === engine &&
      previous.input.elements.length === input.elements.length &&
      input.elements.every(
        (element, i) => element === previous?.input.elements[i],
      )
    )
      return;

    const request = { engine, input };
    previous = request;
    const publishFailure = (
      code: string,
      statuses: CadEngineResult["status"] = [],
    ): void => {
      const known = new Map(statuses);
      const failure = { ok: false, code } as const;
      statusStore.set(
        pageId,
        input.elements.flatMap(({ id, page }) => {
          if (page !== pageId) return [];
          const status = known.get(id);
          return [[id, status && !status.ok ? status : failure] as const];
        }),
      );
    };
    const evaluate = async (): Promise<void> => {
      try {
        const result = await engine.evaluate(input);
        if (previous !== request || result.revision !== version) return;
        if (result.failure) {
          setFailure(`CAD evaluation failed (${result.failure}).`);
          publishFailure(result.failure, result.status);
          return;
        }
        const failed = result.status.find(([, status]) => !status.ok)?.[1];
        setFailure(
          failed && !failed.ok
            ? `CAD feature failed (${failed.code}).`
            : undefined,
        );
        setBodies(result.bodies);
        statusStore.set(pageId, result.status);
      } catch (error) {
        if (previous !== request || error instanceof CadSupersededError) return;
        setFailure("CAD evaluation failed.");
        publishFailure("cad.kernel.failed");
      }
    };
    void evaluate();
  });
  onCleanup(() => {
    previous = undefined;
    statusStore.clear(pageId);
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
    if (
      !fitted &&
      drawnBodies().length > 0 &&
      size().width > 0 &&
      size().height > 0
    )
      fit();
  });
  createEffect(() => {
    const view = renderer();
    const ids = selection();
    const hit = picked();
    if (hit && !ids.has(hit.bodyId)) setPicked(null);
    const body = drawnBodies().find(({ id }) => ids.has(id));
    view?.setHighlight(
      body
        ? {
            bodyId: body.id,
            faceName: hit?.bodyId === body.id ? hit.faceName : undefined,
          }
        : null,
    );
  });
  createEffect(() => renderer()?.setGridVisible?.(props.showGrid !== false));
  createEffect(() => {
    const view = renderer();
    const current = camera();
    const { width, height } = size();
    props.canvasMode;
    props.showGrid;
    drawnBodies();
    selection();
    picked();
    if (!view || width <= 0 || height <= 0) return;
    const frame = window.requestAnimationFrame(() => {
      const scale = window.devicePixelRatio || 1;
      view.draw(current, Math.round(width * scale), Math.round(height * scale));
    });
    onCleanup(() => window.cancelAnimationFrame(frame));
  });

  function pick(event: PointerEvent): CadPick | null {
    const { width, height, left, top } = canvas.getBoundingClientRect();
    if (width <= 0 || height <= 0) return null;
    return pickBodies(
      drawnBodies(),
      screenRay(
        camera(),
        width / height,
        (2 * (event.clientX - left)) / width - 1,
        1 - (2 * (event.clientY - top)) / height,
      ),
    );
  }

  function pointerDown(event: PointerEvent): void {
    if (drag || (event.button !== 0 && event.button !== 1)) return;
    const panning = event.button === 1 || event.shiftKey;
    const hit = panning ? null : pick(event);
    drag = {
      pointerId: event.pointerId,
      mode: panning ? "pan" : hit ? "pick" : "orbit",
      hit,
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
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 3
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
    if (drag?.pointerId !== event.pointerId) return;
    const { hit, mode, moved } = drag;
    drag = undefined;
    if (event.type !== "pointerup" || moved || mode === "pan") return;
    const selected = hit && props.editor.store.has(hit.bodyId) ? hit : null;
    batch(() => {
      setPicked(selected);
      props.editor.selection.set(selected ? [selected.bodyId] : []);
    });
  }

  function zoom(event: WheelEvent): void {
    event.preventDefault();
    const unit =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size().height : 1;
    const delta = event.deltaY * unit;
    if (Number.isFinite(delta))
      changeCamera(
        zoomAt(camera(), Math.exp(Math.max(-4, Math.min(4, delta / 400)))),
      );
  }

  const status = () =>
    !props.engine
      ? "The CAD engine is unavailable."
      : !renderer()
        ? "WebGL2 is unavailable. The CAD model can still be edited in the panels."
        : themeUnavailable()
          ? "The CAD canvas colours are unavailable."
          : failure();

  return (
    <div
      ref={root}
      class="nodetto-canvas nodetto-cad-viewport"
      classList={{
        [CANVAS_DARK_CLASS]: props.canvasMode === "dark",
      }}
      tabindex="0"
      on:keydown={(event) => handleCadSelectionKey(props.editor, event)}
    >
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
      <Show when={status()}>
        <div class="nodetto-cad-status" role="status">
          {status()}
        </div>
      </Show>
    </div>
  );
}
