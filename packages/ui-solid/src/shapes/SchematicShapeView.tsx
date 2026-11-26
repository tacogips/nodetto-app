import type { NotationPrimitive } from "@nodetto/core";
import type { Box } from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import { For, type JSX, Match, Switch } from "solid-js";
import { primitiveAttributes } from "./bpmn-primitive.ts";
import { schematicViewModel } from "./schematic-view.ts";

export interface SchematicShapeViewProps {
  readonly element: Element;
  readonly box: Box;
}

function NotationPrimitiveView(props: {
  readonly primitive: NotationPrimitive;
}): JSX.Element {
  const mapped = () => primitiveAttributes(props.primitive);
  const attrs = () => ({
    ...mapped().attrs,
    class: `schematic-${props.primitive.role}`,
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

export function SchematicShapeView(
  props: SchematicShapeViewProps,
): JSX.Element {
  const model = () => schematicViewModel(props.element, props.box);
  return (
    <svg
      class="nodetto-schematic"
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
        {(primitive) => <NotationPrimitiveView primitive={primitive} />}
      </For>
      <g transform={model().labelTransform}>
        <For each={model().labels}>
          {(primitive) => <NotationPrimitiveView primitive={primitive} />}
        </For>
      </g>
    </svg>
  );
}
