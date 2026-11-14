import type { Element, ElementId, FrameSemantic, Page } from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import { boxLabelLayout } from "../label-layout.ts";
import type { Store } from "../store.ts";
import { DEFAULT_SVG_THEME } from "../svg-export/theme.ts";
import {
  textNoteLines,
  TEXT_NOTE_PADDING_X,
  TEXT_NOTE_PADDING_Y,
} from "../text-layout.ts";
import {
  measureTextWidth,
  textMeasureMode,
  truncateToWidth,
} from "../text-measure.ts";
import {
  isInteractive,
  isPrototypeSource,
  touchMinimum,
  type LintNode,
} from "./scope.ts";

import type { AppLintRuleId } from "./index.ts";

export interface AppLintFinding {
  readonly ruleId: AppLintRuleId;
  readonly elementId: ElementId;
  readonly severity: "warning";
  readonly message: string;
  readonly context?: {
    readonly screenId?: ElementId;
    readonly instanceId?: ElementId;
  };
}
const semantic = (e: Element): Record<string, unknown> =>
  e.semantic as Record<string, unknown>;
const contains = (a: Box, b: Box): boolean =>
  a.x <= b.x &&
  a.y <= b.y &&
  a.x + a.width >= b.x + b.width &&
  a.y + a.height >= b.y + b.height;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const fmt = (v: number): string => String(Math.round(v * 10) / 10);

export function lintRules(
  store: Store,
  page: Page,
  nodes: readonly LintNode[],
): readonly AppLintFinding[] {
  const findings: AppLintFinding[] = [];
  const seen = new Set<string>();
  const nodeById = new Map(nodes.map((node) => [node.element.id, node]));
  const add = (
    node: LintNode,
    ruleId: AppLintRuleId,
    message: string,
  ): void => {
    let detail = message;
    const key = `${ruleId}:${node.element.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    let context: AppLintFinding["context"];
    if (node.inInstance && node.instanceId) {
      const instance = store.get(node.instanceId);
      const screen = node.screenId ? store.get(node.screenId) : undefined;
      const name =
        instance?.visual.layerName ||
        (instance ? str(semantic(instance)["name"]) : "") ||
        node.instanceId;
      const kit = instance ? str(semantic(instance)["kit"]) : "";
      const screenName = screen
        ? str(semantic(screen)["name"]) || screen.id
        : "";
      detail += ` (in instance "${name}"${kit ? ` ${kit}` : ""}${screen ? `, screen "${screenName}"` : ""})`;
      context = {
        ...(node.screenId ? { screenId: node.screenId } : {}),
        instanceId: node.instanceId,
      };
    }
    findings.push({
      elementId: node.element.id,
      ruleId,
      severity: "warning",
      message: detail,
      ...(context ? { context } : {}),
    });
  };
  for (const node of nodes) {
    const e = node.element;
    const box = node.box;
    const s = semantic(e);
    const parent = node.parentId ? store.get(node.parentId) : undefined;
    const ps = parent
      ? (semantic(parent) as unknown as FrameSemantic)
      : undefined;
    const pb = node.parentId ? nodeById.get(node.parentId)?.box : undefined;
    if (!node.screenId && (page.mode === "app" || page.mode === "web"))
      add(node, "app-off-frame", "element is outside every screen");
    if (
      pb &&
      !ps?.clipContent &&
      (!ps?.prototypeOverflow || ps.prototypeOverflow === "none") &&
      (box.x < pb.x - 0.5 ||
        box.y < pb.y - 0.5 ||
        box.x + box.width > pb.x + pb.width + 0.5 ||
        box.y + box.height > pb.y + pb.height + 0.5)
    )
      add(node, "app-off-frame", "element extends beyond its parent frame");
    const style = e.visual.style;
    if (e.type === "text.note") {
      const lines = textNoteLines(e);
      const paddingY = e.visual.textPadding ?? TEXT_NOTE_PADDING_Y;
      const paddingX = e.visual.textPadding ?? TEXT_NOTE_PADDING_X;
      const width = box.width - 2 * paddingX;
      const measure = {
        fontSize: lines.fontSize,
        fontWeight: style?.fontWeight,
        letterSpacing: style?.letterSpacing,
      };
      if (lines.truncated) add(node, "app-text-truncated", "text is truncated");
      else if (
        lines.lines.length * lines.lineHeight + 2 * paddingY >
          box.height + 0.5 ||
        lines.lines.some(
          (line) =>
            measureTextWidth(line, measure, textMeasureMode(e.visual)) >
            width + 0.5,
        )
      )
        add(node, "app-text-overflow", "text overflows its box");
    } else if (e.type === "ui.control") {
      const label = str(s["value"]) || str(s["placeholder"]) || str(s["label"]);
      const iconSize = typeof s["iconSize"] === "number" ? s["iconSize"] : 20;
      const padding =
        e.visual.textPadding ?? (s["control"] === "button" ? 12 : 10);
      const width = Math.max(
        0,
        box.width -
          2 * padding -
          (s["leadingIcon"] ? iconSize + 6 : 0) -
          (s["trailingIcon"] ? iconSize + 6 : 0),
      );
      const measure = {
        fontSize: style?.fontSize ?? 14,
        fontWeight: style?.fontWeight,
        letterSpacing: style?.letterSpacing,
      };
      if (e.visual.textTruncate === "ellipsis") {
        if (
          truncateToWidth(label, width, measure, textMeasureMode(e.visual))
            .truncated
        )
          add(node, "app-text-truncated", "text is truncated");
      } else if (
        label
          .split(/\r?\n/)
          .some(
            (line) =>
              measureTextWidth(line, measure, textMeasureMode(e.visual)) >
              width + 0.5,
          )
      )
        add(node, "app-text-overflow", "control label overflows its box");
    } else if (e.type === "shape.geo" && str(s["label"])) {
      const layout = boxLabelLayout(
        str(s["label"]),
        box.width,
        e.visual,
        DEFAULT_SVG_THEME.fontSize,
      );
      if (layout.lines.length * layout.lineHeight > box.height + 0.5)
        add(node, "app-text-overflow", "shape label overflows its box");
    }
    const flow = Boolean(ps?.layout && e.visual.layoutPosition !== "absolute");
    if (
      !flow &&
      (!node.inInstance || node.geometryOverridden) &&
      node.screenId !== e.id
    ) {
      const grid = ps?.layoutGrids?.find((g) => g.kind === "grid");
      const step = grid?.kind === "grid" ? grid.size : 1;
      const values = [box.x - (pb?.x ?? 0), box.y - (pb?.y ?? 0)];
      if (
        e.visual.textResize !== "auto-width" &&
        !(
          e.type === "frame" &&
          (s["layout"] as FrameSemantic["layout"])?.widthSizing === "hug"
        ) &&
        !(
          e.type === "frame" &&
          (s["layout"] as FrameSemantic["layout"])?.sizing === "hug" &&
          !(s["layout"] as FrameSemantic["layout"])?.widthSizing
        )
      )
        values.push(box.width);
      if (
        e.visual.textResize !== "auto-width" &&
        e.visual.textResize !== "auto-height" &&
        !(
          e.type === "frame" &&
          (s["layout"] as FrameSemantic["layout"])?.heightSizing === "hug"
        ) &&
        !(
          e.type === "frame" &&
          (s["layout"] as FrameSemantic["layout"])?.sizing === "hug" &&
          !(s["layout"] as FrameSemantic["layout"])?.heightSizing
        )
      )
        values.push(box.height);
      if (values.some((v) => Math.abs(v - Math.round(v / step) * step) > 0.01))
        add(node, "app-off-grid", `element is off the ${fmt(step)} point grid`);
    }
    if (isInteractive(node, store) && node.screenId) {
      const screen = store.get(node.screenId);
      const minimum = screen ? touchMinimum(screen) : undefined;
      if (minimum && (box.width < minimum || box.height < minimum)) {
        let ancestor = node.parentId ? nodeById.get(node.parentId) : undefined;
        let covered = false;
        while (ancestor && ancestor.element.id !== node.screenId) {
          if (isInteractive(ancestor, store)) {
            covered =
              ancestor.box.width >= minimum && ancestor.box.height >= minimum;
            break;
          }
          ancestor = ancestor.parentId
            ? nodeById.get(ancestor.parentId)
            : undefined;
        }
        if (!covered || isPrototypeSource(e.id, store))
          add(
            node,
            "app-touch-target",
            `touch target is smaller than ${minimum} points`,
          );
      }
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    const later = nodes[i];
    if (!later) continue;
    const parent = later.parentId ? store.get(later.parentId) : undefined;
    const layout =
      parent && (semantic(parent) as unknown as FrameSemantic).layout;
    for (let j = 0; j < i; j++) {
      const earlier = nodes[j];
      if (
        !earlier ||
        earlier.parentId !== later.parentId ||
        earlier.screenId !== later.screenId
      )
        continue;
      const a = earlier.box;
      const b = later.box;
      const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (
        isInteractive(earlier, store) &&
        isInteractive(later, store) &&
        w > 0 &&
        h > 0 &&
        w * h > 0.25 &&
        !contains(a, b) &&
        !contains(b, a)
      )
        add(
          later,
          "app-control-overlap",
          `control overlaps ${earlier.element.id}`,
        );
      if (!layout && (!later.inInstance || later.geometryOverridden)) {
        const diffs = [
          a.x - b.x,
          a.x + a.width - b.x - b.width,
          a.x + a.width / 2 - b.x - b.width / 2,
          a.y - b.y,
        ];
        if (diffs.some((v) => Math.abs(v) > 0.01 && Math.abs(v) <= 2))
          add(
            later,
            "app-misaligned",
            `element nearly aligns with ${earlier.element.id}`,
          );
      }
    }
  }
  const order = new Map(nodes.map((node, index) => [node.element.id, index]));
  return findings.sort(
    (a, b) =>
      (order.get(a.elementId) ?? 0) - (order.get(b.elementId) ?? 0) ||
      a.ruleId.localeCompare(b.ruleId),
  );
}
