// Connectors: edge.generic, erd.relation and uml.association.
//
// Endpoints come from the core's boundary intersection, so the line always
// stops at the shapes' borders and follows them as they move. An unresolved
// endpoint renders nothing at all rather than a line to the origin.

import {
  angularGradientPatches,
  bpmnFlowDecoration,
  connectorDefaultDash,
  connectorDecoration,
  connectorLabelBackdrop,
  connectorLabelBaselines,
  connectorLabelLayout,
  connectorPath,
  diamondGradientPatches,
  endpointReaderFor,
  shapeAuthoringWarnings,
  linearGradientVector,
  MARKER_GEOMETRY,
  type MarkerEnd,
  type MarkerKind,
  type MarkerPaint,
  markerVariant,
  resolveConnector,
  sampleGradient,
  strokeGradientId,
  type ShapeContext,
} from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import { createMemo, For, type JSX, Match, Show, Switch } from "solid-js";
import { BpmnNotationPrimitiveView } from "./BpmnShapeView.tsx";
import { sameConnectorGeometry } from "../connector-geometry.ts";
import { svgStyle } from "./visual.ts";

export interface ConnectorViewProps {
  readonly element: Element;
  readonly context: ShapeContext;
  readonly selected: boolean;
  readonly markerPrefix?: string;
}

function markerUrl(
  kind: MarkerKind | null,
  end: MarkerEnd,
  prefix = "",
): string | undefined {
  return kind === null
    ? undefined
    : `url(#${prefix}${markerVariant(kind, end).id})`;
}

export function ConnectorView(props: ConnectorViewProps): JSX.Element {
  const geometry = createMemo(
    () =>
      resolveConnector(
        props.element,
        props.context,
        endpointReaderFor(props.element.type),
      ),
    null,
    { equals: sameConnectorGeometry },
  );
  const decoration = () => connectorDecoration(props.element);
  // Rounded bends and line jumps; other connectors' moves re-run this only
  // for connectors whose style asks for jumps.
  const pathData = createMemo(() => {
    const resolved = geometry();
    return resolved
      ? connectorPath(props.element, resolved.points, props.context)
      : null;
  });
  const warning = createMemo(() =>
    shapeAuthoringWarnings(props.element, props.context).join("\n"),
  );
  const warningStyle = (): JSX.CSSProperties | undefined =>
    warning() ? { stroke: "#b45309", "stroke-dasharray": "6 4" } : undefined;

  return (
    <Show when={geometry()}>
      {(resolved) => (
        <g
          class="nodetto-connector"
          classList={{ "nodetto-selected": props.selected }}
        >
          <Show when={props.element.visual.style?.strokeGradient}>
            {(gradient) => {
              const x = () => Math.min(resolved().start.x, resolved().end.x);
              const y = () => Math.min(resolved().start.y, resolved().end.y);
              const width = () =>
                Math.abs(resolved().end.x - resolved().start.x);
              const height = () =>
                Math.abs(resolved().end.y - resolved().start.y);
              const linear = () => {
                const current = gradient();
                return current.type === "linear" ? current : null;
              };
              const radial = () => {
                const current = gradient();
                return current.type === "radial" ? current : null;
              };
              const angular = () => {
                const current = gradient();
                return current.type === "angular" ? current : null;
              };
              const diamond = () => {
                const current = gradient();
                return current.type === "diamond" ? current : null;
              };
              const vector = () => {
                const current = linear();
                return current
                  ? linearGradientVector(current.angle, width(), height())
                  : undefined;
              };
              return (
                <defs>
                  <Switch>
                    <Match when={gradient().type === "linear"}>
                      <linearGradient
                        id={strokeGradientId(props.element.id)}
                        gradientUnits="userSpaceOnUse"
                        x1={x() + (vector()?.x1 ?? 0) * width()}
                        y1={y() + (vector()?.y1 ?? 0) * height()}
                        x2={x() + (vector()?.x2 ?? 1) * width()}
                        y2={y() + (vector()?.y2 ?? 1) * height()}
                      >
                        <For each={gradient().stops}>
                          {(stop) => (
                            <stop
                              offset={stop.offset}
                              stop-color={stop.color}
                              stop-opacity={stop.opacity ?? 1}
                            />
                          )}
                        </For>
                      </linearGradient>
                    </Match>
                    <Match when={gradient().type === "radial"}>
                      <radialGradient
                        id={strokeGradientId(props.element.id)}
                        gradientUnits="userSpaceOnUse"
                        cx={x() + (radial()?.centerX ?? 0.5) * width()}
                        cy={y() + (radial()?.centerY ?? 0.5) * height()}
                        r={
                          (radial()?.radius ?? 0.5) *
                          Math.max(width(), height(), 1)
                        }
                      >
                        <For each={gradient().stops}>
                          {(stop) => (
                            <stop
                              offset={stop.offset}
                              stop-color={stop.color}
                              stop-opacity={stop.opacity ?? 1}
                            />
                          )}
                        </For>
                      </radialGradient>
                    </Match>
                    <Match when={gradient().type === "angular"}>
                      <pattern
                        id={strokeGradientId(props.element.id)}
                        patternUnits="userSpaceOnUse"
                        x={x()}
                        y={y()}
                        width={Math.max(width(), 1)}
                        height={Math.max(height(), 1)}
                      >
                        <For
                          each={
                            angular()
                              ? angularGradientPatches(
                                  angular() as NonNullable<
                                    ReturnType<typeof angular>
                                  >,
                                  width(),
                                  height(),
                                  x(),
                                  y(),
                                )
                              : []
                          }
                        >
                          {(patch) => (
                            <polygon
                              points={patch.points}
                              fill={patch.color}
                              fill-opacity={patch.opacity}
                            />
                          )}
                        </For>
                      </pattern>
                    </Match>
                    <Match when={gradient().type === "diamond"}>
                      <pattern
                        id={strokeGradientId(props.element.id)}
                        patternUnits="userSpaceOnUse"
                        x={x()}
                        y={y()}
                        width={Math.max(width(), 1)}
                        height={Math.max(height(), 1)}
                      >
                        <rect
                          x={x()}
                          y={y()}
                          width={Math.max(width(), 1)}
                          height={Math.max(height(), 1)}
                          fill={sampleGradient(gradient().stops, 1).color}
                          fill-opacity={
                            sampleGradient(gradient().stops, 1).opacity
                          }
                        />
                        <For
                          each={
                            diamond()
                              ? diamondGradientPatches(
                                  diamond() as NonNullable<
                                    ReturnType<typeof diamond>
                                  >,
                                  width(),
                                  height(),
                                  x(),
                                  y(),
                                )
                              : []
                          }
                        >
                          {(patch) => (
                            <polygon
                              points={patch.points}
                              fill={patch.color}
                              fill-opacity={patch.opacity}
                            />
                          )}
                        </For>
                      </pattern>
                    </Match>
                  </Switch>
                </defs>
              );
            }}
          </Show>
          <Show
            when={pathData()}
            fallback={
              <Show
                when={resolved().points.length > 2}
                fallback={
                  <line
                    x1={resolved().start.x}
                    y1={resolved().start.y}
                    x2={resolved().end.x}
                    y2={resolved().end.y}
                    marker-start={markerUrl(
                      decoration().start,
                      "start",
                      props.markerPrefix,
                    )}
                    marker-end={markerUrl(
                      decoration().end,
                      "end",
                      props.markerPrefix,
                    )}
                    stroke-dasharray={connectorDefaultDash(props.element)}
                    {...svgStyle(props.element.visual, props.element.id)}
                    style={warningStyle()}
                  />
                }
              >
                <polyline
                  points={resolved()
                    .points.map((point) => `${point.x},${point.y}`)
                    .join(" ")}
                  marker-start={markerUrl(
                    decoration().start,
                    "start",
                    props.markerPrefix,
                  )}
                  marker-end={markerUrl(
                    decoration().end,
                    "end",
                    props.markerPrefix,
                  )}
                  stroke-dasharray={connectorDefaultDash(props.element)}
                  {...svgStyle(props.element.visual, props.element.id)}
                  style={warningStyle()}
                  fill="none"
                />
              </Show>
            }
          >
            {(d) => (
              <path
                d={d()}
                marker-start={markerUrl(
                  decoration().start,
                  "start",
                  props.markerPrefix,
                )}
                marker-end={markerUrl(
                  decoration().end,
                  "end",
                  props.markerPrefix,
                )}
                stroke-dasharray={connectorDefaultDash(props.element)}
                {...svgStyle(props.element.visual, props.element.id)}
                style={warningStyle()}
                fill="none"
              />
            )}
          </Show>
          <For
            each={bpmnFlowDecoration(props.element, resolved().points, (id) =>
              props.context.resolve(id),
            )}
          >
            {(primitive) => <BpmnNotationPrimitiveView primitive={primitive} />}
          </For>
          <Show when={warning()}>
            {(message) => (
              <g
                aria-label={message()}
                transform={`translate(${resolved().labelPoint.x - 65} ${resolved().labelPoint.y + 8})`}
              >
                <title>{message()}</title>
                <rect
                  width="130"
                  height="22"
                  rx="4"
                  fill="#fffbeb"
                  stroke="#b45309"
                />
                <path d="M12 3L21 18H3Z" fill="#fef3c7" stroke="#92400e" />
                <text
                  x="12"
                  y="16"
                  text-anchor="middle"
                  fill="#92400e"
                  font-size="12"
                  font-weight="700"
                >
                  !
                </text>
                <text x="28" y="15" fill="#92400e" font-size="12">
                  {props.element.type === "erd.relation"
                    ? "FK incomplete"
                    : "Needs setup"}
                </text>
              </g>
            )}
          </Show>
          <Show when={decoration().label}>
            {(label) => {
              const layout = createMemo(() =>
                connectorLabelLayout(label(), props.element.visual),
              );
              const baselines = () =>
                connectorLabelBaselines(layout(), resolved().labelPoint.y);
              const backdrop = () =>
                connectorLabelBackdrop(layout(), resolved().labelPoint);
              return (
                <>
                  <Show when={backdrop()}>
                    {(box) => (
                      <rect
                        class="nodetto-connector-label-backdrop"
                        x={box().x}
                        y={box().y}
                        width={box().width}
                        height={box().height}
                      />
                    )}
                  </Show>
                  <text class="nodetto-connector-label" text-anchor="middle">
                    <For each={layout().lines}>
                      {(line, index) => (
                        <tspan
                          x={resolved().labelPoint.x}
                          y={baselines()[index()]}
                        >
                          {line}
                        </tspan>
                      )}
                    </For>
                  </text>
                </>
              );
            }}
          </Show>
        </g>
      )}
    </Show>
  );
}

const MARKER_PAINT_CLASS: Record<MarkerPaint, string> = {
  filled: "nodetto-marker-filled",
  hollow: "nodetto-marker-hollow",
  line: "nodetto-marker-line",
};

/** Marker definitions every connector layer needs exactly one copy of. */
export function ConnectorMarkers(props: { prefix?: string } = {}): JSX.Element {
  return (
    <defs>
      <For
        each={(Object.keys(MARKER_GEOMETRY) as MarkerKind[]).flatMap((kind) =>
          (["start", "end"] as const).map((end) => ({ kind, end })),
        )}
      >
        {({ kind, end }) => {
          const geometry = MARKER_GEOMETRY[kind];
          const variant = markerVariant(kind, end);
          return (
            <marker
              id={`${props.prefix ?? ""}${variant.id}`}
              viewBox={geometry.viewBox}
              refX={variant.refX}
              refY={geometry.refY}
              markerWidth={geometry.width}
              markerHeight={geometry.height}
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <g transform={variant.transform}>
                <For each={geometry.parts}>
                  {(part) =>
                    part.element === "circle" ? (
                      <circle
                        {...part.attributes}
                        class={MARKER_PAINT_CLASS[part.paint]}
                      />
                    ) : (
                      <path
                        {...part.attributes}
                        class={MARKER_PAINT_CLASS[part.paint]}
                      />
                    )
                  }
                </For>
              </g>
            </marker>
          );
        }}
      </For>
    </defs>
  );
}
