import {
  type CadDisplayBody,
  type CadEngine,
  type CadEngineInput,
  type CadEngineResult,
  CadSupersededError,
  collectCadInput,
  CommandError,
  type Editor,
  parseFaceName,
  pcbReferenceCommands,
  type ViewportSize,
} from "@nodetto/core";
import { type ElementId, isCadTypeName, type PageId } from "@nodetto/ir";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  CANVAS_DARK_CLASS,
  type CanvasMode,
} from "../canvas/canvas-background.ts";
import { stepMenuIndex } from "../menu-navigation.ts";
import { isComposing } from "../NumberInput.tsx";
import { Tool, type ToolKind } from "../tools.ts";
import {
  type Camera3d,
  fitBounds,
  orbit,
  pan,
  screenRay,
  viewProjection,
  zoomAt,
} from "./camera3d.ts";
import { createExtrudeAuthoring } from "./extrude-authoring.ts";
import { CAD_DRAG_THRESHOLD } from "./extrude-interaction.ts";
import {
  STL_IMPORT_NOTE,
  STL_MAX_BYTES,
  STL_SIZE_ERROR,
  stlToMeshCommands,
} from "./mesh-io.ts";
import { pcbBoardChoices, pcbBoardOptions } from "./pcb-insert.ts";
import { type CadPick, pickBodies } from "./pick.ts";
import { type CadRenderer, createWebgl2Renderer } from "./renderer.ts";
import { handleCadSelectionKey } from "./selection-keys.ts";
import {
  cadAuthoringIds,
  createSketchAuthoring,
  type SketchViewportPoint,
} from "./sketch-authoring.ts";
import { pickSketchEntity } from "./sketch-overlay.ts";
import { cadStatusStoreFor } from "./status-store.ts";
import { readCadTheme } from "./theme.ts";
import "./CadViewport.css";

export interface CadViewportProps {
  readonly editor: Editor;
  readonly engine: CadEngine | undefined;
  readonly canvasMode?: CanvasMode;
  readonly showGrid?: boolean;
  readonly tool?: ToolKind;
  readonly onToolChange?: (tool: ToolKind) => void;
  readonly onImportPicker?: (open: (() => void) | undefined) => void;
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
  let fileInput!: HTMLInputElement;
  let boardMenu: HTMLDivElement | undefined;
  const pageId = props.pageId ?? props.editor.currentPageId;
  const statusStore = cadStatusStoreFor(props.editor);
  const [revision, setRevision] = createSignal(props.editor.revision);
  const [selection, setSelection] = createSignal(props.editor.selection.ids());
  const [renderer, setRenderer] = createSignal<CadRenderer | null>(null);
  const [bodies, setBodies] = createSignal<readonly CadDisplayBody[]>([]);
  const [failure, setFailure] = createSignal<string>();
  const [importNotice, setImportNotice] = createSignal<string>();
  const [boardNotice, setBoardNotice] = createSignal<string>();
  const [boardPicker, setBoardPicker] = createSignal<{ revision: number }>();
  let importing = false;
  let pickerRevision: number | undefined;
  let mounted = false;
  const [themeUnavailable, setThemeUnavailable] = createSignal(false);
  const [picked, setPicked] = createSignal<CadPick | null>(null);
  const [camera, setCamera] = createSignal(
    props.initialCamera ?? fitBodies([], 1),
  );
  const [size, setSize] = createSignal<ViewportSize>({ width: 0, height: 0 });
  let fitted = props.initialCamera !== undefined;
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
  const boardOptions = createMemo(
    () => {
      const picker = boardPicker();
      if (!picker) return [];
      revision();
      return canInsertBoard(picker.revision)
        ? pcbBoardOptions(pcbBoardChoices(props.editor.getSnapshot()))
        : [];
    },
    [],
    {
      equals: (previous, next) =>
        previous.length === next.length &&
        previous.every(
          ({ value, label }, index) =>
            next[index]?.value === value && next[index]?.label === label,
        ),
    },
  );
  const collected = createMemo(() =>
    collectCadInput(props.editor.getSnapshot(), pageId, revision()),
  );
  const geometryElements = () => collected().elements;
  const sketch = createSketchAuthoring({
    editor: props.editor,
    pageId,
    revision,
    selection,
    tool,
    selectTool: () => props.onToolChange?.(Tool.Select),
    focus: () => root.focus(),
    picked,
    geometryElements,
    camera,
    changeCamera,
    size,
    renderer,
  });
  const extrude = createExtrudeAuthoring({
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
  });

  function canInsertBoard(version: number): boolean {
    const { editor } = props;
    return (
      !editor.readOnly &&
      editor.currentPageId === pageId &&
      editor.documentOpenRevision === version &&
      editor.canCreateOn(pageId, "cad.pcb")
    );
  }

  function closeBoardPicker(restoreFocus = true): void {
    setBoardPicker(undefined);
    if (restoreFocus) root.focus();
    props.onToolChange?.(Tool.Select);
  }

  function insertBoard(boardId: ElementId, version: number): void {
    const { editor } = props;
    if (
      canInsertBoard(version) &&
      editor.store.get(boardId)?.type === "pcb.board"
    ) {
      const elements = editor.store.getPageElements(pageId);
      const after = elements.reduce<string | undefined>(
        (last, { index }) =>
          last === undefined || last < index ? index : last,
        undefined,
      );
      const commands = pcbReferenceCommands(
        pageId,
        boardId,
        "PCB board",
        cadAuthoringIds(elements),
        after,
      );
      try {
        editor.apply(commands);
        const command = commands[0];
        if (command?.type === "createElement")
          editor.selection.set([command.element.id]);
      } catch (error) {
        if (!(error instanceof CommandError)) throw error;
        setBoardNotice(
          error.issues[0]?.message ?? "Could not insert the PCB board.",
        );
      }
    }
    closeBoardPicker();
  }

  createEffect(
    on(
      tool,
      (current) => {
        setBoardPicker(undefined);
        if (current !== Tool.Select) setBoardNotice(undefined);
        if (current !== Tool.CadPcb) return;
        const { editor } = props;
        const version = editor.documentOpenRevision;
        if (!canInsertBoard(version)) {
          closeBoardPicker();
          return;
        }
        const choices = pcbBoardChoices(editor.getSnapshot());
        const first = choices[0];
        if (!first) {
          setBoardNotice("This document has no PCB page with a board.");
          closeBoardPicker();
        } else if (choices.length === 1) {
          insertBoard(first.boardId, version);
        } else {
          setBoardPicker({ revision: version });
        }
      },
      { defer: true },
    ),
  );

  createEffect(() => {
    if (boardPicker() && boardOptions().length === 0) closeBoardPicker(false);
  });

  createEffect(
    on([selection, revision], () => setBoardNotice(undefined), { defer: true }),
  );

  function dismissBoardPicker(event: PointerEvent): void {
    if (
      !boardPicker() ||
      (boardMenu && event.composedPath().includes(boardMenu))
    )
      return;
    if (event.target === canvas) {
      event.preventDefault();
      event.stopPropagation();
      closeBoardPicker();
    } else {
      closeBoardPicker(false);
    }
  }

  function boardMenuKey(
    event: KeyboardEvent & { currentTarget: HTMLDivElement },
  ): void {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
    const indices = buttons.map((_, index) => index);
    const active = buttons.findIndex((item) => item === document.activeElement);
    const next =
      event.key === "Home"
        ? indices[0]
        : event.key === "End"
          ? indices.at(-1)
          : stepMenuIndex(indices, active, event.key === "ArrowDown" ? 1 : -1);
    if (next != null) buttons[next]?.focus();
  }

  function changeCamera(next: Camera3d): void {
    fitted = true;
    setCamera(next);
    props.onCameraChange?.(next);
  }

  function fit(): void {
    const { width, height } = size();
    if (sketch.drawing()) return;
    changeCamera(fitBodies(drawnBodies(), width / height));
  }

  function canImport(documentRevision: number): boolean {
    const { editor } = props;
    return (
      mounted &&
      !editor.readOnly &&
      editor.currentPageId === pageId &&
      editor.documentOpenRevision === documentRevision &&
      editor.canCreateOn(pageId, "cad.mesh")
    );
  }

  function openImportPicker(): void {
    const version = props.editor.documentOpenRevision;
    if (!canImport(version) || importing) return;
    pickerRevision = version;
    fileInput.click();
  }

  async function importStl(
    file: File,
    documentRevision: number,
  ): Promise<void> {
    if (!canImport(documentRevision) || importing) return;
    if (!/\.stl$/i.test(file.name)) {
      setImportNotice("Choose an STL file.");
      return;
    }
    if (file.size > STL_MAX_BYTES) {
      setImportNotice(STL_SIZE_ERROR);
      return;
    }
    const { editor } = props;
    importing = true;
    setImportNotice(undefined);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!canImport(documentRevision)) return;
      const elements = editor.store.getPageElements(pageId);
      const after = elements.reduce<string | undefined>(
        (last, { index }) =>
          last === undefined || last < index ? index : last,
        undefined,
      );
      const result = stlToMeshCommands(
        pageId,
        bytes,
        file.name,
        cadAuthoringIds(elements),
        after,
      );
      if ("error" in result) {
        setImportNotice(result.error);
        return;
      }
      editor.apply(result.commands);
      setImportNotice(STL_IMPORT_NOTE);
    } catch {
      if (canImport(documentRevision))
        setImportNotice("Could not import the STL file.");
    } finally {
      importing = false;
    }
  }

  onMount(() => {
    mounted = true;
    const registerImportPicker = props.onImportPicker;
    registerImportPicker?.(openImportPicker);
    const initialize = () =>
      setRenderer((props.createRenderer ?? createWebgl2Renderer)(canvas));
    initialize();
    root.focus();
    if (tool() === Tool.CadPcb) closeBoardPicker(false);
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
    document.addEventListener("pointerdown", dismissBoardPicker, true);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(root);
    measure();
    onCleanup(() => {
      mounted = false;
      registerImportPicker?.(undefined);
      unsubscribe();
      unsubscribeSelection();
      document.removeEventListener("pointerdown", dismissBoardPicker, true);
      if (tool() === Tool.CadPcb) closeBoardPicker(false);
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
    const source = collected();
    const input = {
      ...source,
      elements: source.elements.filter(
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
    setImportNotice(undefined);
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
    if (extrude.dragging()) return;
    const unit =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size().height : 1;
    const delta = event.deltaY * unit;
    if (Number.isFinite(delta))
      changeCamera(
        zoomAt(camera(), Math.exp(Math.max(-4, Math.min(4, delta / 400)))),
      );
  }

  const status = () =>
    boardNotice() ??
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
    if (
      boardPicker() &&
      ["Escape", "Backspace", "Delete"].includes(event.key)
    ) {
      if (isComposing(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") closeBoardPicker();
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
        transfer.dropEffect =
          canImport(props.editor.documentOpenRevision) && !importing
            ? "copy"
            : "none";
      }}
      on:drop={(event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return;
        event.preventDefault();
        event.stopPropagation();
        const version = props.editor.documentOpenRevision;
        if (!canImport(version) || importing) return;
        const file = files[0];
        if (files.length === 1 && file) void importStl(file, version);
        else setImportNotice("Drop one STL file at a time.");
      }}
    >
      <input
        ref={fileInput}
        type="file"
        accept=".stl"
        hidden
        on:change={() => {
          const file = fileInput.files?.[0];
          const version = pickerRevision;
          pickerRevision = undefined;
          fileInput.value = "";
          if (file && version !== undefined) void importStl(file, version);
        }}
      />
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
      <Show when={boardPicker()}>
        {(picker) => (
          <div
            ref={boardMenu}
            class="nodetto-context-menu"
            role="menu"
            aria-label="Choose a PCB board"
            style={{
              top: "8px",
              left: "8px",
              "max-height": "calc(100% - 16px)",
              "max-width": "calc(100% - 16px)",
              "overflow-y": "auto",
            }}
            on:keydown={boardMenuKey}
            on:focusout={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                !event.currentTarget.contains(event.relatedTarget)
              )
                closeBoardPicker(false);
            }}
          >
            <For each={boardOptions()}>
              {(option, index) => (
                <button
                  ref={(button) => {
                    if (index() === 0)
                      queueMicrotask(() => {
                        if (button.isConnected) button.focus();
                      });
                  }}
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="nodetto-menu-item"
                  onClick={() => insertBoard(option.value, picker().revision)}
                >
                  <span class="nodetto-menu-label">{option.label}</span>
                </button>
              )}
            </For>
          </div>
        )}
      </Show>
      <Show when={importNotice() || status()}>
        <div class="nodetto-cad-status" role="status">
          {[importNotice(), status()].filter(Boolean).join(" ")}
        </div>
      </Show>
    </div>
  );
}
