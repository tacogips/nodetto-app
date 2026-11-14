import { type Box, rectStrokeParts, roundedRectPath } from "@nodetto/core";
import type { VisualStyle } from "@nodetto/ir";
import { For, Show } from "solid-js";

export function RectStrokes(props: {
  box: Box;
  style: VisualStyle | undefined;
  clipId: string;
  fill?: string;
  stroke?: string;
}) {
  const parts = () => rectStrokeParts(props.box, props.style);
  return (
    <Show when={parts()}>
      {(p) => (
        <g opacity={props.style?.opacity}>
          <path
            d={roundedRectPath(p().fillBox, p().radii)}
            fill={props.fill}
            stroke="none"
          />
          <Show
            when={p().strokeBox}
            fallback={
              <>
                <clipPath id={props.clipId}>
                  <path d={roundedRectPath(p().clipBox, p().radii)} />
                </clipPath>
                <g clip-path={`url(#${props.clipId})`} fill={props.stroke}>
                  <For each={p().strips}>
                    {(strip) => (
                      <rect
                        {...strip}
                        fill={props.stroke ?? "var(--nodetto-ink)"}
                        stroke="none"
                      />
                    )}
                  </For>
                </g>
              </>
            }
          >
            {(box) => (
              <path
                d={roundedRectPath(box(), p().radii)}
                fill="none"
                stroke={props.stroke}
                stroke-width={p().strokeWidth}
              />
            )}
          </Show>
        </g>
      )}
    </Show>
  );
}
