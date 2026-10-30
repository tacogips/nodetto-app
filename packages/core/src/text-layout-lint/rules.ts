import type { Element, ElementId, PageKind } from "@nodetto/ir";
import type { Box, Vec } from "../geometry.ts";
import { boxLabelLayout } from "../label-layout.ts";
import { nodeLabelLayout } from "../node-label.ts";
import { textNoteText } from "../shapes/textNote.ts";
import { readString } from "../svg-export/markup.ts";
import { DEFAULT_SVG_THEME } from "../svg-export/theme.ts";
import {
  TEXT_NOTE_LINE_HEIGHT,
  TEXT_NOTE_PADDING_X,
  TEXT_NOTE_PADDING_Y,
  wrapTextLines,
} from "../text-layout.ts";
import { wideAwareLineCount, wideAwareTextWidth } from "../wide-text-width.ts";

export const TEXT_LAYOUT_LINT_RULE_IDS = [
  "label-overflow",
  "label-collision",
  "note-overflow",
] as const;
export const TEXT_LAYOUT_LINT_PAGE_KINDS: readonly PageKind[] = [
  "architecture",
  "freeform",
  "flowchart",
];
export type TextLayoutLintRuleId = (typeof TEXT_LAYOUT_LINT_RULE_IDS)[number];
export interface TextLayoutLintFinding {
  readonly elementId: ElementId;
  readonly ruleId: TextLayoutLintRuleId;
  readonly severity: "warning";
  readonly message: string;
}
export interface Item {
  element: Element;
  box: Box;
  order: number;
}
export interface LabelItem extends Item {
  points: readonly Vec[];
}
const EPS = 0.01;
const fmt = (v: number) => String(Math.round(v * 10) / 10);
const finding = (
  element: Element,
  ruleId: TextLayoutLintRuleId,
  message: string,
): TextLayoutLintFinding => ({
  elementId: element.id,
  ruleId,
  severity: "warning",
  message,
});

export function labelOverflow(item: Item): TextLayoutLintFinding[] {
  const { element, box } = item;
  const label = readString(element.semantic, "label");
  if (
    (element.type !== "node.generic" && element.type !== "shape.geo") ||
    typeof label !== "string" ||
    !label
  )
    return [];
  const node = element.type === "node.generic";
  const layout = node
    ? nodeLabelLayout(label, {
        ...element.visual,
        width: box.width,
        height: box.height,
      })
    : boxLabelLayout(
        label,
        box.width,
        element.visual,
        DEFAULT_SVG_THEME.fontSize,
      );
  const available = node
    ? (layout as ReturnType<typeof nodeLabelLayout>).width
    : box.width - 2 * TEXT_NOTE_PADDING_X;
  const results: TextLayoutLintFinding[] = [];
  for (const [i, line] of layout.lines.entries()) {
    const width = wideAwareTextWidth(
      line,
      layout.fontSize,
      element.visual.style?.letterSpacing ?? 0,
    );
    if (line.trim() && width > available + EPS) {
      results.push(
        finding(
          element,
          "label-overflow",
          `Label line ${i + 1} of ${layout.lines.length} is ${fmt(width)} wide but the text area is ${fmt(available)} wide at ${fmt(layout.fontSize)}px; ${node ? "export clips it." : "export draws it past the label padding."}`,
        ),
      );
      break;
    }
  }
  const height = layout.lines.length * layout.lineHeight;
  if (height > box.height + EPS) {
    const top = node
      ? (layout as ReturnType<typeof nodeLabelLayout>).top
      : (box.height - height) / 2;
    const clipped = layout.lines.filter(
      (_, i) => top + (i + 1) * layout.lineHeight > box.height + EPS,
    ).length;
    results.push(
      finding(
        element,
        "label-overflow",
        `Label needs ${layout.lines.length} lines (${fmt(height)} high) but the box is ${fmt(box.height)} high at ${fmt(layout.fontSize)}px; ${node ? `export clips ${clipped} lines.` : "the text spills outside the shape."}`,
      ),
    );
  }
  return results;
}

type SweepItem = {
  box: Box;
  order: number;
  kind: "label" | "body" | "probe";
  item: Item;
  points?: readonly Vec[];
  textBottom?: number;
  padding?: number;
};
export function pairFindings(
  labels: LabelItem[],
  bodies: Item[],
  notes: Item[],
): TextLayoutLintFinding[] {
  const results: TextLayoutLintFinding[] = [];
  const items: SweepItem[] = [
    ...labels.map(
      (item): SweepItem => ({
        box: item.box,
        order: item.order,
        kind: "label",
        item,
        points: item.points,
      }),
    ),
    ...bodies.map(
      (item): SweepItem => ({
        box: item.box,
        order: item.order,
        kind: "body",
        item,
      }),
    ),
  ];
  for (const item of notes) {
    const { element, box } = item;
    const style = element.visual.style;
    const px = element.visual.textPadding ?? TEXT_NOTE_PADDING_X;
    const py = element.visual.textPadding ?? TEXT_NOTE_PADDING_Y;
    const font = style?.fontSize ?? DEFAULT_SVG_THEME.fontSize;
    const lh = font * (style?.lineHeight ?? TEXT_NOTE_LINE_HEIGHT);
    const available = Math.max(1, box.width - 2 * px);
    const letterSpacing = style?.letterSpacing ?? 0;
    const lines = wrapTextLines(
      textNoteText(element.semantic),
      available,
      font,
      letterSpacing,
    );
    const free = Math.max(0, box.height - 2 * py - lines.length * lh);
    const offset =
      style?.verticalAlign === "bottom"
        ? free
        : style?.verticalAlign === "middle"
          ? free / 2
          : 0;
    let drawn = 0;
    while (
      drawn < lines.length &&
      py + offset + (drawn + 1) * lh <= box.height + EPS
    )
      drawn++;
    if (drawn < lines.length)
      results.push(
        finding(
          element,
          "note-overflow",
          `Text needs ${lines.length} lines (${fmt(2 * py + lines.length * lh)} high with padding) but the box is ${fmt(box.height)} high; export drops ${lines.length - drawn} lines.`,
        ),
      );
    for (let i = 0; i < drawn; i++) {
      const line = lines[i] ?? "";
      const width = wideAwareTextWidth(line, font, letterSpacing);
      if (line.trim() && width > available + EPS) {
        results.push(
          finding(
            element,
            "note-overflow",
            `Text line ${i + 1} of ${lines.length} is ${fmt(width)} wide but the text area is ${fmt(available)} wide at ${fmt(font)}px; export draws it past the note padding.`,
          ),
        );
        break;
      }
    }
    if (drawn === lines.length) {
      const wideCount = lines.reduce(
        (count, line) =>
          count + wideAwareLineCount(line, available, font, letterSpacing),
        0,
      );
      const wideFree = Math.max(0, box.height - 2 * py - wideCount * lh);
      const wideOffset =
        style?.verticalAlign === "bottom"
          ? wideFree
          : style?.verticalAlign === "middle"
            ? wideFree / 2
            : 0;
      if (py + wideOffset + wideCount * lh > box.height + EPS)
        results.push(
          finding(
            element,
            "note-overflow",
            `Text needs ${wideCount} lines with wide characters at 1 em (${fmt(2 * py + wideCount * lh)} high with padding) but the box is ${fmt(box.height)} high; real fonts overflow it.`,
          ),
        );
    }
    if (
      (element.visual.rotation ?? 0) !== 0 ||
      !lines.slice(0, drawn).some((line) => line !== "")
    )
      continue;
    const top = box.y + py + offset;
    const bottom = top + drawn * lh;
    items.push({
      kind: "probe",
      order: item.order,
      item,
      box: { x: box.x, y: top, width: box.width, height: bottom + py - top },
      textBottom: bottom,
      padding: py,
    });
  }
  items.sort((a, b) => a.box.x - b.box.x || a.order - b.order);
  let active: SweepItem[] = [];
  for (const current of items) {
    active = active.filter((a) => a.box.x + a.box.width >= current.box.x);
    for (const other of active) {
      const a = current.box;
      const b = other.box;
      const ow = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const oh = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (ow <= EPS || oh <= EPS) continue;
      if (current.kind === "label" && other.kind === "label") {
        const later = current.order > other.order ? current : other;
        const earlier = later === current ? other : current;
        results.push(
          finding(
            later.item.element,
            "label-collision",
            `Label box ${fmt(later.box.width)}x${fmt(later.box.height)} overlaps the label of ${earlier.item.element.id} by ${fmt(ow)}x${fmt(oh)}.`,
          ),
        );
      } else {
        const label =
          current.kind === "label"
            ? current
            : other.kind === "label"
              ? other
              : undefined;
        const body =
          current.kind === "body"
            ? current
            : other.kind === "body"
              ? other
              : undefined;
        const probe =
          current.kind === "probe"
            ? current
            : other.kind === "probe"
              ? other
              : undefined;
        if (
          label &&
          body &&
          !label.points?.every(
            (p) =>
              p.x >= body.box.x - EPS &&
              p.x <= body.box.x + body.box.width + EPS &&
              p.y >= body.box.y - EPS &&
              p.y <= body.box.y + body.box.height + EPS,
          )
        )
          results.push(
            finding(
              label.item.element,
              "label-collision",
              `Label box ${fmt(label.box.width)}x${fmt(label.box.height)} overlaps ${body.item.element.type} ${body.item.element.id} by ${fmt(ow)}x${fmt(oh)}.`,
            ),
          );
        if (
          probe &&
          body &&
          probe.item.element.id !== body.item.element.id &&
          body.box.y > probe.box.y + EPS &&
          body.box.y < (probe.textBottom ?? 0) + (probe.padding ?? 0) - EPS
        ) {
          const bottom = probe.textBottom ?? 0;
          const gap = probe.padding ?? 0;
          const message =
            body.box.y < bottom
              ? `Text runs ${fmt(bottom - body.box.y)} into ${body.item.element.type} ${body.item.element.id} below; keep ${fmt(gap)} clear.`
              : `Text ends ${fmt(body.box.y - bottom)} above ${body.item.element.type} ${body.item.element.id}; keep ${fmt(gap)} clear.`;
          results.push(finding(probe.item.element, "note-overflow", message));
        }
      }
    }
    active.push(current);
  }
  return results;
}
