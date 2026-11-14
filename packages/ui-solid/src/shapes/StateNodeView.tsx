import { stateNodeNotation, type Box } from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import { For, type JSX } from "solid-js";
import { BpmnNotationPrimitiveView } from "./BpmnShapeView.tsx";
export function StateNodeView(props: {
  readonly element: Element;
  readonly box: Box;
}): JSX.Element {
  return (
    <svg
      role="img"
      aria-label={String(
        (props.element.semantic as { name: string; kind: string }).name ||
          (props.element.semantic as { kind: string }).kind,
      )}
      width={props.box.width}
      height={props.box.height}
      style={{ overflow: "visible" }}
    >
      <For
        each={stateNodeNotation(props.element, { ...props.box, x: 0, y: 0 })}
      >
        {(primitive) => <BpmnNotationPrimitiveView primitive={primitive} />}
      </For>
    </svg>
  );
}
