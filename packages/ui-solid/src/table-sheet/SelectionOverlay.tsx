import { tableSheetLayout, type Editor } from "@nodetto/core";
import { createMemo, type JSX, Show } from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import type { TableSheetSelection } from "./selection.ts";
import "./TableSheet.css";

export function TableSheetSelectionOverlay(props: {
  editor: Editor;
  selection: TableSheetSelection;
}): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const boxes = createMemo(() => {
    signals.rev();
    const state = props.selection.state();
    if (!state) return null;
    const element = props.editor.store.get(state.elementId);
    const range = props.selection.range(props.editor);
    if (!element || element.type !== "table.sheet" || !range) return null;
    const layout = tableSheetLayout(element);
    const active = layout.cells.find(
      (c) =>
        c.rowId === state.active.rowId && c.columnId === state.active.columnId,
    );
    const first = layout.cells.find(
      (c) => c.rowIndex === range.top && c.columnIndex === range.left,
    );
    const last = layout.cells.find(
      (c) => c.rowIndex === range.bottom && c.columnIndex === range.right,
    );
    return active && first && last
      ? {
          active,
          range: {
            x: first.x,
            y: first.y,
            width: last.x + last.width - first.x,
            height: last.y + last.height - first.y,
          },
        }
      : null;
  });
  const style = (box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => ({
    left: `${box.x}px`,
    top: `${box.y}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  });
  return (
    <Show when={boxes()}>
      {(box) => (
        <>
          <div class="nodetto-table-range" style={style(box().range)} />
          <div class="nodetto-table-active" style={style(box().active)} />
        </>
      )}
    </Show>
  );
}
