import { CODE_FONT_STACK, type Box, type Editor } from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import { type JSX, onMount } from "solid-js";
import { snippetEditorKey } from "./snippet-editor-keys.ts";

export function SnippetTextEditor(props: {
  editor: Editor;
  id: ElementId;
  box: Box;
  mono: boolean;
  wrap: boolean;
  onClose(): void;
}): JSX.Element {
  const initial = props.editor.getText(props.id) ?? "";
  let input: HTMLTextAreaElement | undefined;
  let done = false;
  const finish = (cancel: boolean) => {
    if (done) return;
    done = true;
    const value = input?.value ?? initial;
    if (!cancel && value !== initial) props.editor.setText(props.id, value);
    props.onClose();
  };
  const key = (event: KeyboardEvent) => {
    event.stopPropagation();
    const result = snippetEditorKey(event);
    if (result.kind === "default") return;
    event.preventDefault();
    if (result.kind === "insertTab") {
      const target = event.currentTarget as HTMLTextAreaElement;
      target.setRangeText(
        "\t",
        target.selectionStart,
        target.selectionEnd,
        "end",
      );
    } else finish(result.kind === "cancel");
  };
  onMount(() => {
    if (input) {
      input.value = initial;
      input.focus();
    }
  });
  return (
    <textarea
      ref={input}
      aria-label="Edit snippet"
      spellcheck={false}
      wrap={props.wrap ? "soft" : "off"}
      style={{
        position: "absolute",
        left: `${props.box.x}px`,
        top: `${props.box.y}px`,
        width: `${props.box.width}px`,
        height: `${props.box.height}px`,
        "box-sizing": "border-box",
        padding: props.mono ? "12px" : "16px",
        "font-family": props.mono ? CODE_FONT_STACK : "inherit",
      }}
      on:keydown={key}
      on:blur={() => finish(false)}
      on:pointerdown={(event) => event.stopPropagation()}
    />
  );
}
