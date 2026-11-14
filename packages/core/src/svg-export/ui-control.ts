// UI mockup controls: tabs, progress bars, toggles, buttons and inputs.

import type { Element, UiControlSemantic } from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import { findIcon } from "../icons/icon-registry.ts";
import { renderIconMarkup } from "../icons/icon-markup.ts";
import { textMeasureMode, truncateToWidth } from "../text-measure.ts";
import { resolveUiControlPaint } from "../ui-control-paint.ts";
import { tag, text, wrap } from "./markup.ts";
import { styled } from "./paint.ts";
import { rectStrokeMarkup, rectStrokeParts } from "./rect-strokes.ts";
import type { SvgTheme } from "./theme.ts";

function badgeMarkup(
  badge: string | undefined,
  box: Box,
  accent: string,
  fontFamily: string,
): string {
  if (badge === undefined) return "";
  const x = box.x + box.width - 4;
  const y = box.y - 4;
  if (badge === "") return tag("circle", { cx: x, cy: y, r: 4, fill: accent });
  const width = Math.max(18, badge.length * 7 + 10);
  return (
    tag("rect", {
      x: x - width / 2,
      y: y - 9,
      width,
      height: 18,
      rx: 9,
      fill: accent,
    }) +
    text(
      {
        x,
        y,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-family": fontFamily,
        "font-size": 11,
        "font-weight": 700,
        fill: "white",
      },
      badge,
    )
  );
}

export function renderUiControl(
  element: Element,
  box: Box,
  theme: SvgTheme,
): string {
  const s = element.semantic as UiControlSemantic;
  const paint = resolveUiControlPaint(element, theme);
  if (s.control === "tabs" || s.control === "progress") {
    const parts: string[] = [];
    const radius = paint.radius;
    const strokeParts = rectStrokeParts(box, element.visual.style);
    parts.push(
      strokeParts
        ? rectStrokeMarkup(
            strokeParts,
            {
              fill: paint.fill,
              stroke: paint.stroke,
              opacity: element.visual.style?.opacity,
            },
            `nd-strokes-${element.id}`,
          )
        : tag(
            "rect",
            styled(
              {
                ...box,
                rx: radius,
                fill: paint.fill,
                stroke: paint.stroke,
              },
              element.visual,
              element.id,
            ),
          ),
    );
    if (s.control === "progress") {
      parts.push(
        tag("rect", {
          x: box.x,
          y: box.y,
          width: (box.width * (s.progress ?? 0)) / 100,
          height: box.height,
          rx: radius,
          fill: paint.accent,
        }),
      );
    } else {
      const options = s.options ?? [];
      const width = box.width / Math.max(1, options.length);
      options.forEach((option, index) => {
        const x = box.x + width * index;
        const selected = option === (s.value ?? options[0]);
        if (selected && s.indicator !== "underline")
          parts.push(
            tag("rect", {
              x: x + (s.indicator === "pill" ? 2 : 0),
              y: box.y + (s.indicator === "pill" ? 2 : 0),
              width: width - (s.indicator === "pill" ? 4 : 0),
              height: box.height - (s.indicator === "pill" ? 4 : 0),
              rx: s.indicator === "pill" ? (box.height - 4) / 2 : undefined,
              fill: s.indicator === "pill" ? paint.accent : paint.selectedFill,
            }),
          );
        if (selected && s.indicator !== "pill")
          parts.push(
            tag("rect", {
              x,
              y: box.y + box.height - (s.indicator === "underline" ? 2 : 3),
              width,
              height: s.indicator === "underline" ? 2 : 3,
              fill: paint.accent,
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
              "font-weight": element.visual.style?.fontWeight,
              "letter-spacing": element.visual.style?.letterSpacing,
              fill: selected ? paint.selected : paint.color,
            },
            option,
          ),
        );
      });
    }
    parts.push(badgeMarkup(s.badge, box, paint.accent, paint.fontFamily));
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
  if (toggle)
    attrs.fill = s.checked
      ? paint.accent
      : (element.visual.style?.fill ?? theme.surface);
  const strokeParts = rectStrokeParts(
    { x, y, width, height },
    element.visual.style,
  );
  const parts = [
    strokeParts
      ? rectStrokeMarkup(
          strokeParts,
          {
            fill: String(attrs.fill),
            stroke: String(attrs.stroke),
            opacity: element.visual.style?.opacity,
          },
          `nd-strokes-${element.id}`,
        )
      : tag("rect", attrs),
  ];
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
  const align = element.visual.style?.textAlign;
  const padding =
    element.visual.textPadding ?? (s.control === "button" ? 12 : 10);
  const anchor = toggle
    ? "start"
    : align === "end"
      ? "end"
      : align === "middle"
        ? "middle"
        : align === "start"
          ? "start"
          : s.control === "button"
            ? "middle"
            : "start";
  const iconSize = s.iconSize ?? 20;
  const leadingSpace = s.leadingIcon ? iconSize + 6 : 0;
  const trailingSpace = s.trailingIcon ? iconSize + 6 : 0;
  const labelX = toggle
    ? x + width + 8
    : anchor === "middle"
      ? x + width / 2 + (leadingSpace - trailingSpace) / 2
      : anchor === "end"
        ? x + width - padding - trailingSpace
        : x + padding + leadingSpace;
  const displayLabel =
    element.visual.textTruncate === "ellipsis"
      ? truncateToWidth(
          label,
          Math.max(0, width - 2 * padding - leadingSpace - trailingSpace),
          {
            fontSize: element.visual.style?.fontSize ?? 14,
            fontWeight: element.visual.style?.fontWeight,
            letterSpacing: element.visual.style?.letterSpacing,
          },
          textMeasureMode(element.visual),
        ).text
      : label;
  const lines = displayLabel.split("\n");
  for (const [name, iconX] of [
    [s.leadingIcon, x + padding],
    [s.trailingIcon, x + width - padding - iconSize],
  ] as const) {
    const icon = name && findIcon(name);
    if (icon)
      parts.push(
        renderIconMarkup(
          icon,
          {
            x: iconX,
            y: box.y + (box.height - iconSize) / 2,
            width: iconSize,
            height: iconSize,
          },
          { stroke: paint.color, strokeWidth: 2, fill: "none", viewBox: 24 },
        ),
      );
  }
  const lineHeight =
    (element.visual.style?.fontSize ?? 14) *
    (element.visual.style?.lineHeight ?? 1.2);
  lines.forEach((line, index) =>
    parts.push(
      text(
        {
          x: labelX,
          "text-anchor": anchor,
          "font-family": element.visual.style?.fontFamily ?? theme.fontFamily,
          "font-weight": element.visual.style?.fontWeight,
          "letter-spacing": element.visual.style?.letterSpacing,
          y:
            box.y +
            box.height / 2 +
            (index - (lines.length - 1) / 2) * lineHeight,
          "dominant-baseline": "middle",
          fill: element.visual.style?.color ?? theme.ink,
          "font-size": element.visual.style?.fontSize ?? 14,
        },
        line,
      ),
    ),
  );
  parts.push(badgeMarkup(s.badge, box, paint.accent, paint.fontFamily));
  return wrap("g", { opacity: s.disabled ? 0.5 : undefined }, parts.join(""));
}
