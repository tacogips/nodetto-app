import type { Editor } from "@nodetto/core";
import {
  ANIMATION_LIMITS,
  type Element,
  type ElementAnimation,
} from "@nodetto/ir";
import { createMemo, type JSX, Show } from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import { Field, NumberInput, Section, SelectInput } from "./controls.tsx";
import {
  type AnimationPatch,
  planAnimationEdit,
  sharedAnimationValue,
} from "./slide-animation-edits.ts";
type Key = Exclude<keyof ElementAnimation, "slide">;
const options = (values: readonly string[]) =>
  values.map((value) => ({
    value,
    label:
      value === "auto"
        ? "Auto"
        : value
            .split("-")
            .map((s) => s[0]?.toUpperCase() + s.slice(1))
            .join(" "),
  }));
export function SlideAnimationSection(props: {
  readonly editor: Editor;
  readonly elements: readonly Element[];
}): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const current = createMemo(() => {
    signals.rev();
    return props.elements
      .map((e) => props.editor.store.get(e.id))
      .filter((e): e is Element => e !== undefined);
  });
  const apply = (patch: AnimationPatch) => {
    if (props.editor.readOnly) return;
    const commands = planAnimationEdit(current(), patch);
    if (commands.length) props.editor.apply(commands);
  };
  const select = (label: string, key: Key, values: readonly string[]) => {
    const value = () =>
      sharedAnimationValue(current(), key) ??
      (key === "enterFrom" || key === "exitTo" ? "bottom" : "auto");
    return (
      <Field label={label}>
        <SelectInput
          label={label}
          value={value() === "mixed" ? "__mixed" : String(value())}
          options={
            value() === "mixed"
              ? [{ value: "__mixed", label: "Mixed" }, ...options(values)]
              : options(values)
          }
          disabled={props.editor.readOnly}
          onCommit={(v) => {
            if (v !== "__mixed") apply({ [key]: v } as AnimationPatch);
          }}
        />
      </Field>
    );
  };
  const number = (label: string, key: "delayMs" | "durationMs" | "order") => (
    <Field label={label}>
      <NumberInput
        label={label}
        value={
          typeof sharedAnimationValue(current(), key) === "number"
            ? (sharedAnimationValue(current(), key) as number)
            : null
        }
        min={ANIMATION_LIMITS[key][0]}
        max={ANIMATION_LIMITS[key][1]}
        disabled={props.editor.readOnly}
        onCommit={(v) => apply({ [key]: v })}
      />
    </Field>
  );
  return (
    <Section title="Slide animation">
      {select("Enter", "enter", [
        "auto",
        "none",
        "fade-in",
        "draw-on",
        "grow",
        "scale-in",
        "slide-in",
      ])}
      <Show when={sharedAnimationValue(current(), "enter") === "slide-in"}>
        {select("Enter from", "enterFrom", ["left", "right", "top", "bottom"])}
      </Show>
      {select("Exit", "exit", [
        "auto",
        "none",
        "fade-out",
        "undraw",
        "scale-out",
        "slide-out",
      ])}
      <Show when={sharedAnimationValue(current(), "exit") === "slide-out"}>
        {select("Exit to", "exitTo", ["left", "right", "top", "bottom"])}
      </Show>
      {select("Linked motion", "linked", ["auto", "cut", "crossfade"])}
      {number("Delay (ms)", "delayMs")}
      {number("Duration (ms)", "durationMs")}
      {number("Order", "order")}
      <button
        type="button"
        disabled={props.editor.readOnly}
        onClick={() =>
          apply({
            enter: null,
            enterFrom: null,
            exit: null,
            exitTo: null,
            linked: null,
            delayMs: null,
            durationMs: null,
            order: null,
          })
        }
      >
        Reset
      </button>
    </Section>
  );
}
