import {
  findIcon,
  renderIconMarkup,
  renderIconPlaceholder,
} from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import type { JSX } from "solid-js";

export function iconViewMarkup(element: Element): string {
  const semantic = element.semantic as {
    icon?: string;
    path?: string;
    viewBox?: number;
  };
  const box = {
    x: 0,
    y: 0,
    width: element.visual.width ?? 24,
    height: element.visual.height ?? 24,
  };
  const style = element.visual.style;
  const source =
    semantic.path !== undefined
      ? { path: semantic.path }
      : findIcon(semantic.icon ?? "");
  const markup = source
    ? renderIconMarkup(source, box, {
        stroke: style?.stroke ?? "#000000",
        strokeWidth: style?.strokeWidth ?? 2,
        fill: style?.fill ?? "none",
        viewBox: semantic.viewBox ?? 24,
      })
    : renderIconPlaceholder(box, style?.stroke ?? "#000000");
  const flipX = element.visual.flipX ? -1 : 1;
  const flipY = element.visual.flipY ? -1 : 1;
  return flipX === 1 && flipY === 1
    ? markup
    : `<g transform="translate(${box.width / 2} ${box.height / 2}) scale(${flipX} ${flipY}) translate(${-box.width / 2} ${-box.height / 2})">${markup}</g>`;
}
export function IconView(props: { element: Element }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox={`0 0 ${props.element.visual.width ?? 24} ${props.element.visual.height ?? 24}`}
    >
      <g innerHTML={iconViewMarkup(props.element)} />
    </svg>
  );
}
