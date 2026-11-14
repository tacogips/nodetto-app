import { paletteDropInsideCanvas } from "./palette-drag.ts";
// The canvas: one CSS-transformed viewport holding four layers.
//
//   0. on pages with connectors, a DOM layer for frames, which are surfaces
//      the connectors must stay visible on (see core backdrops.ts)
//   1. an SVG layer for connectors (drawn under everything else, like ink)
//   2. a DOM layer for box shapes
//   3. an SVG overlay for selection outlines, handles and snap guides
//   4. a DOM slot for whatever the shell mounts in page space (the inline
//      text editor); its children take pointer events
//
// The single transform on the viewport is the camera equation
// `screen = (page + camera) * zoom` spelled as `scale(z) translate(x, y)`,
// which is why child coordinates are page coordinates everywhere below.
//
// Layers 1 and 2 do not take pointer events: picking goes through the core's
// hit test so that the transparent corner of an ellipse misses it. Only the
// handles and the slot layer opt back in.
//
// The layer contents live under ./canvas/: shape, group and connector
// rendering (visual-units), the handle targets the overlay derives from the
// selection (overlay-targets), the overlay components themselves, image
// file drops, and the editor-wide navigation keys.

import type { Box, Editor, Vec, ViewportSize } from "@nodetto/core";
import { connectorBackdropIds, groupOf } from "@nodetto/core";
import type { Element, ElementId } from "@nodetto/ir";
import {
  CANVAS_DARK_CLASS,
  canvasModeFor,
  type CanvasBackgroundSetting,
} from "./canvas/canvas-background.ts";
import {
  batch,
  createMemo,
  createEffect,
  untrack,
  createSelector,
  createSignal,
  For,
  type JSX,
  lazy,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import { createEditorSignals } from "./adapter.ts";
import { FreehandInput } from "./FreehandInput.tsx";
import { installRasterMaskSampler } from "./raster-mask-sampler.ts";
import {
  createInteraction,
  type EditRegion,
  SLOT_LAYER_CLASS,
  type SnapSettings,
} from "./interaction.ts";
import { ConnectorMarkers } from "./shapes/ConnectorView.tsx";
import { BreadboardOverlay } from "./BreadboardOverlay.tsx";
import { PcbOverlay } from "./PcbOverlay.tsx";
import { PcbLayersPanel } from "./PcbLayersPanel.tsx";
import { pcbHiddenLayers } from "./pcb-state.ts";
import type { ToolKind } from "./tools.ts";
import { ConnectorEditHandles } from "./canvas/ConnectorEditHandles.tsx";
import { EditHandles } from "./canvas/EditHandles.tsx";
import { GRID_SPACING, isConnector } from "./canvas/geometry.ts";
import { createImageDrop, ImageDropStatus } from "./canvas/image-drop.tsx";
import { listenForNavigationKeys } from "./canvas/navigation-keys.ts";
import { createOverlayTargets } from "./canvas/overlay-targets.ts";
import { SelectionOutlines } from "./canvas/SelectionOutlines.tsx";
import { TransformHandles } from "./canvas/TransformHandles.tsx";
import { createVisualUnitRenderer } from "./canvas/visual-units.tsx";

const CanvasRulers = lazy(() => import("./CanvasRulers.tsx"));

export interface NodettoCanvasProps {
  readonly editor: Editor;
  readonly tool: ToolKind;
  readonly onToolChange?: (tool: ToolKind) => void;
  readonly shapeDrop?: { readonly tool: ToolKind; readonly client: Vec };
  /** Fires as the marquee rectangle changes; `null` when the drag ends. */
  readonly onMarquee?: (rect: Box | null) => void;
  /** Review tool callback; point is already transformed into page space. */
  readonly onCommentPlace?: (point: Vec) => void;
  /** Snapping switches for drags (design 6). */
  readonly snap: SnapSettings;
  /** False hides the dotted background. */
  readonly showGrid: boolean;
  readonly showRulers?: boolean;
  /** Resolved light/dark canvas per page kind; omitted keeps every page light. */
  readonly canvasBackground?: CanvasBackgroundSetting;
  /** Double-click, Enter/F2, or a freshly placed text element. */
  readonly onEditRequest?: (id: ElementId, region: EditRegion) => void;
  /** Right-click or Shift+F10; `hit` is the group-resolved element. */
  readonly onContextMenu?: (
    at: { readonly screen: Vec; readonly page: Vec },
    hit: ElementId | null,
  ) => void;
  /** Reported on mount and whenever the canvas element changes size. */
  readonly onViewportResize?: (size: ViewportSize) => void;
  /** Rendered in page space above the overlay; receives pointer events. */
  readonly children?: JSX.Element;
}

export function NodettoCanvas(props: NodettoCanvasProps): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const [probeRevision, setProbeRevision] = createSignal(0);
  onCleanup(
    props.editor.onBreadboardProbeChange(() =>
      setProbeRevision((value) => value + 1),
    ),
  );
  const readOnly = () => {
    signals.rev();
    return props.editor.readOnly;
  };
  let container: HTMLDivElement | undefined;
  const [viewport, setViewport] = createSignal<ViewportSize>({
    width: 0,
    height: 0,
  });
  const imageDrop = createImageDrop(props, () => container);

  const interaction = createInteraction(props.editor, {
    tool: () => props.tool,
    setTool: (tool) => props.onToolChange?.(tool),
    container: () => container,
    scheduleDragFrame: (callback) => {
      const frame = requestAnimationFrame(() => batch(callback));
      return () => cancelAnimationFrame(frame);
    },
    onMarquee: (rect) => props.onMarquee?.(rect),
    onCommentPlace: (point) => props.onCommentPlace?.(point),
    snap: () => props.snap,
    viewport,
    onEditRequest: (id, region) => props.onEditRequest?.(id, region),
    onContextMenu: (at, hit) => props.onContextMenu?.(at, hit),
  });

  createEffect(() => {
    const drop = props.shapeDrop;
    const bounds = container?.getBoundingClientRect();
    if (!drop || !bounds || !container) return;
    const hit = document.elementFromPoint(drop.client.x, drop.client.y);
    const uncovered =
      hit?.closest(".nodetto-canvas") === container &&
      !hit?.closest(`.${SLOT_LAYER_CLASS}`);
    if (!paletteDropInsideCanvas(bounds, drop.client, uncovered)) return;
    untrack(() =>
      interaction.placeTool(
        drop.tool,
        props.editor.camera.screenToPage({
          x: drop.client.x - bounds.left,
          y: drop.client.y - bounds.top,
        }),
      ),
    );
    container?.focus();
  });

  onMount(() => {
    onCleanup(installRasterMaskSampler(props.editor));
    const element = container;
    if (!element) {
      return;
    }
    element.focus();
    onCleanup(listenForNavigationKeys(element, interaction));
    const report = (): void => {
      const rect = element.getBoundingClientRect();
      const size = { width: rect.width, height: rect.height };
      setViewport(size);
      props.onViewportResize?.(size);
    };
    report();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(report);
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    }
  });
  // A nudge batch still waiting on its timer must not outlive the canvas.
  onCleanup(() => interaction.dispose());

  const cameraZoom = createMemo(() => signals.camera().z);
  const isBreadboardPage = createMemo(() => {
    signals.rev();
    return (
      props.editor.store.getPage(props.editor.currentPageId)?.kind ===
      "breadboard"
    );
  });
  const isPcbPage = createMemo(() => {
    signals.rev();
    return (
      props.editor.store.getPage(props.editor.currentPageId)?.kind === "pcb"
    );
  });
  const canvasMode = createMemo(() => {
    signals.rev();
    return canvasModeFor(
      props.editor.store.getPage(props.editor.currentPageId)?.kind,
      props.canvasBackground,
    );
  });
  const context = createMemo(() => {
    signals.rev();
    return props.editor.createShapeContext(cameraZoom());
  });

  const elements = createMemo<readonly Element[]>(() => {
    signals.rev();
    return props.editor.store
      .getPageElements(props.editor.currentPageId)
      .filter(
        (element) =>
          !context().isHidden?.(element.id) &&
          !context().isMaskSource?.(element.id),
      );
  });

  const connectors = createMemo(() =>
    elements().filter(
      (element) =>
        isConnector(element) && !groupOf(props.editor.store, element.id),
    ),
  );

  // Frames painted beneath the connector layer (see core backdrops.ts).
  const backdropIds = createMemo(() =>
    connectorBackdropIds(
      elements(),
      (id) => groupOf(props.editor.store, id) !== null,
    ),
  );

  const backdropRoots = createMemo(() =>
    elements().filter((element) => backdropIds().has(element.id)),
  );

  const visualRoots = createMemo(() =>
    elements().filter(
      (element) =>
        !isConnector(element) &&
        !groupOf(props.editor.store, element.id) &&
        !backdropIds().has(element.id),
    ),
  );

  const isSelected = createSelector(signals.selection, (id: ElementId, ids) =>
    ids.has(id),
  );

  const zoom = cameraZoom;
  const targets = createOverlayTargets({
    props,
    signals,
    readOnly,
    context,
    zoom,
    interaction,
  });
  const { renderStableVisualUnit, renderConnector } = createVisualUnitRenderer({
    props,
    rev: signals.rev,
    context,
    isSelected,
  });

  return (
    <div
      ref={container}
      class="nodetto-canvas"
      classList={{
        [`nodetto-tool-${props.tool.replace(":", "-")}`]: true,
        [CANVAS_DARK_CLASS]: canvasMode() === "dark",
        "nodetto-grid-hidden": !props.showGrid,
        "nodetto-space-pan": interaction.temporaryHand(),
        "nodetto-panning": interaction.panning(),
        "nodetto-connecting": interaction.pending() !== null,
        "nodetto-image-drop-active": imageDrop.active(),
      }}
      tabindex="0"
      style={{
        "background-size": `${GRID_SPACING * signals.camera().z}px ${
          GRID_SPACING * signals.camera().z
        }px`,
        "background-position": `${signals.camera().x * signals.camera().z}px ${
          signals.camera().y * signals.camera().z
        }px`,
      }}
      onPointerDown={interaction.onPointerDown}
      onPointerMove={interaction.onPointerMove}
      onPointerUp={interaction.onPointerUp}
      onPointerCancel={interaction.onPointerCancel}
      onWheel={interaction.onWheel}
      onKeyDown={interaction.onKeyDown}
      onKeyUp={interaction.onKeyUp}
      onDblClick={interaction.onDoubleClick}
      onContextMenu={interaction.onContextMenu}
      onBlur={() => interaction.onBlur()}
      onDragEnter={(event) => imageDrop.onDragEnter(event)}
      onDragOver={(event) => imageDrop.onDragOver(event)}
      onDragLeave={(event) => imageDrop.onDragLeave(event)}
      onDrop={(event) => imageDrop.onDrop(event)}
    >
      <div
        class="nodetto-viewport"
        style={{
          transform: `scale(${signals.camera().z}) translate(${
            signals.camera().x
          }px, ${signals.camera().y}px)`,
        }}
      >
        <Show when={backdropRoots().length > 0}>
          <div class="nodetto-layer nodetto-shape-layer nodetto-backdrop-layer">
            <For each={backdropRoots().map((element) => element.id)}>
              {(id) => renderStableVisualUnit(id)}
            </For>
          </div>
        </Show>

        <svg class="nodetto-layer nodetto-connector-layer">
          <title>Connectors</title>
          <ConnectorMarkers />
          <For each={connectors().map((element) => element.id)}>
            {(id) => renderConnector(id)}
          </For>
          <Show when={interaction.pending()}>
            {(pending) => (
              <line
                class="nodetto-pending-connection"
                x1={pending().from.x}
                y1={pending().from.y}
                x2={pending().to.x}
                y2={pending().to.y}
              />
            )}
          </Show>
        </svg>

        <div class="nodetto-layer nodetto-shape-layer">
          <For each={visualRoots().map((element) => element.id)}>
            {(id) => renderStableVisualUnit(id)}
          </For>
        </div>

        <svg class="nodetto-layer nodetto-overlay-layer">
          <title>Selection</title>
          <Show when={isBreadboardPage()}>
            <BreadboardOverlay
              editor={props.editor}
              revision={signals.rev}
              selection={signals.selection}
              hover={interaction.breadboardHover}
              probeRevision={probeRevision}
              wireDraft={interaction.wireDraft}
              startWirePoint={interaction.startBreadboardWirePoint}
            />
          </Show>
          <Show when={isPcbPage()}>
            <PcbOverlay
              editor={props.editor}
              revision={signals.rev}
              highlightedNet={interaction.pcbHover}
              hidden={() => pcbHiddenLayers(props.editor.currentPageId)}
              draft={interaction.pcbDraft}
            />
          </Show>
          <SelectionOutlines
            marquee={interaction.marquee}
            selectionBoxes={targets.selectionBoxes}
            hoverBox={targets.hoverBox}
            guides={interaction.guides}
            selectionResizeTarget={targets.selectionResizeTarget}
          />
          <TransformHandles
            resizeTarget={targets.resizeTarget}
            selectionResizeTarget={targets.selectionResizeTarget}
            rotateTarget={targets.rotateTarget}
            zoom={zoom}
            interaction={interaction}
          />
          <ConnectorEditHandles
            editor={props.editor}
            connectionTargets={targets.connectionTargets}
            connectorHandles={targets.connectorHandles}
            zoom={zoom}
            interaction={interaction}
          />
          <EditHandles
            editor={props.editor}
            tool={props.tool}
            single={targets.single}
            cropTarget={targets.cropTarget}
            gradientTarget={targets.gradientTarget}
            zoom={zoom}
            container={() => container}
          />
        </svg>

        <div class={`nodetto-layer ${SLOT_LAYER_CLASS}`}>{props.children}</div>
      </div>
      <Show when={isPcbPage()}>
        <PcbLayersPanel editor={props.editor} revision={signals.rev} />
      </Show>
      <Show when={!readOnly() && props.tool === "draw.freehand"}>
        <FreehandInput editor={props.editor} />
      </Show>
      <Show when={props.showRulers !== false}>
        <Suspense>
          <CanvasRulers
            editor={props.editor}
            viewport={viewport()}
            container={() => container}
          />
        </Suspense>
      </Show>
      <ImageDropStatus drop={imageDrop} />
    </div>
  );
}
