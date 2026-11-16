import { pageFlowOf, type Editor } from "@nodetto/core";
import type { JSX } from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import { Field } from "./controls.tsx";

export function PageFlowControl(props: {
  readonly editor: Editor;
}): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const flow = () => {
    signals.rev();
    return pageFlowOf(props.editor.store.getPage(props.editor.currentPageId));
  };
  return (
    <Field label="Page flow">
      <div class="nodetto-inspector-actions">
        <button
          type="button"
          aria-pressed={flow() === "vertical"}
          disabled={props.editor.readOnly}
          onClick={() =>
            props.editor.setPageFlow(props.editor.currentPageId, "vertical")
          }
        >
          Vertical
        </button>
        <button
          type="button"
          aria-pressed={flow() === "horizontal"}
          disabled={props.editor.readOnly}
          onClick={() =>
            props.editor.setPageFlow(props.editor.currentPageId, "horizontal")
          }
        >
          Horizontal
        </button>
      </div>
    </Field>
  );
}
