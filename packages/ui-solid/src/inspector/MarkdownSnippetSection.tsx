import type { Editor } from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import type { JSX } from "solid-js";
import { Field, Section } from "./controls.tsx";
import { snippetThemeCommand, snippetThemeOf } from "./snippet-edits.ts";

export function SnippetThemeControl(props: {
  editor: Editor;
  element: Element;
}): JSX.Element {
  const change = (mode: "light" | "dark") => {
    const command = snippetThemeCommand(props.element, mode);
    if (command) props.editor.apply([command]);
  };
  return (
    <Field label="Snippet theme">
      <div class="nodetto-segmented" role="group" aria-label="Snippet theme">
        <button
          class="nodetto-segment"
          type="button"
          aria-pressed={snippetThemeOf(props.element) === "light"}
          onClick={() => change("light")}
        >
          Light
        </button>
        <button
          class="nodetto-segment"
          type="button"
          aria-pressed={snippetThemeOf(props.element) === "dark"}
          onClick={() => change("dark")}
        >
          Dark
        </button>
      </div>
    </Field>
  );
}
export function MarkdownSnippetSection(props: {
  editor: Editor;
  element: Element;
}): JSX.Element {
  return (
    <Section title="Markdown snippet">
      <SnippetThemeControl {...props} />
    </Section>
  );
}
