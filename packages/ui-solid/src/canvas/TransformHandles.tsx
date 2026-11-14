// Resize handles for one element or a multi-selection, and the rotation
// handle above them. Each hands its pointer-down to the interaction.

import { type Accessor, For, type JSX, Show } from "solid-js";
import type { Interaction } from "../interaction.ts";
import { resizeCursor } from "../resize-cursor.ts";
import { HANDLE_SIZE, handleCenter } from "./geometry.ts";
import type {
  ResizeTarget,
  RotateTarget,
  SelectionResizeTarget,
} from "./overlay-targets.ts";

export interface TransformHandlesProps {
  readonly resizeTarget: Accessor<ResizeTarget | null>;
  readonly selectionResizeTarget: Accessor<SelectionResizeTarget | null>;
  readonly rotateTarget: Accessor<RotateTarget | null>;
  readonly zoom: Accessor<number>;
  readonly interaction: Interaction;
}

export function TransformHandles(props: TransformHandlesProps): JSX.Element {
  const handleSize = () => HANDLE_SIZE / props.zoom();
  return (
    <>
      <Show when={props.resizeTarget()}>
        {(target) => (
          <For each={target().handles}>
            {(handle) => (
              <rect
                class="nodetto-handle"
                transform={
                  target().rotation
                    ? `rotate(${target().rotation} ${target().box.x + target().box.width / 2} ${target().box.y + target().box.height / 2})`
                    : undefined
                }
                x={handleCenter(target().box, handle).x - handleSize() / 2}
                y={handleCenter(target().box, handle).y - handleSize() / 2}
                width={handleSize()}
                height={handleSize()}
                style={{ cursor: resizeCursor(handle, target().rotation) }}
                vector-effect="non-scaling-stroke"
                onPointerDown={(event) =>
                  props.interaction.startResize(target().id, handle, event)
                }
              />
            )}
          </For>
        )}
      </Show>
      <Show when={props.selectionResizeTarget()}>
        {(target) => (
          <For each={target().handles}>
            {(handle) => (
              <rect
                class="nodetto-handle"
                x={handleCenter(target().box, handle).x - handleSize() / 2}
                y={handleCenter(target().box, handle).y - handleSize() / 2}
                width={handleSize()}
                height={handleSize()}
                style={{ cursor: resizeCursor(handle, 0) }}
                vector-effect="non-scaling-stroke"
                onPointerDown={(event) =>
                  props.interaction.startResizeSelection(handle, event)
                }
              />
            )}
          </For>
        )}
      </Show>
      <Show when={props.rotateTarget()}>
        {(target) => (
          <circle
            class="nodetto-handle"
            cx={target().x}
            cy={target().y}
            r={6 / props.zoom()}
            style={{ cursor: "grab" }}
            vector-effect="non-scaling-stroke"
            onPointerDown={(event) => {
              const value = target();
              if (value.kind === "element")
                props.interaction.startRotate(value.id, event);
              else props.interaction.startRotateSelection(value.center, event);
            }}
          >
            <title>Rotate selection (Shift: 15° increments)</title>
          </circle>
        )}
      </Show>
    </>
  );
}
