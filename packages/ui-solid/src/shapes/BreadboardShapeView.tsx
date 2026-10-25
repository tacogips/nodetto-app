import type { BreadboardPrimitive } from "@nodetto/core";
import type { Box } from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import { For, type JSX, Match, Switch } from "solid-js";
import { primitiveAttributes } from "./bpmn-primitive.ts";
import { breadboardViewModel } from "./breadboard-view.ts";

export interface BreadboardShapeViewProps {
  readonly element: Element;
  readonly box: Box;
  readonly inert?: boolean;
}

function BreadboardPrimitiveView(props: {
  readonly primitive: BreadboardPrimitive;
}): JSX.Element {
  const mapped = () => primitiveAttributes(props.primitive);
  const attrs = () => ({
    ...mapped().attrs,
    class: `breadboard-${props.primitive.role}`,
    opacity: props.primitive.opacity,
  });
  return (
    <Switch>
      <Match when={props.primitive.kind === "rect"}>
        <rect {...attrs()} />
      </Match>
      <Match when={props.primitive.kind === "circle"}>
        <circle {...attrs()} />
      </Match>
      <Match when={props.primitive.kind === "path"}>
        <path {...attrs()} />
      </Match>
      <Match when={props.primitive.kind === "polygon"}>
        <polygon {...attrs()} />
      </Match>
      <Match when={props.primitive.kind === "text"}>
        <text {...attrs()}>
          <For
            each={props.primitive.kind === "text" ? props.primitive.lines : []}
          >
            {(line, index) => (
              <tspan
                x={props.primitive.kind === "text" ? props.primitive.x : 0}
                dy={
                  index() === 0 || props.primitive.kind !== "text"
                    ? 0
                    : props.primitive.lineHeight
                }
              >
                {line}
              </tspan>
            )}
          </For>
        </text>
      </Match>
    </Switch>
  );
}

export function BreadboardShapeView(
  props: BreadboardShapeViewProps,
): JSX.Element {
  const model = () =>
    breadboardViewModel(props.element, props.box, props.inert ?? false);
  return (
    <svg
      class="nodetto-breadboard"
      width={props.box.width}
      height={props.box.height}
      viewBox={`0 0 ${props.box.width} ${props.box.height}`}
      preserveAspectRatio="none"
      style={{
        overflow: "visible",
        position: "absolute",
        left: 0,
        top: 0,
        "pointer-events": "none",
      }}
    >
      <title>{props.element.type}</title>
      <For each={model().body}>
        {(primitive) => <BreadboardPrimitiveView primitive={primitive} />}
      </For>
      <g transform={model().labelTransform}>
        <For each={model().labels}>
          {(primitive) => <BreadboardPrimitiveView primitive={primitive} />}
        </For>
      </g>
    </svg>
  );
}
