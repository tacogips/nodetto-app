import {
  isAppLintPage,
  lintAppDesignPage,
  type AppLintFinding,
  type Editor,
  type ViewportSize,
} from "@nodetto/core";
import {
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import "./AppDesignProblemsPanel.css";

export function appDesignProblemRows(
  editor: Editor,
): readonly AppLintFinding[] {
  const page = editor.store.getPage(editor.currentPageId);
  return page && isAppLintPage(editor.store, page)
    ? lintAppDesignPage(editor.store, page, editor.createShapeContext())
    : [];
}

export function focusAppDesignProblem(
  editor: Editor,
  finding: AppLintFinding,
  viewport: ViewportSize,
): boolean {
  const element = editor.store.get(finding.elementId);
  if (!element) return false;
  editor.setCurrentPage(element.page);
  editor.selection.set([element.id]);
  editor.zoomToSelection(viewport);
  return true;
}

export function AppDesignProblemsPanel(props: {
  readonly editor: Editor;
  readonly viewport: () => ViewportSize;
}): JSX.Element {
  const [rows, setRows] = createSignal<readonly AppLintFinding[]>([]);
  const [visible, setVisible] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = (): void => {
    const page = props.editor.store.getPage(props.editor.currentPageId);
    setVisible(!!page && isAppLintPage(props.editor.store, page));
    setRows(appDesignProblemRows(props.editor));
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
    <Show when={visible()}>
      <section class="nodetto-app-problems" aria-label="App design problems">
        <p>
          {rows().length === 0 ? "No problems" : `${rows().length} problems`}
        </p>
        <ul>
          <For each={rows()}>
            {(row) => (
              <li>
                <button
                  type="button"
                  onClick={() =>
                    focusAppDesignProblem(props.editor, row, props.viewport())
                  }
                >
                  <span>{row.ruleId}</span> <span>{row.message}</span>
                  <Show when={row.context?.screenId}>
                    <span>Screen: {row.context?.screenId}</span>
                  </Show>
                  <Show when={row.context?.instanceId}>
                    <span>Instance: {row.context?.instanceId}</span>
                  </Show>
                </button>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}
