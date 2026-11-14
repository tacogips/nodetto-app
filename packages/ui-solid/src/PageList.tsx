import type { Editor } from "@nodetto/core";
import type { PageId } from "@nodetto/ir";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { createEditorSignals } from "./adapter.ts";
import {
  deletePageWithConfirm,
  duplicatePageAction,
  pageMenuItems,
  togglePagePresentation,
  type PageMenuItemKey,
} from "./page-actions.ts";
import {
  pageListKeyAction,
  pageListRevealTop,
  pageListRows,
} from "./page-list.ts";
import { PRESENTATION_HIDDEN_TITLE_SUFFIX } from "./page-presentation-toggle.ts";
import { pageRenameDraft } from "./page-rename.ts";
import "./PageList.css";

export interface PageListProps {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopyShapesFrom?: (id: PageId) => void;
}

export function PageList(props: PageListProps) {
  const signals = createEditorSignals(props.editor);
  const [focused, setFocused] = createSignal<PageId | null>(null);
  const [renaming, setRenaming] = createSignal<PageId | null>(null);
  const [renameValue, setRenameValue] = createSignal("");
  const [renameError, setRenameError] = createSignal("");
  const [menuFor, setMenuFor] = createSignal<PageId | null>(null);
  let draft: ReturnType<typeof pageRenameDraft>;
  let box: HTMLDivElement | undefined;
  const rows = createMemo(() => {
    signals.rev();
    return pageListRows(props.editor);
  });
  const byId = createMemo(() => new Map(rows().map((row) => [row.id, row])));
  const pageIds = createMemo(() =>
    props.open ? rows().map((row) => row.id) : [],
  );
  const currentId = createMemo(() => {
    signals.rev();
    return props.editor.currentPageId;
  });
  const readOnly = createMemo(() => {
    signals.rev();
    return props.editor.readOnly;
  });
  const menuItems = createMemo(() => {
    signals.rev();
    const id = menuFor();
    return id === null
      ? []
      : pageMenuItems(props.editor, id, {
          axis: "vertical",
          copyShapes: Boolean(props.onCopyShapesFrom),
        });
  });
  const menuKeys = createMemo(() => menuItems().map((item) => item.key));
  const focusRow = (id: PageId) => {
    setFocused(id);
    queueMicrotask(() =>
      box
        ?.querySelector<HTMLElement>(`[data-page-list-row="${CSS.escape(id)}"]`)
        ?.focus(),
    );
  };
  const openMenu = (id: PageId) => {
    setMenuFor(id);
    queueMicrotask(() =>
      box
        ?.querySelector<HTMLButtonElement>(
          `[data-page-list-row="${CSS.escape(id)}"] [role=menuitem]:not(:disabled)`,
        )
        ?.focus(),
    );
  };
  const startRename = (id: PageId) => {
    if (props.editor.readOnly) return;
    draft = pageRenameDraft(props.editor, id);
    if (!draft) return;
    setRenameValue(draft.value);
    setRenameError("");
    setMenuFor(null);
    setRenaming(id);
  };
  const commitRename = (id: PageId, value: string) => {
    if (renaming() !== id) return;
    if (draft?.commit(value) === "unavailable") {
      setRenameError(
        "Page changed while renaming. Press Escape and reopen Rename to try again.",
      );
      return;
    }
    setRenaming(null);
  };
  createEffect(() => {
    if (readOnly()) {
      setRenaming(null);
      setMenuFor(null);
    }
  });
  createEffect(() => {
    const id = currentId();
    const open = props.open;
    queueMicrotask(() => {
      if (!open || !box) return;
      const row = box.querySelector<HTMLElement>(
        `[data-page-list-row="${CSS.escape(id)}"]`,
      );
      if (!row) return;
      const rowRect = row.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const top = rowRect.top - boxRect.top + box.scrollTop;
      const next = pageListRevealTop(
        { top, bottom: top + rowRect.height },
        box,
      );
      if (next !== null) box.scrollTop = next;
    });
  });
  createEffect(() => {
    if (menuFor() === null) return;
    const close = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(
          ".nodetto-page-list-menu, .nodetto-page-list-menu-button",
        )
      )
        setMenuFor(null);
    };
    window.addEventListener("pointerdown", close, true);
    onCleanup(() => window.removeEventListener("pointerdown", close, true));
  });
  const runAction = (key: PageMenuItemKey, id: PageId) => {
    switch (key) {
      case "rename":
        startRename(id);
        return;
      case "duplicate":
        duplicatePageAction(props.editor, id);
        break;
      case "copyShapes":
        props.onCopyShapesFrom?.(id);
        break;
      case "presentation":
        togglePagePresentation(props.editor, id);
        break;
      case "delete": {
        const result = deletePageWithConfirm(props.editor, id, (message) =>
          window.confirm(message),
        );
        if (result === "cancelled") focusRow(id);
        else if (result === "deleted") focusRow(props.editor.currentPageId);
        break;
      }
      case "moveBack":
      case "moveForward":
        props.editor.reorderPage(id, key === "moveBack" ? -1 : 1);
        focusRow(id);
        break;
    }
    setMenuFor(null);
  };
  return (
    <details
      class="nodetto-navigation-group nodetto-page-list"
      open={props.open}
      onToggle={(event) => {
        if (event.currentTarget.open !== props.open)
          props.onOpenChange(event.currentTarget.open);
      }}
    >
      <summary>Pages ({rows().length})</summary>
      <Show when={props.open}>
        <div
          class="nodetto-page-list-rows"
          role="listbox"
          aria-label="Pages"
          ref={box}
        >
          <For each={pageIds()}>
            {(id) => {
              const row = () => byId().get(id);
              return (
                <div
                  role="option"
                  data-page-list-row={id}
                  aria-selected={currentId() === id}
                  tabindex={(focused() ?? currentId()) === id ? 0 : -1}
                  class="nodetto-page-list-row"
                  classList={{
                    "nodetto-page-list-active": currentId() === id,
                    "nodetto-page-list-hidden": row()?.hiddenInPresentation,
                  }}
                  title={`${row()?.name ?? ""}${row()?.hiddenInPresentation ? PRESENTATION_HIDDEN_TITLE_SUFFIX : ""}`}
                  onFocus={() => setFocused(id)}
                  onClick={() => props.editor.setCurrentPage(id)}
                  onDblClick={() => startRename(id)}
                  onContextMenu={(event) => {
                    if (!readOnly()) {
                      event.preventDefault();
                      openMenu(id);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    const action = pageListKeyAction(
                      rows(),
                      id,
                      event.key,
                      {
                        alt: event.altKey,
                        ctrl: event.ctrlKey,
                        meta: event.metaKey,
                        composing: event.isComposing,
                      },
                      readOnly(),
                    );
                    if (!action) return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (action.kind === "focus") focusRow(action.id);
                    else if (action.kind === "activate")
                      props.editor.setCurrentPage(action.id);
                    else startRename(action.id);
                  }}
                >
                  <span class="nodetto-page-list-number">{row()?.number}</span>
                  <Show
                    when={renaming() === id}
                    fallback={
                      <span class="nodetto-page-list-name">{row()?.name}</span>
                    }
                  >
                    <input
                      class="nodetto-page-rename"
                      aria-label="Page name"
                      aria-invalid={renameError() ? true : undefined}
                      value={renameValue()}
                      ref={(input) =>
                        queueMicrotask(() => {
                          if (input.isConnected) {
                            input.focus();
                            input.select();
                          }
                        })
                      }
                      onClick={(event) => event.stopPropagation()}
                      onInput={(event) =>
                        setRenameValue(event.currentTarget.value)
                      }
                      onBlur={(event) =>
                        commitRename(id, event.currentTarget.value)
                      }
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter" && !event.isComposing) {
                          event.preventDefault();
                          commitRename(id, event.currentTarget.value);
                          if (!renameError()) focusRow(id);
                        } else if (
                          event.key === "Escape" &&
                          !event.isComposing
                        ) {
                          event.preventDefault();
                          setRenaming(null);
                          focusRow(id);
                        }
                      }}
                    />
                    <Show when={renameError()}>
                      <span role="alert">{renameError()}</span>
                    </Show>
                  </Show>
                  <Show when={!readOnly()}>
                    <button
                      type="button"
                      class="nodetto-page-list-menu-button"
                      aria-label={`Options for ${row()?.name ?? ""}`}
                      aria-haspopup="menu"
                      aria-expanded={menuFor() === id}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (menuFor() === id) setMenuFor(null);
                        else openMenu(id);
                      }}
                    >
                      ...
                    </button>
                  </Show>
                  <Show when={menuFor() === id && !readOnly()}>
                    <div
                      class="nodetto-page-list-menu"
                      role="menu"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          event.stopPropagation();
                          setMenuFor(null);
                          focusRow(id);
                          return;
                        }
                        const items = Array.from(
                          event.currentTarget.querySelectorAll<HTMLButtonElement>(
                            '[role="menuitem"]:not(:disabled)',
                          ),
                        );
                        const index = items.indexOf(
                          document.activeElement as HTMLButtonElement,
                        );
                        const next =
                          event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? items.length - 1
                              : event.key === "ArrowDown"
                                ? (index + 1) % items.length
                                : event.key === "ArrowUp"
                                  ? (index + items.length - 1) % items.length
                                  : null;
                        if (next !== null) {
                          event.preventDefault();
                          event.stopPropagation();
                          items[next]?.focus();
                        }
                      }}
                    >
                      <For each={menuKeys()}>
                        {(key) => {
                          const item = () =>
                            menuItems().find((entry) => entry.key === key);
                          return (
                            <button
                              type="button"
                              role="menuitem"
                              class="nodetto-menu-item"
                              tabindex="-1"
                              title={item()?.title}
                              disabled={item()?.disabled}
                              onClick={() => runAction(key, id)}
                            >
                              {item()?.label}
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
      <Show when={!readOnly()}>
        <button
          type="button"
          class="nodetto-page-list-add"
          aria-label="Add page"
          onClick={() => props.editor.createPage()}
        >
          +
        </button>
      </Show>
    </details>
  );
}
