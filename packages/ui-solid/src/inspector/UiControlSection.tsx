import { searchIcons, type Editor } from "@nodetto/core";
import {
  UI_CONTROL_KINDS,
  type Element,
  type UiControlKind,
  type UiControlSemantic,
} from "@nodetto/ir";
import { createSignal, For, Show, type JSX } from "solid-js";
import { Switch } from "../Switch.tsx";
import {
  Field,
  NumberInput,
  Section,
  SelectInput,
  TextArea,
  TextInput,
} from "./controls.tsx";
import { writeSemantic, writeVisual } from "./write.ts";

function IconInput(props: {
  id: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
}): JSX.Element {
  const [query, setQuery] = createSignal(props.value);
  return (
    <>
      <input
        class="nodetto-input"
        aria-label={props.label}
        list={props.id}
        value={props.value}
        onInput={(event) => setQuery(event.currentTarget.value)}
        onChange={(event) => {
          props.onCommit(event.currentTarget.value);
          event.currentTarget.value = props.value;
        }}
      />
      <datalist id={props.id}>
        <For each={searchIcons(query())}>
          {(name) => <option value={name} />}
        </For>
      </datalist>
    </>
  );
}
export function UiControlSection(props: {
  editor: Editor;
  element: Element;
}): JSX.Element {
  const semantic = () => props.element.semantic as UiControlSemantic;
  const write = (patch: Partial<UiControlSemantic>) =>
    writeSemantic(props.editor, props.element.id, { ...semantic(), ...patch });
  const writeColor = (key: "accentColor" | "selectedColor", value: string) => {
    const current = props.editor.store.get(props.element.id);
    if (current)
      writeVisual(props.editor, props.element.id, {
        style: { ...current.visual.style, [key]: value || undefined },
      });
  };
  return (
    <Section title="UI control">
      <Field label="Control">
        <SelectInput
          label="UI control kind"
          value={semantic().control}
          options={UI_CONTROL_KINDS.map((kind) => ({
            value: kind,
            label: kind,
          }))}
          onCommit={(control) => write({ control: control as UiControlKind })}
        />
      </Field>
      <Show when={semantic().control === "input"}>
        <Field label="Input type">
          <SelectInput
            label="Input type"
            value={semantic().inputType ?? "text"}
            options={[
              "text",
              "email",
              "password",
              "number",
              "search",
              "tel",
              "url",
              "date",
            ].map((value) => ({ value, label: value }))}
            onCommit={(inputType) =>
              write({ inputType: inputType as UiControlSemantic["inputType"] })
            }
          />
        </Field>
      </Show>
      <Show when={semantic().control === "tabs"}>
        <Field label="Indicator">
          <SelectInput
            label="Tab indicator"
            value={semantic().indicator ?? "cell"}
            options={["cell", "underline", "pill"].map((value) => ({
              value,
              label: value,
            }))}
            onCommit={(indicator) =>
              write({ indicator: indicator as UiControlSemantic["indicator"] })
            }
          />
        </Field>
        <Field label="Selected color">
          <TextInput
            label="Selected color"
            value={props.element.visual.style?.selectedColor ?? ""}
            onCommit={(value) => writeColor("selectedColor", value)}
          />
        </Field>
      </Show>
      <Field label="Accent color">
        <TextInput
          label="Accent color"
          value={props.element.visual.style?.accentColor ?? ""}
          onCommit={(value) => writeColor("accentColor", value)}
        />
      </Field>
      <Field label="Leading icon">
        <IconInput
          id={`nd-leading-${props.element.id}`}
          label="Leading icon"
          value={semantic().leadingIcon ?? ""}
          onCommit={(value) => write({ leadingIcon: value || undefined })}
        />
      </Field>
      <Field label="Trailing icon">
        <IconInput
          id={`nd-trailing-${props.element.id}`}
          label="Trailing icon"
          value={semantic().trailingIcon ?? ""}
          onCommit={(value) => write({ trailingIcon: value || undefined })}
        />
      </Field>
      <Field label="Icon size">
        <NumberInput
          label="Icon size"
          min={1}
          value={semantic().iconSize ?? 20}
          onCommit={(iconSize) => write({ iconSize })}
        />
      </Field>
      <Field label="Badge">
        <SelectInput
          label="Badge mode"
          value={
            semantic().badge === undefined
              ? "none"
              : semantic().badge === ""
                ? "dot"
                : "text"
          }
          options={[
            { value: "none", label: "None" },
            { value: "dot", label: "Dot" },
            { value: "text", label: "Text" },
          ]}
          onCommit={(mode) =>
            write({
              badge: mode === "none" ? undefined : mode === "dot" ? "" : "1",
            })
          }
        />
      </Field>
      <Show when={semantic().badge !== undefined && semantic().badge !== ""}>
        <Field label="Badge text">
          <TextInput
            label="Badge text"
            value={semantic().badge ?? ""}
            onCommit={(badge) => write({ badge })}
          />
        </Field>
      </Show>
      <Field label="Label">
        <TextInput
          label="Control label"
          value={semantic().label}
          onCommit={(label) => write({ label })}
        />
      </Field>
      <Show
        when={["input", "textarea", "select", "tabs"].includes(
          semantic().control,
        )}
      >
        <Field label="Value">
          <TextInput
            label="Control value"
            value={semantic().value ?? ""}
            onCommit={(value) => write({ value })}
          />
        </Field>
      </Show>
      <Show
        when={
          semantic().control === "input" || semantic().control === "textarea"
        }
      >
        <Field label="Placeholder">
          <TextInput
            label="Control placeholder"
            value={semantic().placeholder ?? ""}
            onCommit={(placeholder) => write({ placeholder })}
          />
        </Field>
      </Show>
      <Show
        when={semantic().control === "select" || semantic().control === "tabs"}
      >
        <Field label="Options">
          <TextArea
            label="Select options, one per line"
            rows={5}
            value={(semantic().options ?? []).join("\n")}
            onCommit={(value) => write({ options: value.split("\n") })}
          />
        </Field>
      </Show>
      <Show when={["checkbox", "switch", "radio"].includes(semantic().control)}>
        <Field label="Checked">
          <Switch
            aria-label="Control checked"
            checked={semantic().checked ?? false}
            onChange={(event) =>
              write({ checked: event.currentTarget.checked })
            }
          />
        </Field>
      </Show>
      <Show when={semantic().control === "progress"}>
        <Field label="Progress (%)">
          <NumberInput
            label="Progress percent"
            min={0}
            max={100}
            value={semantic().progress ?? 0}
            onCommit={(progress) => write({ progress })}
          />
        </Field>
      </Show>
      <Field label="Disabled">
        <Switch
          aria-label="Control disabled"
          checked={semantic().disabled ?? false}
          onChange={(event) => write({ disabled: event.currentTarget.checked })}
        />
      </Field>
    </Section>
  );
}
