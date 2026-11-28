import type { Vec3, ViewportSize } from "@nodetto/core";
import { createMemo, For, Show } from "solid-js";
import { type Camera3d, viewProjection } from "./camera3d.ts";
import { projectExtrudePoint } from "./extrude-interaction.ts";

export function CadMeasurement(props: {
  readonly points: readonly Vec3[];
  readonly camera: Camera3d;
  readonly size: ViewportSize;
  readonly length: string | undefined;
}) {
  const projected = createMemo(() => {
    const { width, height } = props.size;
    if (width <= 0 || height <= 0) return [];
    const matrix = viewProjection(props.camera, width / height);
    return props.points.flatMap((point) => {
      const ndc = projectExtrudePoint(matrix, point);
      return ndc
        ? [{ x: ((ndc.x + 1) * width) / 2, y: ((1 - ndc.y) * height) / 2 }]
        : [];
    });
  });
  const segment = () => {
    const [start, end] = projected();
    return start && end ? { start, end } : undefined;
  };
  return (
    <>
      <svg class="nodetto-cad-measure-overlay" aria-hidden="true">
        <Show when={segment()}>
          {(line) => (
            <line
              x1={line().start.x}
              y1={line().start.y}
              x2={line().end.x}
              y2={line().end.y}
            />
          )}
        </Show>
        <For each={projected()}>
          {(point) => <circle cx={point.x} cy={point.y} r="4" />}
        </For>
      </svg>
      <div class="nodetto-cad-status" role="status">
        {props.length
          ? `Distance: ${props.length}. Pick a point to measure again.`
          : props.points.length
            ? "Pick the second point on a body."
            : "Pick the first point on a body."}
      </div>
    </>
  );
}
