// node.generic: a labelled box. Plain DOM, because a rounded rectangle with
// centred text is something CSS already does well.

import {
  cornerRadiiCss,
  nodeLabelLayout,
  resolvedCornerRadii,
} from "@nodetto/core";
import type { Element, GenericNodeSemantic } from "@nodetto/ir";
import { createMemo, For, type JSX } from "solid-js";
import { fillPaintStyle, labelStyle, strokeBorderStyle } from "./visual.ts";

export interface NodeViewProps {
  readonly element: Element;
}

export function NodeView(props: NodeViewProps): JSX.Element {
  const label = () =>
    (props.element.semantic as Partial<GenericNodeSemantic> | null)?.label ??
    "";
  const layout = createMemo(() =>
    nodeLabelLayout(label(), props.element.visual),
  );
  return (
    <div
      class="nodetto-node"
      data-smart-paint="box"
      data-smart-text
      style={{
        ...labelStyle(props.element.visual),
        position: "relative",
        ...fillPaintStyle(props.element.visual),
        "border-width":
          props.element.visual.style?.strokeWidth === undefined
            ? undefined
            : `${props.element.visual.style.strokeWidth}px`,
        "border-radius": cornerRadiiCss(
          resolvedCornerRadii(props.element.visual.style, 8),
        ),
        "border-style":
          props.element.visual.style?.dash === "dashed"
            ? "dashed"
            : props.element.visual.style?.dash === "dotted"
              ? "dotted"
              : "solid",
        ...strokeBorderStyle(props.element.visual),
      }}
    >
      <span
        class="nodetto-node-label"
        style={{
          position: "absolute",
          left: "10px",
          top: `${layout().top}px`,
          width: `${layout().width}px`,
          "font-size": `${layout().fontSize}px`,
          "line-height": `${layout().lineHeight}px`,
          "text-align":
            props.element.visual.style?.textAlign === "start"
              ? "left"
              : props.element.visual.style?.textAlign === "end"
                ? "right"
                : "center",
        }}
      >
        <For each={layout().lines}>
          {(line) => (
            <span
              style={{
                display: "block",
                "white-space": "pre",
                height: `${layout().lineHeight}px`,
              }}
            >
              {line || "\u00a0"}
            </span>
          )}
        </For>
      </span>
    </div>
  );
}
