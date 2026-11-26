import {
  SCHEMATIC_BJT_POLARITIES,
  SCHEMATIC_IC_MAX_PINS,
  SCHEMATIC_IC_SIDES,
  SCHEMATIC_MOSFET_CHANNELS,
  SCHEMATIC_POWER_STYLES,
  SCHEMATIC_SWITCH_STYLES,
  isSchematicPartType,
  type SchematicIcSemantic,
} from "@nodetto/ir";
import { createMemo, For, Show, type JSX } from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import { Field, NumberInput, Section, TextInput } from "./controls.tsx";
import {
  netPatch,
  pinCountPatch,
  pinsPatch,
  schematicPinRows,
  writeSchematicSemantic,
} from "./schematic-edits.ts";
import type { ElementSectionProps } from "./SimpleSections.tsx";

type Pin = SchematicIcSemantic["pins"][number];
export function SchematicSection(props: ElementSectionProps): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const current = () => {
    signals.rev();
    return props.editor.store.get(props.element.id) ?? props.element;
  };
  const semantic = () => current().semantic as Record<string, unknown>;
  const pins = () => (semantic().pins ?? []) as readonly Pin[];
  const write = (patch: Readonly<Record<string, unknown>> | null) => {
    if (patch) writeSchematicSemantic(props.editor, current().id, patch);
  };
  const text = (key: string, label: string) => (
    <Field label={label}>
      <TextInput
        label={label}
        value={String(semantic()[key] ?? "")}
        onCommit={(value) =>
          write(key === "net" ? netPatch(value) : { [key]: value })
        }
      />
    </Field>
  );
  const select = (key: string, label: string, choices: readonly string[]) => (
    <Field label={label}>
      <select
        class="nodetto-select"
        aria-label={label}
        value={String(semantic()[key] ?? "")}
        on:change={(e) => {
          write({ [key]: e.currentTarget.value });
          e.currentTarget.value = String(semantic()[key] ?? "");
        }}
      >
        <For each={choices}>
          {(choice) => <option value={choice}>{choice}</option>}
        </For>
      </select>
    </Field>
  );
  const updatePin = (index: number, patch: Partial<Pin>) =>
    write(
      pinsPatch(
        pins().map((pin, i) => (i === index ? { ...pin, ...patch } : pin)),
      ),
    );
  const movePin = (index: number, delta: number) => {
    const copy = [...pins()];
    const other = index + delta;
    const a = copy[index];
    const b = copy[other];
    if (!a || !b) return;
    copy[index] = b;
    copy[other] = a;
    write(pinsPatch(copy));
  };
  const addPin = () => {
    const used = new Set(pins().map((pin) => pin.number));
    let number = 1;
    while (used.has(number)) number++;
    write(pinsPatch([...pins(), { number, name: "", side: "left" }]));
  };
  const rows = createMemo(() => {
    signals.rev();
    return schematicPinRows(
      props.editor.store.getSnapshot(),
      current().page,
      current().id,
    );
  });
  const part = () => isSchematicPartType(current().type);
  return (
    <Section title={part() ? "Symbol" : "Schematic"}>
      <Show when={part()}>
        {text("reference", "Reference")}
        {text("value", "Value")}
      </Show>
      <Show when={current().type === "schematic.capacitor"}>
        <Field label="Polarized">
          <input
            type="checkbox"
            aria-label="Polarized"
            checked={semantic().polarized === true}
            on:change={(e) => write({ polarized: e.currentTarget.checked })}
          />
        </Field>
      </Show>
      <Show when={current().type === "schematic.bjt"}>
        {select("polarity", "Polarity", SCHEMATIC_BJT_POLARITIES)}
      </Show>
      <Show when={current().type === "schematic.mosfet"}>
        {select("channel", "Channel", SCHEMATIC_MOSFET_CHANNELS)}
      </Show>
      <Show when={current().type === "schematic.switch"}>
        {select("style", "Style", SCHEMATIC_SWITCH_STYLES)}
      </Show>
      <Show when={current().type === "schematic.power"}>
        {select("style", "Style", SCHEMATIC_POWER_STYLES)}
      </Show>
      <Show
        when={
          current().type === "schematic.power" ||
          current().type === "schematic.label"
        }
      >
        {text("net", "Net name")}
      </Show>
      <Show when={current().type === "schematic.connector"}>
        <Field label="Pin count">
          <NumberInput
            label="Pin count"
            value={
              typeof semantic().pinCount === "number"
                ? (semantic().pinCount as number)
                : null
            }
            min={1}
            max={40}
            onCommit={(value) => write(pinCountPatch(value))}
          />
        </Field>
      </Show>
      <Show when={current().type === "schematic.ic"}>
        <Field label="IC pins">
          <div role="group" aria-label="IC pins">
            <For each={pins()}>
              {(pin, index) => (
                <div>
                  <NumberInput
                    label={`Pin ${index() + 1} number`}
                    value={pin.number}
                    min={1}
                    onCommit={(value) => updatePin(index(), { number: value })}
                  />
                  <TextInput
                    label={`Pin ${index() + 1} name`}
                    value={pin.name}
                    onCommit={(name) => updatePin(index(), { name })}
                  />
                  <select
                    class="nodetto-select"
                    aria-label={`Pin ${index() + 1} side`}
                    value={pin.side}
                    on:change={(e) => {
                      const side = SCHEMATIC_IC_SIDES.find(
                        (s) => s === e.currentTarget.value,
                      );
                      if (side) updatePin(index(), { side });
                    }}
                  >
                    <For each={SCHEMATIC_IC_SIDES}>
                      {(side) => <option value={side}>{side}</option>}
                    </For>
                  </select>
                  <button
                    type="button"
                    disabled={index() === 0}
                    onClick={() => movePin(index(), -1)}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={index() === pins().length - 1}
                    onClick={() => movePin(index(), 1)}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    disabled={pins().length <= 1}
                    onClick={() =>
                      write(pinsPatch(pins().filter((_, i) => i !== index())))
                    }
                  >
                    Remove pin
                  </button>
                </div>
              )}
            </For>
            <button
              type="button"
              disabled={pins().length >= SCHEMATIC_IC_MAX_PINS}
              onClick={addPin}
            >
              Add pin
            </button>
          </div>
        </Field>
      </Show>
      <Show
        when={
          part() ||
          current().type === "schematic.power" ||
          current().type === "schematic.label"
        }
      >
        <div role="group" aria-label="Symbol transform">
          <button
            type="button"
            onClick={() =>
              props.editor.rotateSchematicElements([current().id], -1)
            }
          >
            Rotate left
          </button>
          <button
            type="button"
            onClick={() =>
              props.editor.rotateSchematicElements([current().id], 1)
            }
          >
            Rotate right
          </button>
          <Show when={part()}>
            <button
              type="button"
              onClick={() => props.editor.mirrorSchematicParts([current().id])}
            >
              Mirror
            </button>
          </Show>
        </div>
      </Show>
      <Show when={part()}>
        <Field label="Pins">
          <ul aria-label="Schematic pins">
            <For each={rows()}>
              {(row) => (
                <li>
                  {row.name} (pin {row.pin}) - {row.net || "Unconnected"}
                </li>
              )}
            </For>
          </ul>
        </Field>
      </Show>
    </Section>
  );
}
