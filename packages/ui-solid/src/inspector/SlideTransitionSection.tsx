import type { Editor } from "@nodetto/core";
import { ANIMATION_LIMITS, type PageId, type SlideMode } from "@nodetto/ir";
import { createMemo, type JSX } from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import {
  Checkbox,
  Field,
  NumberInput,
  Section,
  SelectInput,
} from "./controls.tsx";
import {
  planSlideSettingsEdit,
  slideSettingsOf,
} from "./slide-transition-edits.ts";
export function SlideTransitionSection(props: {
  readonly editor: Editor;
  readonly pageId: PageId;
}): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const settings = createMemo(() => {
    signals.rev();
    return slideSettingsOf(props.editor, props.pageId);
  });
  const apply = (patch: Parameters<typeof planSlideSettingsEdit>[2]) => {
    if (props.editor.readOnly) return;
    const commands = planSlideSettingsEdit(props.editor, props.pageId, patch);
    if (commands.length) props.editor.apply(commands);
  };
  return (
    <Section title="Slide transition">
      <Field label="Mode">
        <SelectInput
          label="Mode"
          value={settings().mode ?? "auto"}
          options={[
            { value: "auto", label: "Auto" },
            { value: "cut", label: "Cut" },
            { value: "fade", label: "Fade" },
          ]}
          disabled={props.editor.readOnly}
          onCommit={(value) => apply({ mode: value as SlideMode })}
        />
      </Field>
      <Field label="Duration (ms)">
        <NumberInput
          label="Duration (ms)"
          value={settings().durationMs ?? null}
          min={ANIMATION_LIMITS.slideDurationMs[0]}
          max={ANIMATION_LIMITS.slideDurationMs[1]}
          disabled={props.editor.readOnly}
          onCommit={(durationMs) => apply({ durationMs })}
        />
      </Field>
      <Checkbox
        label="Stagger"
        checked={settings().stagger ?? true}
        disabled={props.editor.readOnly || settings().mode !== "auto"}
        onCommit={(stagger) => apply({ stagger })}
      />
      <button
        type="button"
        disabled={props.editor.readOnly}
        onClick={() => apply({ mode: null, durationMs: null, stagger: null })}
      >
        Reset
      </button>
    </Section>
  );
}
