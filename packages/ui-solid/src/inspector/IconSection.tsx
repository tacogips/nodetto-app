import { findIcon, searchIcons, type Editor } from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import {
  createMemo,
  createSignal,
  createUniqueId,
  For,
  Show,
  type JSX,
} from "solid-js";
import { Field, Section, SelectInput, TextArea } from "./controls.tsx";
import { writeSemantic, writeVisual } from "./write.ts";

export function IconSection(props: {
  editor: Editor;
  element: Element;
}): JSX.Element {
  const semantic = () =>
    props.element.semantic as {
      icon?: string;
      path?: string;
      viewBox?: number;
    };
  const [query, setQuery] = createSignal(semantic().icon ?? "");
  const suggestions = createMemo(() => searchIcons(query(), 8));
  const id = `icon-suggestions-${createUniqueId()}`;
  const setStyle = (patch: { stroke?: string; strokeWidth?: number }) =>
    writeVisual(props.editor, props.element.id, {
      style: { ...props.element.visual.style, ...patch },
    });
  return (
    <Section title="Icon">
      <Field label="Mode">
        <SelectInput
          label="Icon mode"
          value={semantic().path !== undefined ? "path" : "name"}
          options={[
            { value: "name", label: "Name" },
            { value: "path", label: "Custom path" },
          ]}
          onCommit={(mode) =>
            writeSemantic(
              props.editor,
              props.element.id,
              mode === "path" ? { path: "M0 0" } : { icon: "square" },
            )
          }
        />
      </Field>
      <Show
        when={semantic().path === undefined}
        fallback={
          <Field label="Path">
            <TextArea
              label="Icon path"
              value={semantic().path ?? ""}
              onCommit={(path) =>
                writeSemantic(props.editor, props.element.id, {
                  ...semantic(),
                  path,
                })
              }
            />
          </Field>
        }
      >
        <Field label="Name">
          <input
            class="nodetto-input"
            aria-label="Icon name"
            list={id}
            value={semantic().icon ?? ""}
            onInput={(event) => setQuery(event.currentTarget.value)}
            onChange={(event) => {
              const icon = event.currentTarget.value;
              if (findIcon(icon))
                writeSemantic(props.editor, props.element.id, {
                  ...semantic(),
                  icon,
                });
            }}
          />
          <datalist id={id}>
            <For each={suggestions()}>{(name) => <option value={name} />}</For>
          </datalist>
        </Field>
        <Show when={query() && !findIcon(query())}>
          <p role="alert">Unknown icon: {query()}</p>
        </Show>
      </Show>
      <Field label="Color">
        <input
          type="color"
          aria-label="Icon color"
          value={props.element.visual.style?.stroke ?? "#000000"}
          onChange={(event) => setStyle({ stroke: event.currentTarget.value })}
        />
      </Field>
      <Field label="Stroke width">
        <input
          type="number"
          aria-label="Icon stroke width"
          min="0.25"
          max="6"
          step="0.25"
          value={props.element.visual.style?.strokeWidth ?? 2}
          onChange={(event) => {
            const width = event.currentTarget.valueAsNumber;
            if (width >= 0.25 && width <= 6) setStyle({ strokeWidth: width });
          }}
        />
      </Field>
    </Section>
  );
}
