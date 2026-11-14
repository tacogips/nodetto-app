import { readTableSheet, tableSheetLayout, type Editor } from "@nodetto/core";
import { createMemo, type JSX, onMount, Show, For } from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import { cellEditorInitialText, commitCellText } from "./cell-commit.ts";
import type { TableSheetSelection } from "./selection.ts";
import "./TableSheet.css";

export function TableSheetCellEditor(props: {
  editor: Editor;
  selection: TableSheetSelection;
  onDone: () => void;
}): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const initial = cellEditorInitialText(props.editor, props.selection);
  let input: HTMLInputElement | HTMLSelectElement | undefined;
  let done = false;
  const target = createMemo(() => {
    signals.rev();
    const state = props.selection.state();
    if (!state) return null;
    const element = props.editor.store.get(state.elementId);
    if (!element || element.type !== "table.sheet") return null;
    const column = readTableSheet(element.semantic).columns.find(
      (c) => c.id === state.active.columnId,
    );
    const cell = tableSheetLayout(element).cells.find(
      (c) =>
        c.rowId === state.active.rowId && c.columnId === state.active.columnId,
    );
    return column && cell ? { column, cell } : null;
  });
  const finish = (move: "down" | "right" | "left" | "none" | "cancel") => {
    if (done) return;
    done = true;
    if (move === "cancel") props.selection.stopEditing();
    else
      commitCellText(
        props.editor,
        props.selection,
        input?.value ?? initial,
        move,
      );
    props.onDone();
  };
  const key = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.isComposing || event.keyCode === 229) return;
    if (
      event.key === "Enter" ||
      event.key === "Tab" ||
      event.key === "Escape"
    ) {
      event.preventDefault();
      finish(
        event.key === "Escape"
          ? "cancel"
          : event.key === "Enter"
            ? "down"
            : event.shiftKey
              ? "left"
              : "right",
      );
    }
  };
  onMount(() => {
    if (input) {
      input.value = initial;
      input.focus();
      if (input instanceof HTMLInputElement && input.type === "text")
        input.select();
    }
  });
  return (
    <Show when={target()}>
      {(t) => {
        const style = () => ({
          left: `${t().cell.x}px`,
          top: `${t().cell.y}px`,
          width: `${t().cell.width}px`,
          height: `${t().cell.height}px`,
        });
        return (
          <Show
            when={t().column.type === "select"}
            fallback={
              <input
                ref={input as HTMLInputElement}
                class="nodetto-table-editor"
                aria-label="Edit cell"
                type={t().column.type === "date" ? "date" : "text"}
                style={style()}
                on:keydown={key}
                on:blur={() => finish("none")}
                on:pointerdown={(e) => e.stopPropagation()}
              />
            }
          >
            <select
              ref={input as HTMLSelectElement}
              class="nodetto-table-editor"
              aria-label="Edit cell"
              style={style()}
              on:keydown={key}
              on:blur={() => finish("none")}
              on:pointerdown={(e) => e.stopPropagation()}
            >
              <option value="" />
              <For each={t().column.options ?? []}>
                {(option) => <option value={option}>{option}</option>}
              </For>
            </select>
          </Show>
        );
      }}
    </Show>
  );
}
