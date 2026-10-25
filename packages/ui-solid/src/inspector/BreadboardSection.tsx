import {
  breadboardTargetNetlist,
  breadboardTargetStatus,
  type BreadboardPinRef,
  type BreadboardProbe,
  type ViewportSize,
} from "@nodetto/core";
import {
  BREADBOARD_BOARD_SIZES,
  BREADBOARD_CAPACITOR_STYLES,
  BREADBOARD_LED_COLORS,
  BREADBOARD_PART_TYPES,
  BREADBOARD_TOLERANCES,
  BREADBOARD_TRANSISTOR_PINOUTS,
  BREADBOARD_TRANSISTOR_POLARITIES,
  BREADBOARD_WIRE_COLORS,
  isBreadboardPartType,
  type Element,
} from "@nodetto/ir";
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  Show,
} from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import { focusBreadboardProbe } from "../breadboard-problems.ts";
import {
  breadboardNetProbe,
  breadboardPinRows,
  resistorValueSuggestions,
  targetNetProbe,
  targetPartProbe,
  writeBreadboardSemantic,
} from "./breadboard-edits.ts";
import { Field, NumberInput, Section, TextInput } from "./controls.tsx";
import type { ElementSectionProps } from "./SimpleSections.tsx";

type Props = ElementSectionProps & {
  readonly viewport?: () => ViewportSize;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function stringOf(value: unknown, key: string): string {
  const field = record(value)[key];
  return typeof field === "string" ? field : "";
}

function numberOf(value: unknown, key: string): number | null {
  const field = record(value)[key];
  return typeof field === "number" && Number.isFinite(field) ? field : null;
}

function values(values: readonly (string | number)[]): readonly string[] {
  return values.map(String);
}

function typeLabel(type: string): string {
  if (type === "breadboard.netlist") return "Target netlist";
  if (
    BREADBOARD_PART_TYPES.includes(
      type as (typeof BREADBOARD_PART_TYPES)[number],
    )
  )
    return "Part";
  return "Breadboard";
}

export function BreadboardSection(props: Props): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const current = (): Element =>
    props.editor.store.get(props.element.id) ?? props.element;
  const semantic = () => current().semantic;
  const pageId = (): string => current().page;
  const document = () => {
    signals.rev();
    return props.editor.store.getSnapshot();
  };
  const write = (patch: Readonly<Record<string, unknown>>): void => {
    const element = current();
    if (!element.type.startsWith("breadboard.")) return;
    writeBreadboardSemantic(props.editor, element.id, patch);
  };
  const setField = (key: string, value: unknown): void => {
    const next = { ...record(semantic()) };
    if (value === undefined) delete next[key];
    else next[key] = value;
    write(next);
  };
  const textField = (key: string, label: string): JSX.Element => (
    <Field label={label}>
      <TextInput
        label={label}
        value={stringOf(semantic(), key)}
        onCommit={(value) => setField(key, value)}
      />
    </Field>
  );
  const selectField = (
    key: string,
    label: string,
    choices: readonly (string | number)[],
  ): JSX.Element => {
    const selectedValue = (): string => {
      const value = record(semantic())[key];
      if (typeof value === "string" || typeof value === "number")
        return String(value);
      return key === "tolerance" ? "5" : "";
    };
    return (
      <Field label={label}>
        <select
          class="nodetto-select"
          aria-label={label}
          value={selectedValue()}
          on:change={(event) => {
            const choice = choices.find(
              (candidate) => String(candidate) === event.currentTarget.value,
            );
            if (choice !== undefined) setField(key, choice);
            event.currentTarget.value = selectedValue();
          }}
        >
          <For each={values(choices)}>
            {(value) => (
              <option value={value} selected={value === selectedValue()}>
                {value}
              </option>
            )}
          </For>
        </select>
      </Field>
    );
  };
  const numericField = (
    key: string,
    label: string,
    min: number,
    max: number,
    step = 1,
  ): JSX.Element => (
    <Field label={label}>
      <NumberInput
        label={label}
        value={numberOf(semantic(), key)}
        min={min}
        max={max}
        step={step}
        onCommit={(value) => setField(key, value)}
      />
    </Field>
  );
  const resistorValue = (): string => stringOf(semantic(), "value");
  const [valueDraft, setValueDraft] = createSignal(resistorValue());
  createEffect(() => {
    signals.rev();
    setValueDraft(resistorValue());
  });
  const suggestionListId = `breadboard-e24-${createUniqueId()}`;
  const suggestions = createMemo(() => {
    signals.rev();
    return resistorValueSuggestions(valueDraft());
  });
  const focus = (probe: BreadboardProbe | null): void => {
    if (probe) focusBreadboardProbe(props.editor, probe, props.viewport?.());
  };
  const pinRows = createMemo(() => {
    signals.rev();
    return breadboardPinRows(document(), pageId(), current().id);
  });
  const target = createMemo(() => {
    signals.rev();
    return breadboardTargetNetlist(document(), pageId());
  });
  const targetStatuses = createMemo(() => {
    signals.rev();
    return breadboardTargetStatus(document(), pageId());
  });
  const isPart = (): boolean => isBreadboardPartType(current().type);
  const isResistor = (): boolean => current().type === "breadboard.resistor";
  const isTarget = (): boolean => current().type === "breadboard.netlist";
  const isInactiveTarget = (): boolean =>
    isTarget() && target()?.element.id !== current().id;

  return (
    <Section title={typeLabel(current().type)}>
      {isTarget() ? (
        <>
          <Show when={isInactiveTarget()}>
            <p>Inactive: another target netlist comes first on this page.</p>
          </Show>
          <Show when={!isInactiveTarget()}>
            <Field label="Source">
              <span>{target()?.semantic.source ?? ""}</span>
            </Field>
            <Field label="Format">
              <span>{target()?.semantic.format ?? ""}</span>
            </Field>
            <Field label="Parts">
              <ul aria-label="Target parts">
                <For each={targetStatuses()}>
                  {(part) => (
                    <li>
                      <button
                        type="button"
                        disabled={part.status === "missing"}
                        onClick={() =>
                          focus(
                            targetPartProbe(
                              document(),
                              pageId(),
                              part.reference,
                            ),
                          )
                        }
                      >
                        {part.reference} {part.value} ({part.status})
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Field>
            <Field label="Nets">
              <ul aria-label="Target nets">
                <For each={target()?.semantic.nets ?? []}>
                  {(net) => (
                    <li>
                      <button
                        type="button"
                        onClick={() =>
                          focus(targetNetProbe(document(), pageId(), net.name))
                        }
                      >
                        {net.name}:{" "}
                        {net.nodes
                          .map((node) => `${node.reference}.${node.pin}`)
                          .join(", ")}
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Field>
          </Show>
        </>
      ) : current().type === "breadboard.board" ? (
        selectField("size", "Board size", BREADBOARD_BOARD_SIZES)
      ) : current().type === "breadboard.wire" ? (
        selectField("color", "Wire color", BREADBOARD_WIRE_COLORS)
      ) : (
        <>
          {textField("reference", "Reference")}
          {isResistor() ? (
            <Field label="Value">
              <input
                class="nodetto-input"
                aria-label="Value"
                list={suggestionListId}
                value={resistorValue()}
                on:input={(event) => setValueDraft(event.currentTarget.value)}
                on:change={(event) => {
                  const value = event.currentTarget.value;
                  setValueDraft(value);
                  setField("value", value);
                  event.currentTarget.value = stringOf(semantic(), "value");
                }}
              />
              <datalist id={suggestionListId}>
                <For each={suggestions()}>
                  {(suggestion) => <option value={suggestion} />}
                </For>
              </datalist>
            </Field>
          ) : (
            textField("value", "Value")
          )}
          {current().type === "breadboard.resistor" && (
            <>
              {numericField("span", "Lead span", 2, 10)}
              {selectField("bands", "Color bands", [4, 5])}
              {selectField("tolerance", "Tolerance (%)", BREADBOARD_TOLERANCES)}
            </>
          )}
          {current().type === "breadboard.led" &&
            selectField("color", "LED color", BREADBOARD_LED_COLORS)}
          {current().type === "breadboard.capacitor" && (
            <>
              {selectField("style", "Style", BREADBOARD_CAPACITOR_STYLES)}
              {numericField("span", "Lead span", 1, 5)}
            </>
          )}
          {current().type === "breadboard.diode" &&
            numericField("span", "Lead span", 2, 10)}
          {current().type === "breadboard.transistor" && (
            <>
              {selectField(
                "polarity",
                "Polarity",
                BREADBOARD_TRANSISTOR_POLARITIES,
              )}
              {selectField(
                "pinout",
                "Pin order",
                BREADBOARD_TRANSISTOR_PINOUTS,
              )}
            </>
          )}
          {current().type === "breadboard.ic" &&
            numericField("pinCount", "Pin count", 4, 40, 2)}
          {current().type === "breadboard.header" &&
            numericField("pinCount", "Pin count", 1, 40)}
          <Show when={isPart()}>
            <div
              class="nodetto-breadboard-rotation"
              role="group"
              aria-label="Part rotation"
            >
              <button
                type="button"
                onClick={() =>
                  props.editor.rotateBreadboardParts([current().id], -1)
                }
              >
                Rotate left
              </button>
              <button
                type="button"
                onClick={() =>
                  props.editor.rotateBreadboardParts([current().id], 1)
                }
              >
                Rotate right
              </button>
            </div>
            <Field label="Pins">
              <ul aria-label="Breadboard pins">
                <For each={pinRows()}>
                  {(row) => {
                    const pin: BreadboardPinRef = {
                      elementId: current().id,
                      pin: row.pin,
                    };
                    return (
                      <li>
                        <button
                          type="button"
                          onClick={() =>
                            props.editor.setBreadboardProbe({
                              pageId: pageId(),
                              elementIds: [],
                              pin,
                            })
                          }
                        >
                          {row.name} (pin {row.pin}) -{" "}
                          {row.net || "Unconnected"}
                        </button>
                        <button
                          type="button"
                          disabled={!row.net}
                          onClick={() =>
                            focus(breadboardNetProbe(document(), pageId(), pin))
                          }
                        >
                          Select net
                        </button>
                      </li>
                    );
                  }}
                </For>
              </ul>
            </Field>
          </Show>
        </>
      )}
    </Section>
  );
}
