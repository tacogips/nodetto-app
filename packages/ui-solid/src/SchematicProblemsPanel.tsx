import type { Editor, ViewportSize } from "@nodetto/core";
import type { BreadboardImportDiagnostic } from "@nodetto/ir";
import {
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { focusBreadboardProbe } from "./breadboard-problems.ts";
import {
  canFixSchematicReferences,
  schematicProblemRows,
  sendSchematicToBreadboard,
} from "./schematic-problems.ts";
import "./BreadboardProblemsPanel.css";

export interface SchematicProblemsPanelProps {
  readonly editor: Editor;
  readonly viewport: () => ViewportSize;
}

export function SchematicProblemsPanel(
  props: SchematicProblemsPanelProps,
): JSX.Element {
  const [rows, setRows] = createSignal<ReturnType<typeof schematicProblemRows>>(
    [],
  );
  const [fixable, setFixable] = createSignal(false);
  const [kind, setKind] = createSignal<string | undefined>();
  const [boards, setBoards] = createSignal<
    readonly { id: string; name: string }[]
  >([]);
  const [selectedBoard, setSelectedBoard] = createSignal("");
  const [diagnostics, setDiagnostics] = createSignal<
    readonly BreadboardImportDiagnostic[]
  >([]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    const document = props.editor.store.getSnapshot();
    const pageId = props.editor.currentPageId;
    setKind(document.pages.find((page) => page.id === pageId)?.kind);
    setRows(schematicProblemRows(document, pageId));
    setFixable(canFixSchematicReferences(document, pageId));
    const pages = document.pages.filter((page) => page.kind === "breadboard");
    setBoards(pages);
    if (!pages.some((page) => page.id === selectedBoard()))
      setSelectedBoard(pages[0]?.id ?? "");
  };
  onMount(() => {
    refresh();
    const unsubscribe = props.editor.subscribe(() => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(refresh, 300);
    });
    onCleanup(() => {
      if (timer !== undefined) clearTimeout(timer);
      unsubscribe();
    });
  });
  return (
    <Show when={kind() === "schematic" || kind() === "pcb"}>
      <section
        class="nodetto-breadboard-problems"
        aria-label="Schematic problems"
      >
        <div class="nodetto-breadboard-problems-heading">
          <p class="nodetto-breadboard-problems-summary">
            {rows().length === 0 ? "No problems" : `${rows().length} problems`}
          </p>
          <Show when={kind() === "schematic"}>
            <button
              type="button"
              class="nodetto-breadboard-problems-fix"
              disabled={!fixable()}
              onClick={() =>
                props.editor.annotateSchematic(props.editor.currentPageId)
              }
            >
              Fix references
            </button>
            <Show when={boards().length > 1}>
              <select
                class="nodetto-select"
                aria-label="Breadboard page"
                value={selectedBoard()}
                onChange={(event) =>
                  setSelectedBoard(event.currentTarget.value)
                }
              >
                <For each={boards()}>
                  {(page) => <option value={page.id}>{page.name}</option>}
                </For>
              </select>
            </Show>
            <button
              type="button"
              disabled={!selectedBoard()}
              onClick={() =>
                setDiagnostics(
                  sendSchematicToBreadboard(
                    props.editor,
                    props.editor.currentPageId,
                    selectedBoard(),
                  ),
                )
              }
            >
              Send to breadboard
            </button>
          </Show>
        </div>
        <ul>
          <For each={diagnostics()}>
            {(diagnostic) => <li>{diagnostic.message}</li>}
          </For>
        </ul>
        <ul class="nodetto-breadboard-problems-list">
          <For each={rows()}>
            {(row) => (
              <li>
                <button
                  class="nodetto-breadboard-problem"
                  type="button"
                  onClick={() =>
                    focusBreadboardProbe(
                      props.editor,
                      {
                        pageId: row.pageId ?? props.editor.currentPageId,
                        elementIds: row.elementIds,
                        ...(row.pin === undefined
                          ? {}
                          : {
                              pin: { elementId: row.elementId, pin: row.pin },
                            }),
                      },
                      props.viewport(),
                    )
                  }
                >
                  <span class="nodetto-breadboard-problem-severity">
                    {row.severity}
                  </span>
                  <span class="nodetto-breadboard-problem-message">
                    {row.message}
                  </span>
                  <span class="nodetto-breadboard-problem-rule">
                    {row.ruleId}
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}
