// Passive overlay marks: the marquee brush, selection outlines, the
// connector drop target, snap guides and the multi-selection envelope.

import type { Box, SnapGuide } from "@nodetto/core";
import { type Accessor, For, type JSX, Show } from "solid-js";
import type { RotatedBox, SelectionResizeTarget } from "./overlay-targets.ts";

export interface SelectionOutlinesProps {
  readonly marquee: Accessor<Box | null>;
  readonly selectionBoxes: Accessor<readonly RotatedBox[]>;
  readonly hoverBox: Accessor<RotatedBox | null>;
  readonly guides: Accessor<readonly SnapGuide[]>;
  readonly selectionResizeTarget: Accessor<SelectionResizeTarget | null>;
}

export function SelectionOutlines(props: SelectionOutlinesProps): JSX.Element {
  return (
    <>
      <Show when={props.marquee()}>
        {(rect) => (
          <rect
            class="nodetto-marquee"
            x={rect().x}
            y={rect().y}
            width={rect().width}
            height={rect().height}
            vector-effect="non-scaling-stroke"
          />
        )}
      </Show>
      <For each={props.selectionBoxes()}>
        {(box) => (
          <rect
            class="nodetto-selection-outline"
            transform={
              box.rotation
                ? `rotate(${box.rotation} ${box.x + box.width / 2} ${box.y + box.height / 2})`
                : undefined
            }
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            vector-effect="non-scaling-stroke"
          />
        )}
      </For>
      <Show when={props.hoverBox()}>
        {(box) => (
          <rect
            class="nodetto-hover-target"
            transform={
              box().rotation
                ? `rotate(${box().rotation} ${box().x + box().width / 2} ${box().y + box().height / 2})`
                : undefined
            }
            x={box().x}
            y={box().y}
            width={box().width}
            height={box().height}
            vector-effect="non-scaling-stroke"
          />
        )}
      </Show>
      <For each={props.guides()}>
        {(guide) => (
          <line
            class="nodetto-snap-guide"
            x1={guide.axis === "x" ? guide.at : guide.from}
            y1={guide.axis === "x" ? guide.from : guide.at}
            x2={guide.axis === "x" ? guide.at : guide.to}
            y2={guide.axis === "x" ? guide.to : guide.at}
            vector-effect="non-scaling-stroke"
          />
        )}
      </For>
      <Show when={props.selectionResizeTarget()}>
        {(target) => (
          <rect
            class="nodetto-selection-outline"
            x={target().box.x}
            y={target().box.y}
            width={target().box.width}
            height={target().box.height}
            vector-effect="non-scaling-stroke"
          />
        )}
      </Show>
    </>
  );
}
