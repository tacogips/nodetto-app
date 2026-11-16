import {
  frameParents,
  PAGE_FRAME_PRESETS,
  pageFlowOf,
  pageFramePresetOf,
  type Command,
} from "@nodetto/core";
import type {
  FrameSemantic,
  PageFrameOrientation,
  PageFrameSize,
} from "@nodetto/ir";
import { For, type JSX, Show } from "solid-js";
import { Switch } from "../Switch.tsx";
import { Field, Section } from "./controls.tsx";
import {
  pageFrameSizeCommands,
  pageFrameToggleCommands,
} from "./page-frame-edits.ts";
import type { ElementSectionProps } from "./semantic-fields.ts";

export function PageFrameSection(props: ElementSectionProps): JSX.Element {
  const semantic = () => props.element.semantic as FrameSemantic;
  const parent = () =>
    frameParents(
      props.editor.store,
      props.element.page,
      props.editor.createShapeContext(),
    ).has(props.element.id);
  const apply = (commands: Command[]) => {
    if (props.editor.readOnly || commands.length === 0) return;
    if (commands.length > 1) props.editor.beginBatch();
    try {
      props.editor.apply(commands);
    } finally {
      if (commands.length > 1) props.editor.endBatch();
    }
  };
  const preset = () =>
    pageFramePresetOf(
      {
        width: props.element.visual.width ?? 0,
        height: props.element.visual.height ?? 0,
      },
      semantic().page,
    );
  return (
    <Section title="Page frame">
      <label>
        <Switch
          checked={!!semantic().page}
          disabled={props.editor.readOnly || parent()}
          onChange={() =>
            apply(
              pageFrameToggleCommands(
                props.element,
                pageFlowOf(props.editor.store.getPage(props.element.page)),
              ),
            )
          }
        />
        Page
      </label>
      <Show when={semantic().page}>
        <Field label="Size">
          <select
            class="nodetto-input"
            aria-label="Page size"
            disabled={props.editor.readOnly}
            value={preset()}
            onChange={(event) =>
              apply(
                pageFrameSizeCommands(
                  props.element,
                  event.currentTarget.value as PageFrameSize,
                  semantic().page?.orientation ?? "portrait",
                ),
              )
            }
          >
            <For each={PAGE_FRAME_PRESETS}>
              {(item) => <option value={item.id}>{item.label}</option>}
            </For>
            <option value="custom">Custom</option>
          </select>
        </Field>
        <Field label="Orientation">
          <select
            class="nodetto-input"
            aria-label="Page orientation"
            disabled={props.editor.readOnly}
            value={semantic().page?.orientation ?? "portrait"}
            onChange={(event) =>
              apply(
                pageFrameSizeCommands(
                  props.element,
                  preset() as PageFrameSize,
                  event.currentTarget.value as PageFrameOrientation,
                ),
              )
            }
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </Field>
        <button
          type="button"
          disabled={props.editor.readOnly}
          onClick={() => props.editor.addPageFrame()}
        >
          Add page
        </button>
      </Show>
    </Section>
  );
}
