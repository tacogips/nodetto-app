import {
  SYNTAX_KINDS,
  SYNTAX_KIND_LABELS,
  type Command,
  type Editor,
} from "@nodetto/core";
import type { Element, TextCodeSemantic } from "@nodetto/ir";
import { For, type JSX, Show } from "solid-js";
import { Switch } from "../Switch.tsx";
import { Field, Section } from "./controls.tsx";
import { SnippetThemeControl } from "./MarkdownSnippetSection.tsx";
import { codeFlagCommand, codeLanguageCommand } from "./snippet-edits.ts";

export function CodeSnippetSection(props: {
  editor: Editor;
  element: Element;
}): JSX.Element {
  const semantic = () => props.element.semantic as TextCodeSemantic;
  const apply = (command: Command | null) => {
    if (command) props.editor.apply([command]);
  };
  return (
    <Section title="Code snippet">
      <Field label="Language">
        <select
          aria-label="Language"
          value={semantic().language}
          onChange={(event) =>
            apply(codeLanguageCommand(props.element, event.currentTarget.value))
          }
        >
          <Show
            when={!SYNTAX_KINDS.some((kind) => kind === semantic().language)}
          >
            <option value={semantic().language}>
              {semantic().language} (unknown)
            </option>
          </Show>
          <For each={SYNTAX_KINDS}>
            {(kind) => <option value={kind}>{SYNTAX_KIND_LABELS[kind]}</option>}
          </For>
        </select>
      </Field>
      <Field label="Line numbers">
        <Switch
          aria-label="Line numbers"
          checked={semantic().showLineNumbers === true}
          onChange={(event) =>
            apply(
              codeFlagCommand(
                props.element,
                "showLineNumbers",
                event.currentTarget.checked,
              ),
            )
          }
        />
      </Field>
      <Field label="Wrap lines">
        <Switch
          aria-label="Wrap lines"
          checked={semantic().wrap === true}
          onChange={(event) =>
            apply(
              codeFlagCommand(
                props.element,
                "wrap",
                event.currentTarget.checked,
              ),
            )
          }
        />
      </Field>
      <SnippetThemeControl {...props} />
    </Section>
  );
}
