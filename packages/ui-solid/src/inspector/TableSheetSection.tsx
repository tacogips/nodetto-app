import {
  applyTableSheetEdit,
  deleteColumns,
  deleteRows,
  insertColumn,
  insertRow,
  moveColumn,
  newElementId,
  readTableSheet,
  renameColumn,
  resizeColumn,
  retypeColumn,
  setColumnAlign,
  setColumnOptions,
  setHeaderRow,
  setStriped,
  type Editor,
  type TableSheetEditResult,
} from "@nodetto/core";
import {
  TABLE_SHEET_COLUMN_TYPES,
  TABLE_SHEET_LIMITS,
  type Element,
  type TableSheetAlign,
  type TableSheetColumnType,
  type TableSheetSemantic,
} from "@nodetto/ir";
import { createSignal, For, type JSX, Show } from "solid-js";
import {
  Checkbox,
  Field,
  NumberInput,
  Section,
  SelectInput,
  TextArea,
  TextInput,
} from "./controls.tsx";
import {
  columnTypeLabel,
  formatOptionLines,
  parseOptionLines,
  rowToDelete,
} from "./table-sheet-section.ts";

export function TableSheetSection(props: {
  editor: Editor;
  element: Element;
  activeRowId?: string;
}): JSX.Element {
  const semantic = () => readTableSheet(props.element.semantic);
  const [error, setError] = createSignal("");
  const edit = (change: (s: TableSheetSemantic) => TableSheetEditResult) => {
    const result = applyTableSheetEdit(props.editor, props.element.id, change);
    setError(result.ok ? "" : result.message);
  };
  return (
    <Section title="Table (sheet)">
      <Checkbox
        label="Header row"
        checked={semantic().headerRow !== false}
        onCommit={(v) => edit((s) => setHeaderRow(s, v))}
      />
      <Checkbox
        label="Striped rows"
        checked={semantic().striped === true}
        onCommit={(v) => edit((s) => setStriped(s, v))}
      />
      <Show when={error()}>{(message) => <p role="alert">{message()}</p>}</Show>
      <div class="nodetto-erd-columns" aria-label="Columns">
        <For each={semantic().columns.map((column) => column.id)}>
          {(id) => {
            const column = () =>
              semantic().columns.find((item) => item.id === id);
            const index = () =>
              semantic().columns.findIndex((item) => item.id === id);
            return (
              <Show when={column()}>
                {(c) => (
                  <section
                    class="nodetto-erd-column"
                    aria-label={`Column ${index() + 1}`}
                  >
                    <Field label="Name">
                      <TextInput
                        label="Column name"
                        value={c().name}
                        onCommit={(v) => edit((s) => renameColumn(s, id, v))}
                      />
                    </Field>
                    <Field label="Type">
                      <SelectInput
                        label="Column type"
                        value={c().type}
                        options={TABLE_SHEET_COLUMN_TYPES.map((type) => ({
                          value: type,
                          label: columnTypeLabel(type),
                        }))}
                        onCommit={(v) =>
                          edit((s) =>
                            retypeColumn(s, id, v as TableSheetColumnType),
                          )
                        }
                      />
                    </Field>
                    <Field label="Width">
                      <NumberInput
                        label="Column width"
                        value={c().width}
                        min={TABLE_SHEET_LIMITS.minColumnWidth}
                        max={TABLE_SHEET_LIMITS.maxColumnWidth}
                        onCommit={(v) => edit((s) => resizeColumn(s, id, v))}
                      />
                    </Field>
                    <Field label="Alignment">
                      <SelectInput
                        label="Column alignment"
                        value={c().align ?? ""}
                        options={[
                          { value: "", label: "Default" },
                          { value: "left", label: "Left" },
                          { value: "center", label: "Center" },
                          { value: "right", label: "Right" },
                        ]}
                        onCommit={(v) =>
                          edit((s) =>
                            setColumnAlign(
                              s,
                              id,
                              (v || undefined) as TableSheetAlign | undefined,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Show when={c().type === "select"}>
                      <Field label="Options">
                        <TextArea
                          label="Column options"
                          value={formatOptionLines(c().options)}
                          onCommit={(v) =>
                            edit((s) =>
                              setColumnOptions(s, id, parseOptionLines(v)),
                            )
                          }
                        />
                      </Field>
                    </Show>
                    <div class="nodetto-row-tools">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={index() <= 0}
                        onClick={() =>
                          edit((s) => {
                            const i = s.columns.findIndex(
                              (item) => item.id === id,
                            );
                            return moveColumn(s, i, i - 1);
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={index() >= semantic().columns.length - 1}
                        onClick={() =>
                          edit((s) => {
                            const i = s.columns.findIndex(
                              (item) => item.id === id,
                            );
                            return moveColumn(s, i, i + 1);
                          })
                        }
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label="Remove column"
                        disabled={semantic().columns.length <= 1}
                        onClick={() => edit((s) => deleteColumns(s, [id]))}
                      >
                        ×
                      </button>
                    </div>
                  </section>
                )}
              </Show>
            );
          }}
        </For>
      </div>
      <button
        type="button"
        class="nodetto-inspector-button"
        onClick={() => edit((s) => insertRow(s, s.rows.length, newElementId))}
      >
        Add row
      </button>
      <button
        type="button"
        class="nodetto-inspector-button"
        onClick={() =>
          edit((s) => insertColumn(s, s.columns.length, newElementId))
        }
      >
        Add column
      </button>
      <button
        type="button"
        class="nodetto-inspector-button"
        disabled={semantic().rows.length === 0}
        onClick={() =>
          edit((s) => {
            const id = rowToDelete(s, props.activeRowId);
            return deleteRows(s, id ? [id] : []);
          })
        }
      >
        Delete row
      </button>
    </Section>
  );
}
