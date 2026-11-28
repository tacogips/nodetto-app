import "./ShapeWarnings.css";
import { Switch } from "./Switch.tsx";
import {
  canRenameLayer,
  type Editor,
  type ViewportSize,
  layerRows,
  layerName,
  shapeAuthoringWarnings,
  selectLayerRow,
  selectLayerSearchMatches,
} from "@nodetto/core";
import { type ElementId, isCadTypeName } from "@nodetto/ir";
import {
  createMemo,
  createSelector,
  createEffect,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
  untrack,
  onMount,
} from "solid-js";
import { createEditorSignals } from "./adapter.ts";
import { handleCadSelectionKey } from "./cad/selection-keys.ts";
import { cadInspectionFor } from "./cad/inspection.ts";
import { useCadStatus } from "./cad/status-store.ts";
import { ComponentLibrary } from "./ComponentLibrary.tsx";
import { ColorTokens } from "./ColorTokens.tsx";
import { NumberTokens } from "./NumberTokens.tsx";
import { ReviewComments } from "./ReviewComments.tsx";
import { TypographyStyles } from "./TypographyStyles.tsx";
import { LayerRenameInput } from "./LayerRenameInput.tsx";
import { layerNavigation } from "./layer-keyboard.ts";
import { layerWindow } from "./layer-window.ts";
import { HelpHint } from "./HelpHint.tsx";
import "./Layers.css";

export function Layers(props: {
  readonly editor: Editor;
  readonly simple?: boolean;
  readonly viewport?: ViewportSize;
  readonly commentAuthor?: string;
  readonly commentRequest?: number;
  readonly commentPlacementActive?: boolean;
  readonly onPlaceComment?: (
    input: {
      readonly author: string;
      readonly body: string;
    },
    onPlaced: () => void,
  ) => void;
  readonly onCancelCommentPlacement?: () => void;
  /** Whether the layer tree section is expanded; uncontrolled when unset. */
  readonly layersOpen?: boolean;
  readonly onLayersOpenChange?: (open: boolean) => void;
}): JSX.Element {
  const [localLayersOpen, setLocalLayersOpen] = createSignal(true);
  const layersOpen = () => props.layersOpen ?? localLayersOpen();
  const signals = createEditorSignals(props.editor);
  const statusFor = useCadStatus(props.editor);
  const isSelected = createSelector(signals.selection, (id: ElementId, ids) =>
    ids.has(id),
  );
  const readOnly = signals.readOnly;
  const [query, setQuery] = createSignal("");
  const [allPages, setAllPages] = createSignal(false);
  const [renaming, setRenaming] = createSignal<ElementId>();
  let draggedFeature:
    | { id: ElementId; documentOpenRevision: number }
    | undefined;
  createEffect(() => {
    if (readOnly()) setRenaming(undefined);
  });
  const [componentsMounted, mountComponents] = createSignal(false);
  const [stylesMounted, mountStyles] = createSignal(false);
  const [commentsMounted, mountComments] = createSignal(false);
  let commentsPanel: HTMLDetailsElement | undefined;
  createEffect(() => {
    if (props.commentRequest && commentsPanel) {
      mountComments(true);
      commentsPanel.open = true;
    }
  });
  let selectionAnchor: ElementId | undefined;
  let searchInput: HTMLInputElement | undefined;
  const nameButtons = new Map<ElementId, HTMLButtonElement>();
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<ElementId>>(
    new Set(),
  );
  const rows = createMemo(() => {
    signals.rev();
    if (allPages())
      return props.editor.store
        .listPages()
        .flatMap((page) =>
          layerRows(props.editor, collapsed(), query(), page.id),
        );
    return layerRows(props.editor, collapsed(), query());
  });
  const toggle = (id: ElementId): void => {
    const next = new Set(collapsed());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };
  const searchMatches = createMemo(() => {
    signals.rev();
    if (!query().trim()) return [];
    const context = props.editor.createShapeContext();
    return rows().filter(
      (row) =>
        row.matched &&
        row.element.page === props.editor.currentPageId &&
        !context.isLocked?.(row.element.id),
    );
  });
  const warningContext = createMemo(() => {
    signals.rev();
    return props.editor.createShapeContext();
  });
  const warningsFor = (id: ElementId) => {
    // Follow only the records this layer's warnings read, where its type
    // allows: one row per element makes "every commit" a cost per element.
    const context = signals.scene.track(id)
      ? untrack(warningContext)
      : warningContext();
    const element = props.editor.store.get(id);
    return element ? shapeAuthoringWarnings(element, context) : [];
  };
  type Row = ReturnType<typeof layerRows>[number];
  // One signal per row, written only when that row's content changes: a
  // commit that moves one element then touches one row, not one computation
  // per attribute of every row in the panel.
  const rowSignals = new Map<
    ElementId,
    { readonly read: () => Row; readonly write: (row: Row) => void }
  >();
  const rowIds = createMemo<readonly ElementId[]>((previous) => {
    const current = rows();
    const live = new Set<ElementId>();
    for (const row of current) {
      const id = row.element.id;
      live.add(id);
      const signal = rowSignals.get(id);
      if (!signal) {
        const [read, write] = createSignal(row);
        rowSignals.set(id, { read, write: (next) => write(() => next) });
        continue;
      }
      const old = untrack(signal.read);
      if (
        old.element !== row.element ||
        old.depth !== row.depth ||
        old.hasChildren !== row.hasChildren ||
        old.matched !== row.matched ||
        old.matchDetail !== row.matchDetail
      )
        signal.write(row);
    }
    for (const id of rowSignals.keys())
      if (!live.has(id)) rowSignals.delete(id);
    return previous.length === current.length &&
      current.every((row, index) => row.element.id === previous[index])
      ? previous
      : current.map((row) => row.element.id);
  }, []);
  // A long list mounts only the rows near the scrolled view. What scrolls
  // is the host's choice: this panel, or the pane it is stacked in.
  let nav: HTMLElement | undefined;
  let scroller: HTMLElement | undefined;
  let rowsHost: HTMLDivElement | undefined;
  const [layerView, setLayerView] = createSignal(
    { scrollTop: 0, viewHeight: 0, rowsTop: 0, rowHeight: 0 },
    {
      equals: (a, b) =>
        a.scrollTop === b.scrollTop &&
        a.viewHeight === b.viewHeight &&
        a.rowsTop === b.rowsTop &&
        a.rowHeight === b.rowHeight,
    },
  );
  const measureLayerView = (): void => {
    if (!scroller || !rowsHost) return;
    const row = rowsHost.querySelector<HTMLElement>(".nodetto-layer-row");
    setLayerView({
      scrollTop: scroller.scrollTop,
      viewHeight: scroller.clientHeight,
      rowsTop:
        rowsHost.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop,
      rowHeight: row?.offsetHeight || untrack(layerView).rowHeight,
    });
  };
  onMount(() => {
    if (!nav) return;
    let host: HTMLElement = nav;
    for (let at: HTMLElement | null = nav; at; at = at.parentElement) {
      const overflow = getComputedStyle(at).overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        host = at;
        break;
      }
    }
    scroller = host;
    measureLayerView();
    host.addEventListener("scroll", measureLayerView, { passive: true });
    // Sections above the rows opening or closing move where the rows start.
    host.addEventListener("toggle", measureLayerView, true);
    onCleanup(() => {
      host.removeEventListener("scroll", measureLayerView);
      host.removeEventListener("toggle", measureLayerView, true);
    });
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureLayerView);
    observer.observe(host);
    onCleanup(() => observer.disconnect());
  });
  const mountedRows = createMemo(() => {
    const ids = rowIds();
    // Search hits and all-pages rows carry extra lines of varying height.
    if (query().trim() || allPages()) return { ids, before: 0, after: 0 };
    const kept = renaming();
    const range = layerWindow({
      ...layerView(),
      count: ids.length,
      ...(kept === undefined ? {} : { keep: ids.indexOf(kept) }),
    });
    return {
      ids:
        range.start === 0 && range.end === ids.length
          ? ids
          : ids.slice(range.start, range.end),
      before: range.before,
      after: range.after,
    };
  });
  /** Scroll so the row of `id` is mounted and in view, before focusing it. */
  const revealRow = (id: ElementId): void => {
    const view = layerView();
    const index = rowIds().indexOf(id);
    if (!scroller || index < 0 || !(view.rowHeight > 0)) return;
    const top = view.rowsTop + index * view.rowHeight;
    if (
      top < scroller.scrollTop ||
      top + view.rowHeight > scroller.scrollTop + scroller.clientHeight
    )
      scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 2);
    measureLayerView();
  };
  return (
    <nav ref={nav} class="nodetto-layers" aria-label="Layers">
      <div hidden={props.simple}>
        <details
          class="nodetto-navigation-group"
          onToggle={(event) => {
            if (event.currentTarget.open) mountComponents(true);
          }}
        >
          <summary>Reusable components</summary>
          <Show when={componentsMounted()}>
            <ComponentLibrary editor={props.editor} showHeading={false} />
          </Show>
        </details>
        <details
          class="nodetto-navigation-group"
          onToggle={(event) => {
            if (event.currentTarget.open) mountStyles(true);
          }}
        >
          <summary>Shared styles</summary>
          <Show when={stylesMounted()}>
            <fieldset
              disabled={readOnly()}
              style={{ border: "none", margin: 0, padding: 0, "min-width": 0 }}
            >
              <details class="nodetto-navigation-group">
                <summary>Colors</summary>
                <ColorTokens editor={props.editor} />
              </details>
              <details class="nodetto-navigation-group">
                <summary>Sizes and spacing</summary>
                <NumberTokens editor={props.editor} />
              </details>
              <details class="nodetto-navigation-group">
                <summary>Text styles</summary>
                <TypographyStyles editor={props.editor} />
              </details>
            </fieldset>
          </Show>
        </details>
      </div>
      <details
        class="nodetto-navigation-group"
        ref={commentsPanel}
        open={props.commentPlacementActive}
        onToggle={(event) => {
          if (event.currentTarget.open) mountComments(true);
        }}
      >
        <summary>Comments</summary>
        <Show when={commentsMounted() || props.commentPlacementActive}>
          <ReviewComments
            showHeading={false}
            editor={props.editor}
            viewport={props.viewport}
            author={props.commentAuthor}
            request={props.commentRequest}
            commentPlacementActive={props.commentPlacementActive}
            onPlaceComment={props.onPlaceComment}
            onCancelCommentPlacement={props.onCancelCommentPlacement}
          />
        </Show>
      </details>
      <details
        class="nodetto-navigation-group nodetto-layers-tree"
        open={layersOpen()}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          if (open === layersOpen()) return;
          setLocalLayersOpen(open);
          props.onLayersOpenChange?.(open);
        }}
      >
        <summary>
          Layers{" "}
          {/* The hint is a button: keep its click from folding the section. */}
          <span
            class="nodetto-summary-hint"
            onClick={(event) => event.preventDefault()}
          >
            <HelpHint
              text={`Shift-click selects a range; Ctrl/Cmd-click toggles a layer. ${readOnly() ? "" : "Double-click a name or press F2 to rename. "}Use Up/Down or Home/End to select, Shift to extend, and Left/Right to navigate the hierarchy.`}
            />
          </span>
        </summary>
        <label class="nodetto-layers-all-pages">
          <Switch
            checked={allPages()}
            onChange={(event) => setAllPages(event.currentTarget.checked)}
          />
          All pages
        </label>
        <input
          type="search"
          ref={searchInput}
          aria-label="Search layers"
          placeholder="Search layers"
          title="Search by name, content, column or type"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          on:keydown={(event) => event.stopPropagation()}
          on:keyup={(event) => event.stopPropagation()}
          style={{
            width: "calc(100% - 16px)",
            margin: "0 8px",
            "box-sizing": "border-box",
          }}
        />
        <Show when={query().trim()}>
          <button
            type="button"
            class="nodetto-select-matches"
            aria-label={`Select matches (${searchMatches().length})`}
            disabled={!searchMatches().length}
            title="Select editable search hits on the current page, excluding context-only ancestors"
            onClick={() => {
              selectLayerSearchMatches(props.editor, query());
              selectionAnchor = undefined;
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5 2H2v3m9-3h3v3M2 11v3h3m9-3v3h-3M5 8l2 2 4-4" />
            </svg>
            <span>Select matches</span>
            <span class="nodetto-select-matches-count" aria-hidden="true">
              {searchMatches().length}
            </span>
          </button>
        </Show>
        <div
          ref={rowsHost}
          style={{
            "padding-top": `${mountedRows().before}px`,
            "padding-bottom": `${mountedRows().after}px`,
          }}
        >
          <For each={mountedRows().ids}>
            {(id) => (
              <Show when={rowSignals.get(id)?.read()}>
                {(row) => {
                  const warning = createMemo(() => warningsFor(id).join("\n"));
                  const cad = () => isCadTypeName(row().element.type);
                  const feature = () => cad() && canRenameLayer(row().element);
                  const statusCode = createMemo(() => {
                    if (!cad()) return undefined;
                    const status = statusFor(id);
                    return status && !status.ok ? status.code : undefined;
                  });
                  const canDrag = () =>
                    !readOnly() &&
                    feature() &&
                    row().element.page === props.editor.currentPageId &&
                    !query().trim() &&
                    !props.editor.createShapeContext().isLocked?.(id);
                  const dropSource = (): ElementId | undefined => {
                    if (
                      !draggedFeature ||
                      draggedFeature.id === id ||
                      draggedFeature.documentOpenRevision !==
                        props.editor.documentOpenRevision ||
                      readOnly() ||
                      query().trim() ||
                      !feature() ||
                      row().element.page !== props.editor.currentPageId ||
                      props.editor
                        .createShapeContext()
                        .isLocked?.(draggedFeature.id)
                    )
                      return undefined;
                    return props.editor.store.get(draggedFeature.id)?.page ===
                      row().element.page
                      ? draggedFeature.id
                      : undefined;
                  };
                  let nameButton: HTMLButtonElement | undefined;
                  onCleanup(() => {
                    nameButtons.delete(id);
                    if (renaming() === id) setRenaming(undefined);
                  });
                  const startRename = (): void => {
                    if (props.editor.readOnly || !canRenameLayer(row().element))
                      return;
                    if (!props.editor.createShapeContext().isLocked?.(id))
                      setRenaming(id);
                  };
                  return (
                    <div
                      class="nodetto-layer-row"
                      style={{ "padding-left": `${8 + row().depth * 14}px` }}
                      onDragOver={(event) => {
                        if (!dropSource()) return;
                        event.preventDefault();
                        if (event.dataTransfer)
                          event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        const source = dropSource();
                        if (!source) return;
                        event.preventDefault();
                        draggedFeature = undefined;
                        const bounds =
                          event.currentTarget.getBoundingClientRect();
                        props.editor.orderElements(
                          [source],
                          event.clientY < bounds.top + bounds.height / 2
                            ? { before: id }
                            : { after: id },
                        );
                      }}
                    >
                      <Show
                        when={row().hasChildren}
                        fallback={<span class="nodetto-layer-spacer" />}
                      >
                        <button
                          type="button"
                          aria-label={`Toggle ${layerName(row().element)} contents`}
                          aria-expanded={
                            Boolean(query().trim()) || !collapsed().has(id)
                          }
                          disabled={Boolean(query().trim())}
                          onClick={() => toggle(id)}
                        >
                          {!query().trim() && collapsed().has(id) ? ">" : "v"}
                        </button>
                      </Show>
                      <Show
                        when={renaming() !== id}
                        fallback={
                          <LayerRenameInput
                            editor={props.editor}
                            id={id}
                            onDone={(restoreFocus) => {
                              setRenaming(undefined);
                              if (restoreFocus)
                                queueMicrotask(() => {
                                  if (nameButton?.isConnected)
                                    nameButton.focus();
                                  else searchInput?.focus();
                                });
                            }}
                          />
                        }
                      >
                        <button
                          ref={(button) => {
                            nameButton = button;
                            nameButtons.set(id, button);
                          }}
                          type="button"
                          class="nodetto-layer-name"
                          draggable={feature() ? canDrag() : undefined}
                          onDragStart={(event) => {
                            if (!canDrag() || !event.dataTransfer) return;
                            draggedFeature = {
                              id,
                              documentOpenRevision:
                                props.editor.documentOpenRevision,
                            };
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData(
                              "application/x-nodetto-cad-feature",
                              id,
                            );
                          }}
                          onDragEnd={() => {
                            draggedFeature = undefined;
                          }}
                          aria-pressed={isSelected(id)}
                          title={
                            row().matchDetail ??
                            `${layerName(row().element)} (${row().element.type})`
                          }
                          onClick={(event) => {
                            if (cad())
                              cadInspectionFor(props.editor).setFace(undefined);
                            selectionAnchor = selectLayerRow(
                              props.editor,
                              rows(),
                              id,
                              selectionAnchor,
                              {
                                range: event.shiftKey,
                                additive: event.ctrlKey || event.metaKey,
                              },
                            );
                          }}
                          onDblClick={startRename}
                          on:keydown={(event) => {
                            if (
                              event.isComposing ||
                              event.keyCode === 229 ||
                              event.ctrlKey ||
                              event.metaKey ||
                              event.altKey
                            )
                              return;
                            if (
                              cad() &&
                              row().element.page === props.editor.currentPageId
                            ) {
                              handleCadSelectionKey(props.editor, event);
                              if (event.defaultPrevented) return;
                            }
                            if (event.key === "F2") {
                              event.preventDefault();
                              event.stopPropagation();
                              startRename();
                              return;
                            }
                            const navigation = layerNavigation(
                              rows(),
                              id,
                              event.key,
                              collapsed(),
                              Boolean(query().trim()),
                            );
                            if (!navigation) return;
                            event.preventDefault();
                            event.stopPropagation();
                            if (navigation.action !== "select")
                              toggle(navigation.id);
                            else {
                              if (cad())
                                cadInspectionFor(props.editor).setFace(
                                  undefined,
                                );
                              selectionAnchor = selectLayerRow(
                                props.editor,
                                rows(),
                                navigation.id,
                                selectionAnchor,
                                { range: event.shiftKey },
                              );
                            }
                            revealRow(navigation.id);
                            queueMicrotask(() => {
                              const button = nameButtons.get(navigation.id);
                              if (!button?.isConnected) return;
                              button.focus();
                              button.scrollIntoView({
                                block: "nearest",
                                inline: "nearest",
                              });
                            });
                          }}
                        >
                          {layerName(row().element)}
                          <Show when={statusCode()}>
                            {(code) => (
                              <span
                                class="nodetto-layer-warning nodetto-layer-cad-status"
                                title={code()}
                              >
                                {code()}
                              </span>
                            )}
                          </Show>
                          <Show when={warning()}>
                            <span
                              class="nodetto-layer-warning"
                              title={warning()}
                              aria-label={warning()}
                            >
                              !
                            </span>
                          </Show>
                          <Show when={allPages()}>
                            <small
                              style={{
                                display: "block",
                                "font-weight": "normal",
                              }}
                            >
                              {
                                props.editor.store.getPage(row().element.page)
                                  ?.name
                              }
                            </small>
                          </Show>
                          <Show when={row().matchDetail}>
                            <small
                              style={{
                                display: "block",
                                "font-weight": "normal",
                                overflow: "hidden",
                                "text-overflow": "ellipsis",
                              }}
                            >
                              {row().matchDetail}
                            </small>
                          </Show>
                        </button>
                      </Show>
                      <Show when={props.viewport}>
                        <button
                          type="button"
                          class="nodetto-layer-icon"
                          aria-label={`Locate ${layerName(row().element)} on canvas`}
                          title="Select this layer and fit its visible artwork"
                          onClick={() => {
                            if (
                              !props.viewport ||
                              props.viewport.width <= 0 ||
                              props.viewport.height <= 0
                            )
                              return;
                            props.editor.setCurrentPage(row().element.page);
                            props.editor.selection.set([id]);
                            selectionAnchor = id;
                            props.editor.zoomToSelection(props.viewport);
                          }}
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <circle cx="10" cy="10" r="5" />
                            <path d="M10 2v4m0 8v4M2 10h4m8 0h4" />
                          </svg>
                        </button>
                      </Show>
                      <button
                        type="button"
                        class="nodetto-layer-icon"
                        title={
                          row().element.visual.hidden
                            ? "Show layer"
                            : "Hide layer"
                        }
                        aria-label={`${row().element.visual.hidden ? "Show" : "Hide"} ${layerName(row().element)}`}
                        aria-pressed={row().element.visual.hidden === true}
                        disabled={readOnly()}
                        onClick={() =>
                          props.editor.apply([
                            {
                              type: "updateVisual",
                              id,
                              visual: { hidden: !row().element.visual.hidden },
                            },
                          ])
                        }
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" />
                          <circle cx="10" cy="10" r="2" />
                          <Show when={row().element.visual.hidden}>
                            <path d="m3 3 14 14" />
                          </Show>
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="nodetto-layer-icon"
                        title={
                          row().element.visual.locked
                            ? "Unlock layer"
                            : "Lock layer"
                        }
                        aria-label={`${row().element.visual.locked ? "Unlock" : "Lock"} ${layerName(row().element)}`}
                        aria-pressed={row().element.visual.locked === true}
                        disabled={readOnly()}
                        onClick={() =>
                          props.editor.apply([
                            {
                              type: "updateVisual",
                              id,
                              visual: { locked: !row().element.visual.locked },
                            },
                          ])
                        }
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                          <rect x="5" y="9" width="10" height="8" />
                          <path
                            d={
                              row().element.visual.locked
                                ? "M7 9V6a3 3 0 0 1 6 0v3"
                                : "M7 9V6a3 3 0 0 1 6 0"
                            }
                          />
                          <path d="M10 12v2" />
                        </svg>
                      </button>
                    </div>
                  );
                }}
              </Show>
            )}
          </For>
        </div>
        <Show when={rows().length === 0}>
          <p>{query().trim() ? "No matches" : "No layers"}</p>
        </Show>
        <div class="nodetto-layer-actions">
          <button
            type="button"
            onClick={() => props.editor.reorderSelection("front")}
            disabled={readOnly()}
          >
            Bring to front
          </button>
          <button
            type="button"
            onClick={() => props.editor.reorderSelection("back")}
            disabled={readOnly()}
          >
            Send to back
          </button>
        </div>
      </details>
    </nav>
  );
}
