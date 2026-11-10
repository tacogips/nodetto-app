import type { Element, UiControlSemantic } from "@nodetto/ir";
import {
  findIcon,
  renderIconMarkup,
  resolveUiControlPaint,
} from "@nodetto/core";
import { createSignal, For, Match, Show, Switch, type JSX } from "solid-js";
import { RectStrokes } from "./RectStrokes.tsx";
import { fillPaintStyle, strokeBorderStyle } from "./visual.ts";
import "./UiControlView.css";
export function UiControlView(props: {
  element: Element;
  interactive?: boolean;
}): JSX.Element {
  const [selectedTab, setSelectedTab] = createSignal<string>();
  const value = () => props.element.semantic as UiControlSemantic;
  const tab = () => (props.interactive ? 0 : -1);
  const advancedStroke = () =>
    props.element.visual.style?.strokeAlign !== undefined ||
    props.element.visual.style?.strokeSides !== undefined;
  const paint = () =>
    resolveUiControlPaint(props.element, {
      ink: "var(--nodetto-ink)",
      fontFamily: "inherit",
    });
  const icon = (name: string | undefined) => {
    const definition = name && findIcon(name);
    const size = value().iconSize ?? 20;
    return definition
      ? renderIconMarkup(
          definition,
          { x: 0, y: 0, width: size, height: size },
          { stroke: paint().color, strokeWidth: 2, fill: "none", viewBox: 24 },
        )
      : "";
  };
  const style = (): JSX.CSSProperties => ({
    ...fillPaintStyle(props.element.visual),
    ...strokeBorderStyle(props.element.visual),
    ...(advancedStroke() ? { background: "transparent", border: "0" } : {}),
    color: props.element.visual.style?.color,
    "font-family": props.element.visual.style?.fontFamily,
    "font-weight": props.element.visual.style?.fontWeight,
    "border-radius": `${props.element.visual.style?.cornerRadius ?? 6}px`,
    "font-size": `${props.element.visual.style?.fontSize ?? 14}px`,
    "--nd-control-accent": props.element.visual.style?.accentColor,
    "--nd-control-selected": paint().selected,
    "--nd-control-fill": paint().fill,
    "--nd-control-progress-fill": props.element.visual.style?.fill,
    "--nd-control-selected-fill": paint().selectedFill,
    "text-align":
      props.element.visual.style?.textAlign === "middle"
        ? "center"
        : props.element.visual.style?.textAlign,
    padding:
      props.element.visual.textPadding === undefined &&
      !value().leadingIcon &&
      !value().trailingIcon
        ? undefined
        : `0 ${(props.element.visual.textPadding ?? (value().control === "button" ? 12 : 10)) + (value().trailingIcon ? (value().iconSize ?? 20) + 6 : 0)}px 0 ${(props.element.visual.textPadding ?? (value().control === "button" ? 12 : 10)) + (value().leadingIcon ? (value().iconSize ?? 20) + 6 : 0)}px`,
    "white-space":
      props.element.visual.textTruncate === "ellipsis" ? "nowrap" : "pre-line",
    "text-overflow":
      props.element.visual.textTruncate === "ellipsis" ? "ellipsis" : undefined,
    overflow:
      props.element.visual.textTruncate === "ellipsis" ? "hidden" : undefined,
    "letter-spacing":
      props.element.visual.style?.letterSpacing === undefined
        ? undefined
        : `${props.element.visual.style.letterSpacing}px`,
    "line-height": props.element.visual.style?.lineHeight,
    "justify-content":
      props.element.visual.style?.textAlign === "start"
        ? "flex-start"
        : props.element.visual.style?.textAlign === "end"
          ? "flex-end"
          : "center",
  });
  return (
    <div
      class="nodetto-ui-control"
      data-control={value().control}
      style={{ "--nd-control-accent": props.element.visual.style?.accentColor }}
    >
      <Show when={advancedStroke()}>
        <svg
          class="nodetto-control-strokes"
          aria-hidden="true"
          width="100%"
          height="100%"
          viewBox={`0 0 ${props.element.visual.width ?? 180} ${props.element.visual.height ?? 44}`}
        >
          <RectStrokes
            box={{
              x: 0,
              y: 0,
              width: props.element.visual.width ?? 180,
              height: props.element.visual.height ?? 44,
            }}
            style={props.element.visual.style}
            clipId={`nd-strokes-${props.element.id}`}
            fill={
              props.element.visual.style?.fill ??
              (value().control === "tabs" || value().control === "progress"
                ? "#f1f5f9"
                : "#fffdf8")
            }
            stroke={paint().stroke}
          />
        </svg>
      </Show>
      <Switch>
        <Match when={value().control === "tabs"}>
          <div
            role="tablist"
            aria-label={value().label}
            class="nodetto-ui-tabs"
            data-indicator={value().indicator ?? "cell"}
            style={style()}
          >
            <For each={value().options ?? []}>
              {(option) => (
                <button
                  type="button"
                  role="tab"
                  tabIndex={tab()}
                  disabled={value().disabled}
                  aria-selected={
                    option ===
                    (selectedTab() ?? value().value ?? value().options?.[0])
                  }
                  onClick={() => {
                    if (props.interactive) setSelectedTab(option);
                  }}
                >
                  {option}
                </button>
              )}
            </For>
          </div>
        </Match>
        <Match when={value().control === "progress"}>
          <progress
            aria-label={value().label}
            value={value().progress ?? 0}
            max={100}
            style={style()}
          />
        </Match>
        <Match when={value().control === "button"}>
          <button
            type="button"
            tabIndex={tab()}
            disabled={value().disabled}
            style={style()}
          >
            {value().label}
          </button>
        </Match>
        <Match when={value().control === "input"}>
          <input
            type={value().inputType ?? "text"}
            tabIndex={tab()}
            aria-label={value().label}
            value={value().value ?? ""}
            placeholder={value().placeholder}
            readOnly={!props.interactive}
            disabled={value().disabled}
            style={style()}
          />
        </Match>
        <Match when={value().control === "textarea"}>
          <textarea
            tabIndex={tab()}
            aria-label={value().label}
            value={value().value ?? ""}
            placeholder={value().placeholder}
            readOnly={!props.interactive}
            disabled={value().disabled}
            style={style()}
          />
        </Match>
        <Match when={value().control === "select"}>
          <select
            tabIndex={tab()}
            aria-label={value().label}
            value={value().value ?? value().options?.[0] ?? ""}
            disabled={value().disabled}
            style={style()}
          >
            <For each={value().options ?? []}>
              {(option) => <option value={option}>{option}</option>}
            </For>
          </select>
        </Match>
        <Match when={["checkbox", "switch", "radio"].includes(value().control)}>
          <label
            style={{
              color: props.element.visual.style?.color,
              "font-family": props.element.visual.style?.fontFamily,
              "font-weight": props.element.visual.style?.fontWeight,
              "font-size": `${props.element.visual.style?.fontSize ?? 14}px`,
            }}
          >
            <input
              type={value().control === "radio" ? "radio" : "checkbox"}
              role={value().control === "switch" ? "switch" : undefined}
              tabIndex={tab()}
              checked={value().checked ?? false}
              disabled={value().disabled}
              aria-label={value().label}
            />
            <span>{value().label}</span>
          </label>
        </Match>
      </Switch>
      <Show when={value().leadingIcon}>
        <svg
          class="nodetto-control-icon nodetto-control-icon-leading"
          style={{
            left: `${props.element.visual.textPadding ?? (value().control === "button" ? 12 : 10)}px`,
          }}
          width={value().iconSize ?? 20}
          height={value().iconSize ?? 20}
          innerHTML={icon(value().leadingIcon)}
        />
      </Show>
      <Show when={value().trailingIcon}>
        <svg
          class="nodetto-control-icon nodetto-control-icon-trailing"
          style={{
            right: `${props.element.visual.textPadding ?? (value().control === "button" ? 12 : 10)}px`,
          }}
          width={value().iconSize ?? 20}
          height={value().iconSize ?? 20}
          innerHTML={icon(value().trailingIcon)}
        />
      </Show>
      <Show when={value().badge !== undefined}>
        <span
          class="nodetto-control-badge"
          classList={{ "nodetto-control-badge-dot": value().badge === "" }}
        >
          {value().badge}
        </span>
      </Show>
    </div>
  );
}
