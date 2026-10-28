// Sequence diagram sections: participant and message fields plus their
// ordering controls.

import { compareFractional } from "@nodetto/core";
import { MESSAGE_KINDS, PARTICIPANT_KINDS } from "@nodetto/ir";
import type { JSX } from "solid-js";
import { Field, Section, SelectInput, TextInput } from "./controls.tsx";
import { withOptionalString } from "./edits.ts";
import {
  type ElementSectionProps,
  record,
  stringOf,
} from "./semantic-fields.ts";
import { writeSemantic } from "./write.ts";

export function SequenceParticipantSection(
  props: ElementSectionProps,
): JSX.Element {
  const semantic = () => record(props.element.semantic);
  const position = () =>
    props.editor.store
      .getPageElements(props.element.page)
      .filter((element) => element.type === "sequence.participant")
      .sort(
        (left, right) =>
          compareFractional(
            stringOf(record(left.semantic), "order"),
            stringOf(record(right.semantic), "order"),
          ) || compareFractional(left.id, right.id),
      )
      .findIndex((element) => element.id === props.element.id);
  const count = () =>
    props.editor.store
      .getPageElements(props.element.page)
      .filter((element) => element.type === "sequence.participant").length;
  return (
    <Section title="Sequence participant">
      <Field label="Name">
        <TextInput
          label="Participant name"
          value={stringOf(semantic(), "name")}
          onCommit={(name) =>
            writeSemantic(props.editor, props.element.id, {
              ...semantic(),
              name,
            })
          }
        />
      </Field>
      <Field label="Kind">
        <SelectInput
          label="Participant kind"
          value={stringOf(semantic(), "kind") || "service"}
          options={PARTICIPANT_KINDS.map((kind) => ({
            value: kind,
            label: kind.charAt(0).toUpperCase() + kind.slice(1),
          }))}
          onCommit={(kind) =>
            writeSemantic(props.editor, props.element.id, {
              ...semantic(),
              kind,
            })
          }
        />
      </Field>
      <div>
        <button
          type="button"
          class="nodetto-inspector-button"
          disabled={position() <= 0}
          onClick={() => props.editor.moveSequenceElement(props.element.id, -1)}
        >
          Move left
        </button>
        <button
          type="button"
          class="nodetto-inspector-button"
          disabled={position() < 0 || position() >= count() - 1}
          onClick={() => props.editor.moveSequenceElement(props.element.id, 1)}
        >
          Move right
        </button>
      </div>
      <button
        type="button"
        class="nodetto-inspector-button"
        onClick={() => {
          const id = props.editor.createSequenceActivation(props.element.id);
          if (id) props.editor.selection.set([id]);
        }}
      >
        Add activation
      </button>
    </Section>
  );
}

export function SequenceMessageSection(
  props: ElementSectionProps,
): JSX.Element {
  const semantic = () => record(props.element.semantic);
  const position = () =>
    props.editor.store
      .getPageElements(props.element.page)
      .filter((element) => element.type === "sequence.message")
      .sort(
        (left, right) =>
          compareFractional(
            stringOf(record(left.semantic), "order"),
            stringOf(record(right.semantic), "order"),
          ) || compareFractional(left.id, right.id),
      )
      .findIndex((element) => element.id === props.element.id);
  const count = () =>
    props.editor.store
      .getPageElements(props.element.page)
      .filter((element) => element.type === "sequence.message").length;
  return (
    <Section title="Sequence message">
      <Field label="Label">
        <TextInput
          label="Message label"
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
      <Field label="Kind">
        <SelectInput
          label="Message kind"
          value={stringOf(semantic(), "kind") || "sync"}
          options={MESSAGE_KINDS.map((kind) => ({
            value: kind,
            label: kind.charAt(0).toUpperCase() + kind.slice(1),
          }))}
          onCommit={(kind) =>
            writeSemantic(props.editor, props.element.id, {
              ...semantic(),
              kind,
            })
          }
        />
      </Field>
      <div>
        <button
          type="button"
          class="nodetto-inspector-button"
          disabled={position() <= 0}
          onClick={() => props.editor.moveSequenceElement(props.element.id, -1)}
        >
          Earlier
        </button>
        <button
          type="button"
          class="nodetto-inspector-button"
          disabled={position() < 0 || position() >= count() - 1}
          onClick={() => props.editor.moveSequenceElement(props.element.id, 1)}
        >
          Later
        </button>
      </div>
    </Section>
  );
}
