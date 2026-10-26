import {
  breadboardPins,
  breadboardWirePoints,
  type BreadboardPinRef,
  type Editor,
  type Vec,
} from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import { createMemo, For, Show } from "solid-js";
import type { Accessor } from "solid-js";
import { breadboardOverlayModel } from "./breadboard-overlay.ts";

export interface BreadboardOverlayProps {
  readonly editor: Editor;
  readonly revision: Accessor<number>;
  readonly hover: Accessor<
    BreadboardPinRef | { readonly wireId: ElementId } | null
  >;
  readonly probeRevision: Accessor<number>;
  readonly wireDraft: Accessor<readonly Vec[] | null>;
  readonly selection: Accessor<ReadonlySet<ElementId>>;
  readonly startWirePoint: (
    id: ElementId,
    index: number,
    event: PointerEvent,
  ) => void;
}

export function BreadboardOverlay(props: BreadboardOverlayProps) {
  const model = createMemo(() => {
    props.revision();
    props.probeRevision();
    const hover = props.hover();
    return breadboardOverlayModel(
      props.editor.getSnapshot(),
      props.editor.currentPageId,
      {
        hover,
        probe: props.editor.breadboardProbe(),
        selection: [...props.selection()],
      },
    );
  });
  return (
    <g class="breadboard-overlay">
      <For each={model().ratsnest}>
        {(line) => (
          <line
            class="breadboard-ratsnest"
            x1={line.from.x}
            y1={line.from.y}
            x2={line.to.x}
            y2={line.to.y}
            stroke-dasharray="1.5 1"
            stroke="#f97316"
            stroke-width="1.5"
            pointer-events="none"
            vector-effect="non-scaling-stroke"
          />
        )}
      </For>
      <Show when={model().highlight}>
        {(highlight) => (
          <>
            <For each={highlight().holes}>
              {(hole) => (
                <circle
                  class="breadboard-net-highlight"
                  cx={hole.x}
                  cy={hole.y}
                  r="3.5"
                  fill="none"
                  stroke="#2563eb"
                  stroke-width="1.5"
                  pointer-events="none"
                />
              )}
            </For>
            <For each={highlight().pins}>
              {(pin) => {
                const element = () => props.editor.store.get(pin.elementId);
                const point = (): Vec | null => {
                  const value = element();
                  if (!value) return null;
                  return (
                    breadboardPins(value).find(
                      (entry) => entry.number === pin.pin,
                    ) ?? null
                  );
                };
                return (
                  <Show when={point()}>
                    {(at) => (
                      <circle
                        class="breadboard-net-highlight"
                        cx={at().x}
                        cy={at().y}
                        r="4"
                        fill="none"
                        stroke="#2563eb"
                        stroke-width="1.5"
                        pointer-events="none"
                      />
                    )}
                  </Show>
                );
              }}
            </For>
            <For each={highlight().wireIds}>
              {(wireId) => {
                const box = () => props.editor.getBounds(wireId);
                return (
                  <Show when={box()}>
                    {(bounds) => (
                      <rect
                        class="breadboard-net-highlight"
                        x={bounds().x}
                        y={bounds().y}
                        width={bounds().width}
                        height={bounds().height}
                        fill="none"
                        stroke="#2563eb"
                        stroke-width="2"
                        pointer-events="none"
                      />
                    )}
                  </Show>
                );
              }}
            </For>
          </>
        )}
      </Show>
      <Show
        when={
          props.selection().size === 1
            ? props.selection().values().next().value
            : undefined
        }
      >
        {(id) => {
          const element = () => props.editor.store.get(id());
          const points = () => {
            const value = element();
            return value?.type === "breadboard.wire"
              ? breadboardWirePoints(value)
              : [];
          };
          return (
            <For each={points()}>
              {(point, index) => (
                <circle
                  class="breadboard-wire-handle"
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="#ffffff"
                  stroke="#2563eb"
                  stroke-width="1.5"
                  pointer-events="all"
                  style={{ cursor: "move" }}
                  onPointerDown={(event) =>
                    props.startWirePoint(id(), index(), event)
                  }
                />
              )}
            </For>
          );
        }}
      </Show>
      <Show when={props.wireDraft()}>
        {(points) => (
          <polyline
            class="breadboard-wire-draft"
            points={points()
              .map((point) => `${point.x},${point.y}`)
              .join(" ")}
            fill="none"
            stroke="#2563eb"
            stroke-width="1.5"
            stroke-dasharray="3 2"
            pointer-events="none"
            vector-effect="non-scaling-stroke"
          />
        )}
      </Show>
    </g>
  );
}
