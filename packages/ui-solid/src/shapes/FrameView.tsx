import {
  cornerRadiiCss,
  FRAME_OUTSIDE_TITLE_GAP,
  FRAME_OUTSIDE_TITLE_HEIGHT,
  rectStrokeParts,
  resolveTitlePlacement,
  layoutGridBands,
  resolvedCornerRadii,
  safeAreaContentBox,
} from "@nodetto/core";
import type { AxisLayoutGrid, Element, FrameSemantic } from "@nodetto/ir";
import { For, type JSX, Show } from "solid-js";
import { RectStrokes } from "./RectStrokes.tsx";
import { SvgFillGradient } from "./SvgFillGradient.tsx";
import {
  fillPaintStyle,
  labelStyle,
  strokeBorderStyle,
  svgStyle,
} from "./visual.ts";

export function FrameView(props: {
  readonly element: Element;
  readonly showLayoutGrids?: boolean;
}): JSX.Element {
  const style = () => props.element.visual.style;
  const width = () => props.element.visual.width ?? 390;
  const height = () => props.element.visual.height ?? 844;
  const outside = () =>
    resolveTitlePlacement(props.element.semantic as FrameSemantic) ===
    "outside";
  const strokeBox = () => ({ x: 0, y: 0, width: width(), height: height() });
  const hasParts = () => rectStrokeParts(strokeBox(), style()) !== undefined;
  const grids = () =>
    (props.element.semantic as FrameSemantic).layoutGrids ?? [];
  const safeArea = () =>
    (props.element.semantic as FrameSemantic).safeArea ?? null;
  const safeBox = () => {
    const insets = safeArea();
    return insets
      ? safeAreaContentBox(
          { x: 0, y: 0, width: width(), height: height() },
          insets,
        )
      : null;
  };
  return (
    <div
      data-screen-kind={
        (props.element.semantic as FrameSemantic).screenKind ?? "screen"
      }
      data-smart-paint="box"
      data-smart-text
      style={{
        width: "100%",
        height: "100%",
        "box-sizing": "border-box",
        position: "relative",
        overflow: "visible",
        "border-radius": cornerRadiiCss(resolvedCornerRadii(style())),
        ...(hasParts() ? {} : fillPaintStyle(props.element.visual, "#ffffff")),
        border: hasParts()
          ? "none"
          : `${style()?.strokeWidth ?? 1}px ${style()?.dash === "dotted" ? "dotted" : style()?.dash === "dashed" ? "dashed" : "solid"} ${style()?.stroke ?? "#cbd5e1"}`,
        ...(hasParts() ? {} : strokeBorderStyle(props.element.visual)),
        ...labelStyle(props.element.visual),
      }}
    >
      <Show when={hasParts()}>
        <svg
          aria-hidden="true"
          width={width()}
          height={height()}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            overflow: "visible",
            "pointer-events": "none",
          }}
        >
          <SvgFillGradient
            element={props.element}
            width={width()}
            height={height()}
          />
          <RectStrokes
            box={strokeBox()}
            style={style()}
            clipId={`nd-frame-strokes-${Array.from(props.element.id, (c) => c.codePointAt(0)?.toString(16)).join("-")}`}
            fill={
              svgStyle(props.element.visual, props.element.id).fill ?? "#ffffff"
            }
            stroke={
              svgStyle(props.element.visual, props.element.id).stroke ??
              "#cbd5e1"
            }
          />
        </svg>
      </Show>
      <Show when={props.showLayoutGrids}>
        <For each={grids()}>
          {(grid) => (
            <Show when={grid.visible !== false}>
              <Show
                when={grid.kind === "grid" ? grid : undefined}
                fallback={
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: grid.opacity,
                      overflow: "hidden",
                    }}
                  >
                    <For
                      each={layoutGridBands(
                        grid as AxisLayoutGrid,
                        width(),
                        height(),
                      )}
                    >
                      {(band) => (
                        <span
                          style={{
                            position: "absolute",
                            left: `${band.x}px`,
                            top: `${band.y}px`,
                            width: `${band.width}px`,
                            height: `${band.height}px`,
                            background: grid.color,
                          }}
                        />
                      )}
                    </For>
                  </div>
                }
              >
                {(square) => (
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: square().opacity,
                      "background-image": `linear-gradient(to right, ${square().color} 1px, transparent 1px), linear-gradient(to bottom, ${square().color} 1px, transparent 1px)`,
                      "background-size": `${square().size}px ${square().size}px`,
                    }}
                  />
                )}
              </Show>
            </Show>
          )}
        </For>
        <Show when={safeBox()} keyed>
          {(box) => (
            <div
              aria-hidden="true"
              data-safe-area
              style={{
                position: "absolute",
                left: `${box.x}px`,
                top: `${box.y}px`,
                width: `${box.width}px`,
                height: `${box.height}px`,
                "box-sizing": "border-box",
                border: "1px dashed #ec4899",
                "pointer-events": "none",
              }}
            />
          )}
        </Show>
      </Show>
      <Show
        when={(props.element.semantic as FrameSemantic).showTitle !== false}
      >
        <span
          style={{
            display: "block",
            position: outside() ? "absolute" : "relative",
            ...(outside()
              ? {
                  left: "0",
                  top: `-${FRAME_OUTSIDE_TITLE_GAP + FRAME_OUTSIDE_TITLE_HEIGHT}px`,
                  height: `${FRAME_OUTSIDE_TITLE_HEIGHT}px`,
                  "line-height": `${FRAME_OUTSIDE_TITLE_HEIGHT}px`,
                }
              : { padding: "4px 8px" }),
            "font-size": "12px",
          }}
        >
          {(props.element.semantic as FrameSemantic).name}
        </span>
      </Show>
    </div>
  );
}
