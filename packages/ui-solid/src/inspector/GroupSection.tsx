// Group section: layer mask, Boolean operation, compositing and opacity.

import {
  groupMaskCandidates,
  layerName,
  setGroupBooleanOperation,
  setGroupMask,
  setGroupRasterMaskMode,
} from "@nodetto/core";
import {
  BLEND_MODES,
  type BlendMode,
  BOOLEAN_OPERATIONS,
  type BooleanOperation,
  type GroupSemantic,
} from "@nodetto/ir";
import { For, type JSX, Show } from "solid-js";
import { Field, NumberInput, Section, SelectInput } from "./controls.tsx";
import type { ElementSectionProps } from "./semantic-fields.ts";

export function GroupSection(props: ElementSectionProps): JSX.Element {
  const semantic = () => props.element.semantic as GroupSemantic;
  const mask = () => semantic().maskId ?? "";
  const rasterMask = () => {
    const id = semantic().maskId;
    const element = id ? props.editor.store.get(id) : undefined;
    return element?.type === "image.raster";
  };
  const booleanOperation = () => semantic().booleanOperation ?? "";
  const style = () => props.element.visual.style ?? {};
  const candidates = () => groupMaskCandidates(props.editor, props.element.id);
  const compositing = () =>
    !semantic().isolate && !style().blendMode
      ? "pass-through"
      : (style().blendMode ?? "normal");
  const setCompositing = (value: string): void => {
    const { style: _style, ...rest } = props.element.visual;
    const { isolate: _isolate, ...semanticRest } = semantic();
    const { blendMode: _blendMode, ...styleRest } = style();
    const nextStyle =
      value === "pass-through" || value === "normal"
        ? styleRest
        : { ...styleRest, blendMode: value as BlendMode };
    props.editor.apply([
      {
        type: "updateSemantic",
        id: props.element.id,
        semantic:
          value === "pass-through"
            ? semanticRest
            : { ...semanticRest, isolate: true },
      },
      {
        type: "replaceVisual",
        id: props.element.id,
        visual: {
          ...rest,
          ...(Object.keys(nextStyle).length ? { style: nextStyle } : {}),
        },
      },
    ]);
  };
  const setOpacity = (percent: number): void => {
    const { style: _style, ...rest } = props.element.visual;
    const { opacity: _opacity, ...styleRest } = style();
    const nextStyle =
      percent >= 100
        ? styleRest
        : { ...styleRest, opacity: Math.max(0, percent) / 100 };
    props.editor.apply([
      {
        type: "replaceVisual",
        id: props.element.id,
        visual: {
          ...rest,
          ...(Object.keys(nextStyle).length ? { style: nextStyle } : {}),
        },
      },
    ]);
  };
  return (
    <Section
      title="Group"
      help="Mask layers do not paint. Boolean groups combine ordered, editable convex members; subtract uses the first member as its base."
    >
      <Field label="Layer mask">
        <select
          aria-label="Group layer mask"
          value={mask()}
          onChange={(event) =>
            setGroupMask(
              props.editor,
              props.element.id,
              event.currentTarget.value || null,
            )
          }
        >
          <option value="">No mask</option>
          <For each={candidates()}>
            {(element) => (
              <option value={element.id}>{layerName(element)}</option>
            )}
          </For>
        </select>
      </Field>
      <Show when={rasterMask()}>
        <Field label="Raster mask mode">
          <SelectInput
            label="Raster mask mode"
            value={semantic().maskMode ?? "alpha"}
            options={[
              { value: "alpha", label: "Alpha" },
              { value: "luminance", label: "Luminance" },
            ]}
            onCommit={(value) =>
              setGroupRasterMaskMode(
                props.editor,
                props.element.id,
                value === "luminance" ? "luminance" : "alpha",
              )
            }
          />
        </Field>
      </Show>
      <Field label="Boolean operation">
        <SelectInput
          label="Group Boolean operation"
          value={booleanOperation()}
          options={[
            { value: "", label: "None" },
            ...BOOLEAN_OPERATIONS.map((value) => ({
              value,
              label: `${value[0]?.toUpperCase()}${value.slice(1)}`,
            })),
          ]}
          onCommit={(value) =>
            setGroupBooleanOperation(
              props.editor,
              props.element.id,
              (value || null) as BooleanOperation | null,
            )
          }
        />
      </Field>
      <Field label="Compositing">
        <SelectInput
          label="Group compositing mode"
          value={compositing()}
          options={[
            { value: "pass-through", label: "Pass through" },
            ...BLEND_MODES.map((value) => ({
              value,
              label: value
                .split("-")
                .map((word) => `${word[0]?.toUpperCase()}${word.slice(1)}`)
                .join(" "),
            })),
          ]}
          onCommit={setCompositing}
        />
      </Field>
      <NumberInput
        label="Group opacity percent"
        min={0}
        max={100}
        value={Math.round((style().opacity ?? 1) * 100)}
        onCommit={setOpacity}
      />
      <button
        type="button"
        class="nodetto-inspector-button"
        title="Ungroup (Cmd+Shift+G)"
        onClick={() => props.editor.ungroupSelection()}
      >
        Ungroup
      </button>
    </Section>
  );
}
