// Artboard component fields: making a component, its variant properties, and
// the linked-instance controls (variant switching, refresh, reset, detach).

import {
  addComponentVariantProperty,
  componentVariantAxes,
  componentVariants,
  MAX_VARIANT_PROPERTIES,
  removeComponentVariantProperty,
  switchComponentVariantProperty,
  updateComponentVariantProperty,
} from "@nodetto/core";
import type { FrameSemantic } from "@nodetto/ir";
import { createSignal, For, type JSX, Show } from "solid-js";
import { Switch } from "../Switch.tsx";
import { Field, SelectInput, TextInput } from "./controls.tsx";
import { withOptionalString } from "./edits.ts";
import { type ElementSectionProps, record } from "./semantic-fields.ts";
import { writeSemantic } from "./write.ts";

export interface FrameComponentFieldsProps extends ElementSectionProps {
  /** Status line shared with the artboard's responsive source controls. */
  readonly refreshStatus: string;
  readonly setRefreshStatus: (status: string) => void;
}

export function FrameComponentFields(
  props: FrameComponentFieldsProps,
): JSX.Element {
  const [variantPropertyName, setVariantPropertyName] = createSignal("");
  const [variantPropertyValue, setVariantPropertyValue] = createSignal("");
  const semantic = () => props.element.semantic as FrameSemantic;
  const refreshStatus = (): string => props.refreshStatus;
  const setRefreshStatus = (status: string): void =>
    props.setRefreshStatus(status);
  return (
    <>
      <Show when={!semantic().component && !semantic().instanceOf}>
        <button
          type="button"
          class="nodetto-inspector-button"
          onClick={() => props.editor.makeComponent(props.element.id)}
        >
          Create component
        </button>
      </Show>
      <Show when={semantic().component}>
        <Field label="Variant family">
          <TextInput
            label="Variant family"
            value={semantic().variantSet ?? ""}
            onCommit={(value) =>
              writeSemantic(
                props.editor,
                props.element.id,
                withOptionalString(
                  record(props.element.semantic),
                  "variantSet",
                  value.trim(),
                ),
              )
            }
          />
        </Field>
        <Field label="Variant name">
          <TextInput
            label="Variant name"
            value={semantic().variantName ?? ""}
            onCommit={(value) =>
              writeSemantic(
                props.editor,
                props.element.id,
                withOptionalString(
                  record(props.element.semantic),
                  "variantName",
                  value.trim(),
                ),
              )
            }
          />
        </Field>
        <details>
          <summary>
            Variant properties ({semantic().variantProperties?.length ?? 0})
          </summary>
          <For each={semantic().variantProperties ?? []}>
            {(property) => (
              <div class="nodetto-inspector-stack">
                <Field label="Property">
                  <TextInput
                    label={`Rename variant property ${property.name}`}
                    value={property.name}
                    onCommit={(name) =>
                      updateComponentVariantProperty(
                        props.editor,
                        props.element.id,
                        property.id,
                        name,
                        property.value,
                      )
                    }
                  />
                </Field>
                <Field label="Value">
                  <TextInput
                    label={`${property.name} variant value`}
                    value={property.value}
                    onCommit={(value) =>
                      updateComponentVariantProperty(
                        props.editor,
                        props.element.id,
                        property.id,
                        property.name,
                        value,
                      )
                    }
                  />
                </Field>
                <button
                  type="button"
                  onClick={() =>
                    removeComponentVariantProperty(
                      props.editor,
                      props.element.id,
                      property.id,
                    )
                  }
                >
                  Remove property
                </button>
              </div>
            )}
          </For>
          <Field label="New property">
            <TextInput
              label="New variant property name"
              placeholder="State"
              value={variantPropertyName()}
              onCommit={setVariantPropertyName}
            />
          </Field>
          <Field label="Initial value">
            <TextInput
              label="New variant property value"
              placeholder="Default"
              value={variantPropertyValue()}
              onCommit={setVariantPropertyValue}
            />
          </Field>
          <button
            type="button"
            disabled={
              !variantPropertyName().trim() ||
              !variantPropertyValue().trim() ||
              (semantic().variantProperties?.length ?? 0) >=
                MAX_VARIANT_PROPERTIES
            }
            onClick={() => {
              if (
                addComponentVariantProperty(
                  props.editor,
                  props.element.id,
                  variantPropertyName(),
                  variantPropertyValue(),
                )
              ) {
                setVariantPropertyName("");
                setVariantPropertyValue("");
              }
            }}
          >
            Add variant property
          </button>
        </details>
        <button
          type="button"
          class="nodetto-inspector-button"
          onClick={() => props.editor.createComponentInstance(props.element.id)}
        >
          Insert linked copy
        </button>
      </Show>
      <Show when={semantic().instanceOf}>
        <Show
          when={
            componentVariantAxes(props.editor, semantic().instanceOf ?? "")
              .length
          }
        >
          <For
            each={componentVariantAxes(
              props.editor,
              semantic().instanceOf ?? "",
            )}
          >
            {(axis) => (
              <Field label={axis.name}>
                <SelectInput
                  label={`${axis.name} component variant`}
                  value={axis.value}
                  options={axis.values.map((value) => ({
                    value,
                    label: value,
                  }))}
                  onCommit={(value) =>
                    setRefreshStatus(
                      switchComponentVariantProperty(
                        props.editor,
                        props.element.id,
                        axis.name,
                        value,
                      )
                        ? `${axis.name} switched. Undo restores the previous contents.`
                        : "Variant combination unavailable: check duplicate combinations, layer keys or locks.",
                    )
                  }
                />
              </Field>
            )}
          </For>
        </Show>
        <Show
          when={
            componentVariantAxes(props.editor, semantic().instanceOf ?? "")
              .length === 0 &&
            componentVariants(props.editor, semantic().instanceOf ?? "")
              .length > 1
          }
        >
          <Field label="Variant">
            <SelectInput
              label="Component variant"
              value={semantic().instanceOf ?? ""}
              options={componentVariants(
                props.editor,
                semantic().instanceOf ?? "",
              ).map((variant) => ({
                value: variant.id,
                label: `${variant.label} · ${variant.page}`,
              }))}
              onCommit={(sourceId) =>
                setRefreshStatus(
                  props.editor.switchComponentVariant(
                    props.element.id,
                    sourceId,
                  )
                    ? "Variant switched. Undo restores the previous contents."
                    : "Variant switch unavailable: check duplicate layer keys, locked contents or source.",
                )
              }
            />
          </Field>
        </Show>
        <Show when={semantic().instanceBindings?.length}>
          <label>
            <Switch
              checked={semantic().autoRefresh === true}
              onChange={(event) =>
                writeSemantic(props.editor, props.element.id, {
                  ...semantic(),
                  autoRefresh: event.currentTarget.checked,
                })
              }
            />
            Automatically refresh component
          </label>
          <button
            type="button"
            class="nodetto-inspector-button"
            onClick={() =>
              setRefreshStatus(
                props.editor.refreshComponentInstance(props.element.id)
                  ? "Inherited fields refreshed; overrides preserved."
                  : "Refresh unavailable: check locked descendants, source, or tracking data.",
              )
            }
          >
            Refresh inherited fields
          </button>
          <p role="status">{refreshStatus()}</p>
          <button
            type="button"
            class="nodetto-inspector-button"
            onClick={() =>
              setRefreshStatus(
                props.editor.updateComponentStructure(props.element.id)
                  ? "Structure updated; surviving overrides preserved."
                  : "Update unavailable: check locked contents, duplicate keys or tracking.",
              )
            }
          >
            Update structure
          </button>
        </Show>
        <button
          type="button"
          class="nodetto-inspector-button"
          onClick={() => props.editor.resetComponentInstance(props.element.id)}
        >
          Reset from component
        </button>
        <button
          type="button"
          class="nodetto-inspector-button"
          onClick={() => props.editor.detachComponentInstance(props.element.id)}
        >
          Make independent copy
        </button>
      </Show>
    </>
  );
}
