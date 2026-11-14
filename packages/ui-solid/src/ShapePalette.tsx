import { Portal } from "solid-js/web";
import { paletteDragPreview } from "./palette-drag.ts";
import { ShapeView } from "./shapes/ShapeView.tsx";
import type { Editor, Vec } from "@nodetto/core";
import { For, Show, createSignal, type JSX, onCleanup } from "solid-js";
import { createEditorSignals } from "./adapter.ts";
import {
  PALETTE_ICONS,
  type ShapePaletteItem,
  shapePaletteGroups,
} from "./shape-palette.ts";
import {
  type ActionContext,
  type ActionId,
  actionTitle,
  getAction,
  runAction,
} from "./shortcuts.ts";
import {
  creationFor,
  canUseTool,
  isConnectorTool,
  Tool,
  type ToolKind,
} from "./tools.ts";
import type { WorkspaceId } from "./workspaces.ts";
import { searchPaletteShapes } from "./shape-search.ts";
import "./ShapePalette.css";

export function ShapePalette(props: {
  readonly editor: Editor;
  readonly workspace: WorkspaceId;
  readonly tool: ToolKind;
  readonly onToolChange: (tool: ToolKind) => void;
  readonly context: ActionContext;
  readonly onShapeDrop?: (tool: ToolKind, client: Vec) => void;
}): JSX.Element {
  let drag:
    | {
        id: number;
        tool: ToolKind;
        x: number;
        y: number;
        moved: boolean;
        target: HTMLButtonElement;
        page: string;
        documentRevision: number;
      }
    | undefined;
  let suppressClick = false;
  const [preview, setPreview] = createSignal<
    | (NonNullable<ReturnType<typeof paletteDragPreview>> & { client: Vec })
    | null
  >(null);
  const cancelDrag = () => {
    const ended = drag;
    drag = undefined;
    setPreview(null);
    if (ended) {
      suppressClick = ended.moved;
      if (ended.target.hasPointerCapture(ended.id))
        ended.target.releasePointerCapture(ended.id);
    }
  };
  const currentDrag = () =>
    drag &&
    !props.editor.readOnly &&
    drag.page === props.editor.currentPageId &&
    drag.documentRevision === props.editor.documentOpenRevision;
  window.addEventListener("blur", cancelDrag);
  const cancelKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      suppressClick = drag?.moved ?? false;
      cancelDrag();
    }
  };
  const move = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return;
    if (!currentDrag()) {
      cancelDrag();
      return;
    }
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4)
      drag.moved = true;
    if (drag.moved) {
      const model = preview() ?? paletteDragPreview(props.editor, drag.tool);
      if (model)
        setPreview({
          ...model,
          client: { x: event.clientX, y: event.clientY },
        });
    }
  };
  const end = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return;
    const ended = drag;
    const valid = currentDrag();
    cancelDrag();
    if (ended.moved && valid)
      props.onShapeDrop?.(ended.tool, { x: event.clientX, y: event.clientY });
  };
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", end, true);
  const cancelPointer = (event: PointerEvent) => {
    if (drag?.id === event.pointerId) cancelDrag();
  };
  window.addEventListener("pointercancel", cancelPointer, true);
  window.addEventListener("keydown", cancelKey, true);
  onCleanup(() => {
    window.removeEventListener("blur", cancelDrag);
    window.removeEventListener("keydown", cancelKey, true);
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", end, true);
    window.removeEventListener("pointercancel", cancelPointer, true);
    cancelDrag();
  });
  const [query, setQuery] = createSignal("");
  const results = () => searchPaletteShapes(query());
  const signals = createEditorSignals(props.editor);
  const readOnly = () => {
    signals.rev();
    return props.editor.readOnly;
  };
  const enabled = (id: ActionId): boolean => {
    signals.rev();
    signals.selection();
    return !readOnly() && getAction(id).enabled(props.context);
  };
  const tiles = (items: readonly ShapePaletteItem[]) => (
    <div class="nodetto-shape-grid">
      <For each={items}>
        {(item) => (
          <button
            type="button"
            class="nodetto-shape-tile"
            aria-label={`Draw ${item.label.toLowerCase()}`}
            aria-pressed={props.tool === item.tool}
            title={
              item.tool === Tool.Relation
                ? "Relation — connect columns to document a join path; no database constraint or DDL"
                : item.tool === Tool.ForeignKey
                  ? "Foreign key — connect columns with an enforced database constraint included in DDL"
                  : item.tool === Tool.View
                    ? "View — a saved database query"
                    : item.tool === Tool.MaterializedView
                      ? "Materialized view — stored query results"
                      : item.tool === Tool.Function
                        ? "Function — a callable routine that returns a value"
                        : item.tool === Tool.Procedure
                          ? "Procedure — a callable sequence of database operations"
                          : item.tool === Tool.Freehand
                            ? "Freehand — drag on the canvas"
                            : isConnectorTool(item.tool)
                              ? `${item.label} — drag from one shape to another`
                              : item.tool === Tool.Port
                                ? "Port — click a component boundary"
                                : `${item.label} — select, then click the canvas`
            }
            on:pointerdown={(event) => {
              if (event.button !== 0 || !creationFor(item.tool) || readOnly())
                return;
              event.preventDefault();
              suppressClick = false;
              drag = {
                id: event.pointerId,
                tool: item.tool,
                x: event.clientX,
                y: event.clientY,
                moved: false,
                target: event.currentTarget,
                page: props.editor.currentPageId,
                documentRevision: props.editor.documentOpenRevision,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onLostPointerCapture={(event) => {
              if (drag?.id === event.pointerId) cancelDrag();
            }}
            onDragStart={(event) => event.preventDefault()}
            disabled={!canUseTool(item.tool, readOnly())}
            onClick={() => {
              if (suppressClick) {
                suppressClick = false;
                return;
              }
              if (canUseTool(item.tool, props.editor.readOnly))
                props.onToolChange(item.tool);
            }}
          >
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d={PALETTE_ICONS[item.icon]} />
            </svg>
            <span>{item.label}</span>
          </button>
        )}
      </For>
    </div>
  );
  const action = (id: ActionId, label: string) => (
    <button
      type="button"
      class="nodetto-palette-action"
      title={actionTitle(getAction(id))}
      disabled={!enabled(id)}
      onClick={() => runAction(getAction(id), props.context)}
    >
      {label}
    </button>
  );
  return (
    <section
      class="nodetto-shape-palette"
      aria-label="Shape palette"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          props.onToolChange(Tool.Select);
        }
      }}
    >
      <Show when={!readOnly() && preview()}>
        {(model) => (
          <Portal>
            <div
              class="nodetto-palette-drag-preview"
              aria-hidden="true"
              style={{
                width: `${model().box.width}px`,
                height: `${model().box.height}px`,
                transform: `translate3d(${model().client.x - (model().box.width * signals.camera().z) / 2}px, ${model().client.y - (model().box.height * signals.camera().z) / 2}px, 0) scale(${signals.camera().z})`,
              }}
            >
              <ShapeView
                element={model().element}
                box={model().box}
                selected={false}
              />
            </div>
          </Portal>
        )}
      </Show>
      <input
        type="search"
        class="nodetto-palette-search"
        placeholder="Search shapes"
        aria-label="Search shapes"
        title="Search every shape by name, shape ID or category, such as actor or uml"
        value={query()}
        onInput={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && query()) {
            event.preventDefault();
            event.stopPropagation();
            setQuery("");
          }
        }}
      />
      <Show
        when={query().trim()}
        fallback={
          <For each={shapePaletteGroups(props.workspace)}>
            {(group, index) => (
              <details class="nodetto-palette-section" open={index() === 0}>
                <summary>{group.label}</summary>
                {tiles(group.items)}
              </details>
            )}
          </For>
        }
      >
        <Show
          when={results().length}
          fallback={
            <p class="nodetto-palette-empty" role="status">
              No shapes match.
            </p>
          }
        >
          <section class="nodetto-palette-results" aria-label="Matching shapes">
            {tiles(results())}
          </section>
        </Show>
      </Show>
      <div class="nodetto-palette-actions" role="group" aria-label="Grouping">
        {action("frameSelection", "Frame selection")}
        {action("group", "Group")}
        {action("ungroup", "Ungroup")}
      </div>
    </section>
  );
}
