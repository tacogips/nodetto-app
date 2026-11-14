import type { Command, Editor } from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import { createMemo, createSignal, type JSX, Show } from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import { Checkbox } from "./controls.tsx";
import {
  linkedPages,
  planApplyToLinked,
  planUnlink,
} from "./slide-link-edits.ts";

export function SlideLinkSection(props: {
  readonly editor: Editor;
  readonly element: Element;
}): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const [geometry, setGeometry] = createSignal(false);
  const current = createMemo(() => {
    signals.rev();
    return props.editor.store.get(props.element.id);
  });
  const count = createMemo(() => {
    const element = current();
    return element ? linkedPages(props.editor.store, element).length : 0;
  });
  const apply = (commands: Command[]) => {
    if (commands.length && !props.editor.readOnly) props.editor.apply(commands);
  };
  return (
    <Show when={current()?.visual.linkId}>
      <details class="nodetto-inspector-details">
        <summary>Slide link</summary>
        <div class="nodetto-inspector-body">
          <p>
            Linked on {count()} {count() === 1 ? "page" : "pages"}
          </p>
          <Checkbox
            label="Include position and size"
            checked={geometry()}
            onCommit={setGeometry}
            disabled={props.editor.readOnly}
          />
          <button
            type="button"
            disabled={props.editor.readOnly || count() < 2}
            onClick={() => {
              const element = current();
              if (element)
                apply(
                  planApplyToLinked(props.editor.store, element, {
                    geometry: geometry(),
                  }),
                );
            }}
          >
            Apply to linked shapes
          </button>
          <button
            type="button"
            disabled={props.editor.readOnly}
            onClick={() => {
              const element = current();
              if (element) apply(planUnlink(element));
            }}
          >
            Unlink
          </button>
        </div>
      </details>
    </Show>
  );
}
