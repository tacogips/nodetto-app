// Shape, node and text note sections: the label, kind and inline text
// formatting of single content elements.

import {
  flipCommands,
  removeTextMarkRange,
  textNoteMarks,
  textRangeHasMark,
} from "@nodetto/core";
import { GEO_KINDS, type TextMarkKind } from "@nodetto/ir";
import { createSignal, For, type JSX } from "solid-js";
import { Switch } from "../Switch.tsx";
import {
  Field,
  Section,
  SelectInput,
  type SelectOption,
  TextArea,
  TextInput,
} from "./controls.tsx";
import { withOptionalString } from "./edits.ts";
import {
  type ElementSectionProps,
  record,
  stringOf,
} from "./semantic-fields.ts";
import { writeSemantic } from "./write.ts";

/** Names that read better than the stored kind in the shape picker. */
const GEO_LABELS: Partial<Record<(typeof GEO_KINDS)[number], string>> = {
  rect: "Rectangle",
  actor: "Stick figure",
  arrow: "Block arrow",
  note: "Folded note",
  "off-page": "Off-page connector",
  tape: "Paper tape",
  "multi-document": "Multi-document",
};

const GEO_OPTIONS: readonly SelectOption[] = GEO_KINDS.map((kind) => ({
  value: kind,
  label:
    GEO_LABELS[kind] ??
    kind.charAt(0).toUpperCase() + kind.slice(1).replaceAll("-", " "),
}));

export function GeoSection(props: ElementSectionProps): JSX.Element {
  const semantic = () => record(props.element.semantic);
  return (
    <Section title="Shape">
      <Field label="Kind">
        <SelectInput
          label="Shape kind"
          value={stringOf(semantic(), "geo") || "rect"}
          options={GEO_OPTIONS}
          onCommit={(geo) =>
            writeSemantic(props.editor, props.element.id, {
              ...semantic(),
              geo,
            })
          }
        />
      </Field>
      <Field label="Label">
        <TextInput
          label="Label"
          value={stringOf(semantic(), "label")}
          onCommit={(label) =>
            writeSemantic(
              props.editor,
              props.element.id,
              withOptionalString(semantic(), "label", label),
            )
          }
        />
      </Field>
      <For
        each={
          [
            { axis: "horizontal", field: "flipX", label: "Flip horizontally" },
            { axis: "vertical", field: "flipY", label: "Flip vertically" },
          ] as const
        }
      >
        {(flip) => (
          <label>
            <Switch
              checked={props.element.visual[flip.field] === true}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                props.editor.apply(
                  flipCommands([props.element], flip.axis, () => checked),
                );
              }}
            />
            {flip.label}
          </label>
        )}
      </For>
    </Section>
  );
}

export function NodeSection(props: ElementSectionProps): JSX.Element {
  const semantic = () => record(props.element.semantic);
  return (
    <Section title="Node">
      <Field label="Label">
        <TextArea
          label="Label"
          value={stringOf(semantic(), "label")}
          onCommit={(label) =>
            writeSemantic(props.editor, props.element.id, {
              ...semantic(),
              label,
            })
          }
        />
      </Field>
    </Section>
  );
}

export function TextNoteSection(props: ElementSectionProps): JSX.Element {
  const semantic = () => record(props.element.semantic);
  const text = () => stringOf(semantic(), "text");
  const marks = () => textNoteMarks(props.element.semantic);
  const [selection, setSelection] = createSignal({ start: 0, end: 0 });
  const [href, setHref] = createSignal("");
  const hasSelection = () => selection().end > selection().start;
  const toggle = (kind: TextMarkKind): void => {
    const range = selection();
    props.editor.toggleTextMark(props.element.id, range.start, range.end, kind);
  };
  const active = (kind: TextMarkKind): boolean => {
    const range = selection();
    return textRangeHasMark(text(), marks(), range.start, range.end, kind);
  };
  return (
    <Section title="Text" help="Select characters to apply inline formatting.">
      <TextArea
        label="Text"
        rows={5}
        value={text()}
        onCommit={(value) => props.editor.setText(props.element.id, value)}
        onSelectionChange={(start, end) => setSelection({ start, end })}
      />
      <div
        class="nodetto-rich-text-controls"
        role="toolbar"
        aria-label="Rich text"
      >
        <For each={["bold", "italic", "underline", "code", "strike"] as const}>
          {(kind) => (
            <button
              type="button"
              aria-pressed={active(kind)}
              disabled={!hasSelection()}
              onClick={() => toggle(kind)}
            >
              {kind === "bold"
                ? "Bold"
                : kind === "italic"
                  ? "Italic"
                  : kind === "underline"
                    ? "Underline"
                    : kind === "code"
                      ? "Code"
                      : "Strike"}
            </button>
          )}
        </For>
      </div>
      <Field label="Link">
        <TextInput
          label="Selected text link"
          value={href()}
          placeholder="https://example.com"
          onCommit={setHref}
          disabled={!hasSelection()}
        />
      </Field>
      <div class="nodetto-rich-text-controls">
        <button
          type="button"
          disabled={!hasSelection() || href().trim() === ""}
          onClick={() => {
            const range = selection();
            props.editor.toggleTextMark(
              props.element.id,
              range.start,
              range.end,
              "link",
              href(),
            );
          }}
        >
          Apply link
        </button>
        <button
          type="button"
          disabled={!hasSelection() || !active("link")}
          onClick={() => {
            const range = selection();
            props.editor.setRichText(
              props.element.id,
              text(),
              removeTextMarkRange(
                text(),
                marks(),
                range.start,
                range.end,
                "link",
              ),
            );
          }}
        >
          Remove link
        </button>
        <button
          type="button"
          disabled={!hasSelection()}
          onClick={() => {
            const range = selection();
            props.editor.setRichText(
              props.element.id,
              text(),
              removeTextMarkRange(text(), marks(), range.start, range.end),
            );
          }}
        >
          Clear formatting
        </button>
      </div>
    </Section>
  );
}
