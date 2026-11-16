import type { Box } from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import { createMemo, type JSX } from "solid-js";
import { snippetViewBox } from "./snippet-view-model.ts";

export function SnippetView(props: {
  element: Element;
  box: Box;
  render: (element: Element, box: Box) => string;
}): JSX.Element {
  const markup = createMemo(() => props.render(props.element, props.box));
  return (
    <svg
      viewBox={snippetViewBox(props.box)}
      width={props.box.width}
      height={props.box.height}
      style={{
        position: "absolute",
        left: "0",
        top: "0",
        "pointer-events": "none",
        "color-scheme": "light",
      }}
      innerHTML={markup()}
    />
  );
}
