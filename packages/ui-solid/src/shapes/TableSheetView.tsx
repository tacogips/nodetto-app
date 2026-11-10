import type { Element } from "@nodetto/ir";
import { For, type JSX, Show } from "solid-js";
import { tableSheetViewModel } from "./table-sheet-view-model.ts";
import { fillPaintStyle, strokeBorderStyle } from "./visual.ts";
import "./TableSheetView.css";

export function TableSheetView(props: { element: Element }): JSX.Element {
  const model = () => tableSheetViewModel(props.element);
  return (
    <div
      class="nodetto-table-sheet"
      data-smart-paint="box"
      style={{
        ...fillPaintStyle(props.element.visual),
        width: `${model().width}px`,
        height: `${model().height}px`,
      }}
    >
      <Show when={model().headerHeight > 0}>
        <div
          class="nodetto-table-sheet-header"
          style={{ height: `${model().headerHeight}px` }}
        />
      </Show>
      <For each={model().stripes}>
        {(stripe) => (
          <div class="nodetto-table-sheet-stripe" style={stripe.style} />
        )}
      </For>
      <For each={model().cells}>
        {(cell) => (
          <Show when={cell.fill}>
            <div
              class="nodetto-table-sheet-fill"
              style={{
                left: `${cell.x}px`,
                top: `${cell.y}px`,
                width: `${cell.width}px`,
                height: `${cell.height}px`,
                background: cell.fill,
              }}
            />
          </Show>
        )}
      </For>
      <For each={model().columns.slice(1)}>
        {(column) => (
          <div
            class="nodetto-table-sheet-grid-v"
            style={{ left: `${column.x}px` }}
          />
        )}
      </For>
      <For each={model().rows}>
        {(row) => (
          <Show when={row.y > 0}>
            <div
              class="nodetto-table-sheet-grid-h"
              style={{ top: `${row.y}px` }}
            />
          </Show>
        )}
      </For>
      <For each={model().header}>
        {(header) => (
          <div
            class="nodetto-table-sheet-cell nodetto-table-sheet-heading"
            style={header.style}
          >
            <span>{header.text}</span>
          </div>
        )}
      </For>
      <For each={model().cells}>
        {(cell) => (
          <div
            class="nodetto-table-sheet-cell"
            style={{ ...cell.style, background: "transparent" }}
          >
            <Show
              when={
                cell.kind === "checkbox" ||
                (cell.kind === "empty" &&
                  model().columns[cell.columnIndex]?.type === "checkbox")
              }
            >
              <span
                class="nodetto-table-sheet-checkbox"
                classList={{ checked: cell.checked }}
              >
                <Show when={cell.checked}>✓</Show>
              </span>
            </Show>
            <Show when={cell.kind === "pill"}>
              <span class="nodetto-table-sheet-pill" style={cell.pillStyle}>
                {cell.display}
              </span>
            </Show>
            <Show when={cell.kind === "text"}>
              <span>{cell.display}</span>
            </Show>
          </div>
        )}
      </For>
      <div
        class="nodetto-table-sheet-border"
        style={strokeBorderStyle(props.element.visual)}
      />
    </div>
  );
}
