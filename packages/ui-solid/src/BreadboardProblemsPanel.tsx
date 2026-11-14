import type { BreadboardProbe, Editor, ViewportSize } from "@nodetto/core";
import type { BpmnImportWarning } from "@nodetto/io";
import {
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  breadboardProblemRows,
  canFixBreadboardReferences,
  focusBreadboardProbe,
} from "./breadboard-problems.ts";
import "./BreadboardProblemsPanel.css";

export interface BreadboardProblemsPanelProps {
  readonly editor: Editor;
  readonly viewport: () => ViewportSize;
  readonly importWarnings?: readonly BpmnImportWarning[];
}

export function BreadboardProblemsPanel(
  props: BreadboardProblemsPanelProps,
): JSX.Element {
  const [rows, setRows] = createSignal<
    ReturnType<typeof breadboardProblemRows>
  >([]);
  const [fixable, setFixable] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = (): void => {
    const snapshot = props.editor.store.getSnapshot();
    const pageId = props.editor.currentPageId;
    setRows(breadboardProblemRows(snapshot, pageId));
    setFixable(canFixBreadboardReferences(snapshot, pageId));
  };
  const scheduleRefresh = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      refresh();
    }, 300);
  };
  const focus = (probe: BreadboardProbe): void => {
    focusBreadboardProbe(props.editor, probe, props.viewport());
  };

  onMount(() => {
    refresh();
    const unsubscribe = props.editor.subscribe(scheduleRefresh);
    onCleanup(() => {
      if (timer !== undefined) clearTimeout(timer);
      unsubscribe();
    });
  });

  return (
    <Show
      when={
        props.editor.store.getPage(props.editor.currentPageId)?.kind ===
        "breadboard"
      }
    >
      <section
        class="nodetto-breadboard-problems"
        aria-label="Breadboard problems"
      >
        <Show when={(props.importWarnings?.length ?? 0) > 0}>
          <section
            class="nodetto-breadboard-problems-import-warnings"
            aria-label="Import warnings"
          >
            <h3>Import warnings</h3>
            <ul>
              <For each={props.importWarnings ?? []}>
                {(warning) => (
                  <li>
                    <span>{warning.element}</span>
                    <Show when={warning.xmlId}>
                      {(xmlId) => <span> ({xmlId()})</span>}
                    </Show>
                    <span>: {warning.message}</span>
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>
        <div class="nodetto-breadboard-problems-heading">
          <p class="nodetto-breadboard-problems-summary">
            {rows().length === 0
              ? "No problems"
              : `${rows().length} problems (${rows().filter((row) => row.severity === "error").length} errors, ${rows().filter((row) => row.severity === "warning").length} warnings)`}
          </p>
          <button
            class="nodetto-breadboard-problems-fix"
            type="button"
            disabled={!fixable()}
            onClick={() =>
              props.editor.annotateBreadboard(props.editor.currentPageId)
            }
          >
            Fix references
          </button>
        </div>
        <ul class="nodetto-breadboard-problems-list">
          <For each={rows()}>
            {(row) => (
              <li>
                <button
                  class="nodetto-breadboard-problem"
                  type="button"
                  onClick={() =>
                    focus({
                      pageId: props.editor.currentPageId,
                      elementIds: row.elementIds,
                      ...(row.pin === undefined
                        ? {}
                        : { pin: { elementId: row.elementId, pin: row.pin } }),
                    })
                  }
                >
                  <span class="nodetto-breadboard-problem-severity">
                    {row.severity}
                  </span>
                  <span class="nodetto-breadboard-problem-reference">
                    {row.reference}
                    {row.pin === undefined ? "" : ` pin ${row.pin}`}
                  </span>
                  <span class="nodetto-breadboard-problem-message">
                    {row.message}
                  </span>
                  <span class="nodetto-breadboard-problem-rule">
                    {row.ruleId}
                  </span>
                </button>
                <Show when={row.chips.length > 0}>
                  <div class="nodetto-breadboard-problem-chips">
                    <For each={row.chips}>
                      {(chip) => (
                        <button
                          type="button"
                          class="nodetto-breadboard-problem-chip"
                          onClick={() =>
                            focus({
                              pageId: props.editor.currentPageId,
                              elementIds: [chip.elementId],
                            })
                          }
                        >
                          {chip.reference || chip.elementId}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}
