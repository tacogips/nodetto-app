import type { Element } from "@nodetto/ir";
import type { Box } from "@nodetto/core";
import { For } from "solid-js";
import type { Accessor, JSX } from "solid-js";
import { pcbViewModel } from "./pcb-view.ts";

export function PcbShapeView(props: {
  readonly element: Element;
  readonly box: Box;
  readonly hidden: Accessor<ReadonlySet<string>>;
}): JSX.Element {
  const model = () => pcbViewModel(props.element, props.hidden());
  return (
    <svg
      class="nodetto-pcb-shape"
      width={props.box.width}
      height={props.box.height}
      viewBox={`${props.box.x} ${props.box.y} ${props.box.width} ${props.box.height}`}
      preserveAspectRatio="none"
      style={{
        overflow: "visible",
        position: "absolute",
        inset: 0,
        "pointer-events": "none",
      }}
    >
      <title>{props.element.type}</title>
      <For each={model()}>
        {(item) =>
          item.kind === "path" ? (
            <path
              d={item.d}
              stroke={item.stroke}
              stroke-width={item.width}
              fill={item.fill}
              stroke-linecap="round"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />
          ) : (
            <circle
              cx={item.cx}
              cy={item.cy}
              r={item.r}
              stroke={item.stroke}
              stroke-width={item.width}
              fill={item.fill}
              vector-effect="non-scaling-stroke"
            />
          )
        }
      </For>
    </svg>
  );
}
