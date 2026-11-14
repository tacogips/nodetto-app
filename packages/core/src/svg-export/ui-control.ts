// UI mockup controls: tabs, progress bars, toggles, buttons and inputs.

import type { Element, UiControlSemantic } from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import { tag, text, wrap } from "./markup.ts";
import { styled } from "./paint.ts";
import type { SvgTheme } from "./theme.ts";

export function renderUiControl(
  element: Element,
  box: Box,
  theme: SvgTheme,
): string {
  const s = element.semantic as UiControlSemantic;
  if (s.control === "tabs" || s.control === "progress") {
    const parts: string[] = [];
    const radius = element.visual.style?.cornerRadius ?? 6;
    parts.push(
      tag("rect", {
        ...box,
        rx: radius,
        fill: "#f1f5f9",
        stroke: theme.ink,
      }),
    );
    if (s.control === "progress") {
      parts.push(
        tag("rect", {
          x: box.x,
          y: box.y,
          width: (box.width * (s.progress ?? 0)) / 100,
          height: box.height,
          rx: radius,
          fill: "#137e7e",
        }),
      );
    } else {
      const options = s.options ?? [];
      const width = box.width / Math.max(1, options.length);
      options.forEach((option, index) => {
        const x = box.x + width * index;
        const selected = option === (s.value ?? options[0]);
        if (selected)
          parts.push(
            tag("rect", {
              x,
              y: box.y,
              width,
              height: box.height,
              fill: "#d6ecef",
            }),
          );
        if (selected)
          parts.push(
            tag("rect", {
              x,
              y: box.y + box.height - 3,
              width,
              height: 3,
              fill: "#137e7e",
            }),
          );
        parts.push(
          text(
            {
              x: x + width / 2,
              y: box.y + box.height / 2,
              "text-anchor": "middle",
              "dominant-baseline": "middle",
              "font-family":
                element.visual.style?.fontFamily ?? theme.fontFamily,
              "font-size": element.visual.style?.fontSize ?? 14,
              fill: element.visual.style?.color ?? theme.ink,
            },
            option,
          ),
        );
      });
    }
    return wrap("g", { opacity: s.disabled ? 0.5 : undefined }, parts.join(""));
  }
  const toggle = ["checkbox", "switch", "radio"].includes(s.control);
  const width = toggle ? (s.control === "switch" ? 36 : 18) : box.width;
  const height = toggle ? 18 : box.height;
  const x = box.x;
  const y = toggle ? box.y + (box.height - height) / 2 : box.y;
  const fill = s.checked && toggle ? "#2563eb" : theme.surface;
  const attrs = styled(
    {
      x,
      y,
      width,
      height,
      rx:
        s.control === "switch" || s.control === "radio"
          ? 9
          : (element.visual.style?.cornerRadius ?? 4),
      fill,
      stroke: theme.ink,
    },
    element.visual,
    element.id,
  );
  if (toggle) attrs.fill = s.checked ? "#137e7e" : theme.surface;
  const parts = [tag("rect", attrs)];
  if (s.control === "radio" && s.checked)
    parts.push(tag("circle", { cx: x + 9, cy: y + 9, r: 4, fill: "white" }));
  if (s.control === "switch")
    parts.push(
      tag("circle", {
        cx: x + (s.checked ? 27 : 9),
        cy: y + 9,
        r: 6,
        fill: s.checked ? "white" : theme.ink,
      }),
    );
  if (s.control === "checkbox" && s.checked)
    parts.push(
      tag("path", {
        d: `M ${x + 4} ${y + 9} l 3 3 l 7 -7`,
        fill: "none",
        stroke: "white",
        "stroke-width": 2,
      }),
    );
  const label =
    s.inputType === "password" && s.value
      ? "•".repeat(s.value.length)
      : toggle || s.control === "button"
        ? s.label
        : s.value || s.placeholder || s.label;
  parts.push(
    text(
      {
        x: toggle
          ? x + width + 8
          : s.control === "button"
            ? x + width / 2
            : x + 10,
        "text-anchor": s.control === "button" ? "middle" : "start",
        "font-family": element.visual.style?.fontFamily ?? theme.fontFamily,
        "font-weight": element.visual.style?.fontWeight,
        y: box.y + box.height / 2,
        "dominant-baseline": "middle",
        fill: element.visual.style?.color ?? theme.ink,
        "font-size": element.visual.style?.fontSize ?? 14,
      },
      label,
    ),
  );
  return wrap("g", { opacity: s.disabled ? 0.5 : undefined }, parts.join(""));
}
