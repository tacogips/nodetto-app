import {
  prototypeFlows,
  type Editor,
  type PrototypeFlow,
  type ViewportSize,
} from "@nodetto/core";
import { createMemo, For, type JSX } from "solid-js";

export interface FlowsPanelProps {
  readonly editor: Editor;
  readonly revision: number;
  readonly viewport: () => ViewportSize;
  readonly onPresent: (flowName: string) => void;
}

export function currentPageFlows(editor: Editor): readonly PrototypeFlow[] {
  return prototypeFlows(editor.store, editor.createShapeContext()).flows.filter(
    (flow) => editor.store.get(flow.startId)?.page === editor.currentPageId,
  );
}

export function focusPrototypeFlow(
  editor: Editor,
  flow: PrototypeFlow,
  viewport: ViewportSize,
): void {
  editor.selection.set([...flow.screens]);
  editor.zoomToSelection(viewport);
}

export function FlowsPanel(props: FlowsPanelProps): JSX.Element {
  const flows = createMemo(() => {
    props.revision;
    return currentPageFlows(props.editor);
  });
  return (
    <section
      aria-label="Flows"
      style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        "z-index": 2,
        background: "white",
        padding: "8px",
        "border-radius": "6px",
        "box-shadow": "0 1px 6px #0003",
      }}
    >
      <strong>Flows</strong>
      <ul style={{ "list-style": "none", padding: "0", margin: "4px 0 0" }}>
        <For each={flows()}>
          {(flow) => (
            <li>
              <button
                type="button"
                onClick={() =>
                  focusPrototypeFlow(props.editor, flow, props.viewport())
                }
              >
                {flow.name} ({flow.screens.length}{" "}
                {flow.screens.length === 1 ? "screen" : "screens"})
              </button>
              <button
                type="button"
                aria-label={`Present ${flow.name}`}
                onClick={() => props.onPresent(flow.name)}
              >
                Present
              </button>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
