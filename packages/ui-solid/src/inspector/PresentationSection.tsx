import {
  DEFAULT_SLIDE_SIZE,
  SLIDE_SIZE_PRESETS,
  slideSizePreset,
  type Command,
  type Editor,
  type SlideSizePresetId,
} from "@nodetto/core";
import type { Page } from "@nodetto/ir";
import { createMemo, createSignal, For, type JSX, Show } from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import { NumberInput } from "../NumberInput.tsx";
import { Field, Section } from "./controls.tsx";
import {
  clampSlideDimension,
  slideOriginCommand,
  slideSizeCommand,
} from "./presentation-settings.ts";

export function PresentationSection(props: {
  readonly editor: Editor;
  readonly page: Page;
}): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const [customSelected, setCustomSelected] = createSignal(false);
  const size = createMemo(() => {
    signals.rev();
    return props.editor.store.getMeta().slideSize;
  });
  const apply = (command: Command | null) => {
    if (command && !props.editor.readOnly) props.editor.apply([command]);
  };
  const setDimension = (axis: "width" | "height", value: number) => {
    const clamped = clampSlideDimension(value);
    if (clamped !== null)
      apply(
        slideSizeCommand(size(), "custom", {
          ...(size() ?? DEFAULT_SLIDE_SIZE),
          [axis]: clamped,
        }),
      );
  };
  const setOrigin = (axis: "x" | "y", value: number) => {
    if (Number.isFinite(value))
      apply(
        slideOriginCommand(props.page, {
          ...(props.page.slideOrigin ?? { x: 0, y: 0 }),
          [axis]: Math.max(-1000000, Math.min(1000000, value)),
        }),
      );
  };
  return (
    <Section title="Presentation">
      <Field label="Slide size">
        <select
          class="nodetto-input"
          aria-label="Slide size"
          disabled={props.editor.readOnly}
          value={
            size()
              ? customSelected()
                ? "custom"
                : slideSizePreset(size() ?? DEFAULT_SLIDE_SIZE)
              : "none"
          }
          onChange={(event) => {
            const choice = event.currentTarget.value as
              | SlideSizePresetId
              | "custom"
              | "none";
            setCustomSelected(choice === "custom");
            apply(slideSizeCommand(size(), choice));
          }}
        >
          <option value="none">None (fit content)</option>
          <For each={SLIDE_SIZE_PRESETS}>
            {(preset) => (
              <option value={preset.id}>
                {preset.label} ({preset.width} × {preset.height})
              </option>
            )}
          </For>
          <option value="custom">Custom</option>
        </select>
      </Field>
      <Show
        when={
          size() &&
          (customSelected() ||
            slideSizePreset(size() ?? DEFAULT_SLIDE_SIZE) === "custom")
        }
      >
        <Field label="Width">
          <NumberInput
            label="Slide width"
            value={size()?.width ?? null}
            disabled={props.editor.readOnly}
            onCommit={(value) => setDimension("width", value)}
          />
        </Field>
        <Field label="Height">
          <NumberInput
            label="Slide height"
            value={size()?.height ?? null}
            disabled={props.editor.readOnly}
            onCommit={(value) => setDimension("height", value)}
          />
        </Field>
      </Show>
      <Show when={size()}>
        <Field label="Slide origin X">
          <NumberInput
            label="Slide origin X"
            value={props.page.slideOrigin?.x ?? 0}
            disabled={props.editor.readOnly}
            onCommit={(value) => setOrigin("x", value)}
          />
        </Field>
        <Field label="Slide origin Y">
          <NumberInput
            label="Slide origin Y"
            value={props.page.slideOrigin?.y ?? 0}
            disabled={props.editor.readOnly}
            onCommit={(value) => setOrigin("y", value)}
          />
        </Field>
        <button
          type="button"
          disabled={props.editor.readOnly}
          onClick={() => apply(slideOriginCommand(props.page, null))}
        >
          Reset origin
        </button>
      </Show>
    </Section>
  );
}
