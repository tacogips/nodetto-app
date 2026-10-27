// Artboard auto layout fields: direction, wrapping, gaps, padding, sizing,
// alignment and content membership.

import { frameParents } from "@nodetto/core";
import type { FrameLayout, FrameSemantic } from "@nodetto/ir";
import { For, type JSX, Show } from "solid-js";
import { Field, NumberInput, SelectInput } from "./controls.tsx";
import type { ElementSectionProps } from "./semantic-fields.ts";
import { writeSemantic } from "./write.ts";

export function FrameAutoLayoutFields(props: ElementSectionProps): JSX.Element {
  const semantic = () => props.element.semantic as FrameSemantic;
  const layout = (): FrameLayout =>
    semantic().layout ?? {
      direction: "vertical",
      gap: 16,
      padding: 24,
      sizing: "fixed",
      align: "start",
    };
  const updateLayout = (patch: Partial<FrameLayout>): void => {
    const parents = frameParents(
      props.editor.store,
      props.element.page,
      props.editor.createShapeContext(),
    );
    const memberIds =
      semantic().memberIds ??
      [...parents]
        .filter(([, parent]) => parent === props.element.id)
        .map(([child]) => child);
    const nextSemantic = {
      ...semantic(),
      memberIds,
      layout: { ...layout(), ...patch },
    };
    const links = { ...props.element.visual.numberTokens };
    for (const field of [
      "gap",
      "crossGap",
      "padding",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ] as const) {
      if (Object.hasOwn(patch, field)) delete links[field];
    }
    const { numberTokens: _old, ...rest } = props.element.visual;
    const nextVisual = {
      ...rest,
      ...(Object.keys(links).length ? { numberTokens: links } : {}),
    };
    props.editor.apply([
      { type: "updateSemantic", id: props.element.id, semantic: nextSemantic },
      { type: "replaceVisual", id: props.element.id, visual: nextVisual },
    ]);
  };
  return (
    <>
      <Field label="Auto layout">
        <SelectInput
          label="Auto layout direction"
          value={semantic().layout?.direction ?? "none"}
          options={[
            { value: "none", label: "None" },
            { value: "vertical", label: "Vertical" },
            { value: "horizontal", label: "Horizontal" },
          ]}
          onCommit={(direction) => {
            if (direction === "none") {
              const { layout: _layout, ...rest } = semantic();
              writeSemantic(props.editor, props.element.id, rest);
            } else
              updateLayout({
                direction: direction as FrameLayout["direction"],
              });
          }}
        />
      </Field>
      <Field label="Gap">
        <NumberInput
          label="Layout gap"
          min={0}
          value={layout().gap}
          onCommit={(gap) => updateLayout({ gap })}
        />
      </Field>
      <Field label="Wrap">
        <SelectInput
          label="Auto layout wrapping"
          value={layout().wrap ? "wrap" : "nowrap"}
          options={[
            { value: "nowrap", label: "No wrap" },
            { value: "wrap", label: "Wrap" },
          ]}
          onCommit={(value) =>
            updateLayout({ wrap: value === "wrap" ? true : undefined })
          }
        />
      </Field>
      <Show when={layout().wrap}>
        <Field label="Row / column gap">
          <NumberInput
            label="Wrapped line gap"
            min={0}
            value={layout().crossGap ?? layout().gap}
            onCommit={(crossGap) => updateLayout({ crossGap })}
          />
          <button
            type="button"
            disabled={layout().crossGap === undefined}
            onClick={() => updateLayout({ crossGap: undefined })}
          >
            Use gap
          </button>
        </Field>
      </Show>
      <Field label="Padding">
        <NumberInput
          label="Layout padding"
          min={0}
          value={layout().padding}
          onCommit={(padding) => updateLayout({ padding })}
        />
      </Field>
      <details>
        <summary>Individual padding</summary>
        <For
          each={
            [
              "paddingTop",
              "paddingRight",
              "paddingBottom",
              "paddingLeft",
            ] as const
          }
        >
          {(side) => (
            <Field label={side.slice(7)}>
              <NumberInput
                label={`Layout ${side.slice(7).toLowerCase()} padding`}
                min={0}
                value={layout()[side] ?? layout().padding}
                onCommit={(value) => updateLayout({ [side]: value })}
              />
              <button
                type="button"
                disabled={layout()[side] === undefined}
                onClick={() => updateLayout({ [side]: undefined })}
              >
                Use default
              </button>
            </Field>
          )}
        </For>
      </details>
      <Field label="Sizing">
        <SelectInput
          label="Default layout sizing"
          value={layout().sizing}
          options={[
            { value: "fixed", label: "Fixed dimensions" },
            { value: "hug", label: "Hug contents" },
          ]}
          onCommit={(sizing) =>
            updateLayout({ sizing: sizing as FrameLayout["sizing"] })
          }
        />
      </Field>
      <For each={["widthSizing", "heightSizing"] as const}>
        {(axis) => (
          <Field
            label={axis === "widthSizing" ? "Width sizing" : "Height sizing"}
          >
            <SelectInput
              label={
                axis === "widthSizing"
                  ? "Layout width sizing"
                  : "Layout height sizing"
              }
              value={layout()[axis] ?? "default"}
              options={[
                { value: "default", label: "Use default sizing" },
                { value: "fixed", label: "Fixed" },
                { value: "hug", label: "Hug contents" },
              ]}
              onCommit={(value) =>
                updateLayout({
                  [axis]:
                    value === "default"
                      ? undefined
                      : (value as "fixed" | "hug"),
                })
              }
            />
          </Field>
        )}
      </For>
      <Field label="Align">
        <SelectInput
          label="Layout alignment"
          value={layout().align}
          options={[
            { value: "start", label: "Start" },
            { value: "center", label: "Center" },
            { value: "end", label: "End" },
            { value: "stretch", label: "Stretch (fixed cross axis)" },
          ]}
          onCommit={(align) =>
            updateLayout({ align: align as FrameLayout["align"] })
          }
        />
      </Field>
      <Field label="Distribute">
        <SelectInput
          label="Layout main-axis distribution"
          value={layout().justify ?? "start"}
          options={[
            { value: "start", label: "Start" },
            { value: "center", label: "Center" },
            { value: "end", label: "End" },
            { value: "space-between", label: "Space between" },
          ]}
          onCommit={(justify) =>
            updateLayout({
              justify: justify as NonNullable<FrameLayout["justify"]>,
            })
          }
        />
      </Field>
      <button
        type="button"
        class="nodetto-inspector-button"
        onClick={() => {
          const ids = props.editor.store
            .getPageElements(props.element.page)
            .filter((item) => {
              if (item.id === props.element.id) return false;
              const parent = frameParents(
                props.editor.store,
                item.page,
                props.editor.createShapeContext(),
              ).get(item.id);
              return parent === props.element.id;
            })
            .map((item) => item.id);
          writeSemantic(props.editor, props.element.id, {
            ...semantic(),
            memberIds: ids,
          });
        }}
      >
        Keep contents attached
      </button>
    </>
  );
}
