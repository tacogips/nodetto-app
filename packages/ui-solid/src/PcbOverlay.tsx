import type { Editor } from "@nodetto/core";
import { createMemo, For } from "solid-js";
import type { Accessor, JSX } from "solid-js";
import { pcbOverlayModel } from "./pcb-overlay.ts";

export function PcbOverlay(props: {
  readonly editor: Editor;
  readonly revision: Accessor<number>;
  readonly highlightedNet: Accessor<string>;
  readonly hidden: Accessor<ReadonlySet<string>>;
  readonly draft: Accessor<readonly { x: number; y: number }[] | null>;
}): JSX.Element {
  const model = createMemo(() => {
    props.revision();
    return pcbOverlayModel(
      props.editor.getSnapshot(),
      props.editor.currentPageId,
      props.highlightedNet(),
      props.hidden(),
    );
  });
  return (
    <g class="pcb-overlay">
      <For each={model().ratsnest}>
        {(line) => (
          <line
            x1={line.from.x * 10}
            y1={line.from.y * 10}
            x2={line.to.x * 10}
            y2={line.to.y * 10}
            stroke="#e0e0e0"
            stroke-dasharray="1.5 1"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
            pointer-events="none"
          />
        )}
      </For>
      <For each={model().glow}>
        {(item) =>
          item.kind === "path" ? (
            <path
              d={item.d}
              fill="none"
              stroke="#63b3ff"
              stroke-width="3"
              filter="drop-shadow(0 0 3px #63b3ff)"
              vector-effect="non-scaling-stroke"
              pointer-events="none"
            />
          ) : (
            <circle
              cx={item.cx}
              cy={item.cy}
              r={item.r}
              fill="none"
              stroke="#63b3ff"
              stroke-width="3"
              filter="drop-shadow(0 0 3px #63b3ff)"
              vector-effect="non-scaling-stroke"
              pointer-events="none"
            />
          )
        }
      </For>
      <For each={props.draft() ?? []}>
        {(point, index) =>
          index() === 0 ? null : (
            <line
              x1={props.draft()?.[index() - 1]?.x ?? point.x}
              y1={props.draft()?.[index() - 1]?.y ?? point.y}
              x2={point.x}
              y2={point.y}
              stroke="#e0c674"
              stroke-width="2"
              stroke-dasharray="3 2"
              pointer-events="none"
            />
          )
        }
      </For>
    </g>
  );
}
