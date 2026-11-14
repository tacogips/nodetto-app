import { For, Show, type JSX } from "solid-js";
import type { ElementSectionProps } from "./SimpleSections.tsx";
import { Field, Section, TextInput } from "./controls.tsx";
import ConnectorRoutingFields from "./ConnectorRoutingFields.tsx";
export function StateSection(props: ElementSectionProps): JSX.Element {
  const data = () => props.element.semantic as Record<string, unknown>;
  const transition = () => props.element.type === "state.transition";
  const write = (patch: Record<string, unknown>) =>
    props.editor.apply([
      {
        type: "updateSemantic",
        id: props.element.id,
        semantic: { ...data(), ...patch },
      },
    ]);
  return (
    <Section title={transition() ? "State transition" : "State"}>
      <Show when={!transition() && data()["kind"] === "state"}>
        <Field label="Name">
          <TextInput
            label="State name"
            value={String(data()["name"] ?? "")}
            onCommit={(name) => write({ name })}
          />
        </Field>
      </Show>
      <Show when={!transition() && data()["kind"] !== "state"}>
        <p>{String(data()["kind"])} node</p>
      </Show>
      <Show when={transition()}>
        <For each={["trigger", "guard", "effect"]}>
          {(field) => (
            <Field label={field[0]?.toUpperCase() + field.slice(1)}>
              <TextInput
                label={`Transition ${field}`}
                value={String(data()[field] ?? "")}
                onCommit={(value) => write({ [field]: value })}
              />
            </Field>
          )}
        </For>
        <p>
          Label: trigger [guard] / effect. Leave fields empty for an automatic
          transition.
        </p>
        <ConnectorRoutingFields semantic={data()} write={write} />
      </Show>
    </Section>
  );
}
