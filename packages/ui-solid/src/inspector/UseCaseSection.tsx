import { USECASE_NODE_KINDS, USECASE_RELATIONSHIP_KINDS } from "@nodetto/ir";
import { Show, type JSX } from "solid-js";
import type { ElementSectionProps } from "./SimpleSections.tsx";
import { Field, Section, SelectInput, TextInput } from "./controls.tsx";
import ConnectorRoutingFields from "./ConnectorRoutingFields.tsx";

const NODE_KIND_LABELS: Readonly<Record<string, string>> = {
  actor: "Actor",
  usecase: "Use case",
  system: "System boundary",
};
const RELATIONSHIP_KIND_LABELS: Readonly<Record<string, string>> = {
  association: "Association",
  include: "Include «include»",
  extend: "Extend «extend»",
  generalization: "Generalization",
};

export function UseCaseSection(props: ElementSectionProps): JSX.Element {
  const data = () => props.element.semantic as Record<string, unknown>;
  const relationship = () => props.element.type === "usecase.relationship";
  const write = (patch: Record<string, unknown>) =>
    props.editor.apply([
      {
        type: "updateSemantic",
        id: props.element.id,
        semantic: { ...data(), ...patch },
      },
    ]);
  // An optional label is dropped rather than stored empty.
  const writeLabel = (label: string) => {
    const { label: _previous, ...rest } = data();
    props.editor.apply([
      {
        type: "updateSemantic",
        id: props.element.id,
        semantic: label ? { ...rest, label } : rest,
      },
    ]);
  };
  return (
    <Section title={relationship() ? "Use-case relationship" : "Use case"}>
      <Show when={!relationship()}>
        <Field label="Name">
          <TextInput
            label="Use-case name"
            value={String(data()["name"] ?? "")}
            onCommit={(name) => write({ name })}
          />
        </Field>
        <Field label="Kind">
          <SelectInput
            label="Use-case node kind"
            value={String(data()["kind"])}
            options={USECASE_NODE_KINDS.map((value) => ({
              value,
              label: NODE_KIND_LABELS[value] ?? value,
            }))}
            onCommit={(kind) => write({ kind })}
          />
        </Field>
      </Show>
      <Show when={relationship()}>
        <Field label="Kind">
          <SelectInput
            label="Use-case relationship kind"
            value={String(data()["kind"])}
            options={USECASE_RELATIONSHIP_KINDS.map((value) => ({
              value,
              label: RELATIONSHIP_KIND_LABELS[value] ?? value,
            }))}
            onCommit={(kind) => write({ kind })}
          />
        </Field>
        <Field label="Label">
          <TextInput
            label="Relationship label"
            value={String(data()["label"] ?? "")}
            onCommit={writeLabel}
          />
        </Field>
        <ConnectorRoutingFields semantic={data()} write={write} />
      </Show>
    </Section>
  );
}
