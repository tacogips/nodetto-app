// Align and distribute for a multi-selection, as icon buttons.
import { type Editor, selectionUnitsWithBounds } from "@nodetto/core";
import { createMemo, For, type JSX } from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import { ToolbarIcon } from "../ToolbarIcon.tsx";
import { ALIGN_BUTTON_GROUPS, alignButtonEnabled } from "./align-buttons.ts";
import { Section } from "./controls.tsx";
import "./AlignSection.css";

export function AlignSection(props: { readonly editor: Editor }): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const units = createMemo(() => {
    signals.rev();
    signals.selection();
    return selectionUnitsWithBounds(
      props.editor.store,
      props.editor.selection.ids(),
      props.editor.createShapeContext(),
    ).length;
  });
  return (
    <Section title="Align">
      <div class="nodetto-align-row">
        <For each={ALIGN_BUTTON_GROUPS}>
          {(group) => (
            <div>
              <For each={group}>
                {(button) => (
                  <button
                    type="button"
                    class="nodetto-align-button"
                    title={button.label}
                    aria-label={button.label}
                    disabled={
                      props.editor.readOnly ||
                      !alignButtonEnabled(button, units())
                    }
                    onClick={() => {
                      if (button.kind === "align")
                        props.editor.alignSelection(button.mode);
                      else props.editor.distributeSelection(button.axis);
                    }}
                  >
                    <ToolbarIcon name={button.icon} />
                  </button>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </Section>
  );
}
