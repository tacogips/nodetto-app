// Scaling a page or a set of elements by one factor while keeping their
// layout: every box is scaled about a common origin, text sizes follow, and
// each shape resizes through its own ShapeUtil, so a path's points stretch
// with its box. Connectors follow their endpoints; their free ends scale.

import {
  type Element,
  type ElementId,
  getElementTypeDefinition,
  isKnownElementType,
  isPlainObject,
  type Visual,
} from "@nodetto/ir";
import type { Command } from "./commands.ts";
import type { Editor } from "./editor.ts";
import { expandContainers } from "./frame-tree.ts";
import { type Box, unionBoxes } from "./geometry.ts";
import { CONNECTOR_LABEL_FONT_SIZE } from "./label-layout.ts";
import { TEXT_NOTE_FONT_SIZE } from "./text-layout.ts";

export interface ScalePlan {
  readonly commands: readonly Command[];
  /** Every element the plan positions itself, for ApplyOptions.placed. */
  readonly placed: ReadonlySet<ElementId>;
  readonly origin: { readonly x: number; readonly y: number };
}

function isEdge(element: Element): boolean {
  return (
    isKnownElementType(element.type) &&
    getElementTypeDefinition(element.type)?.category === "edge"
  );
}

/** The text size an element renders with when its style sets none. */
function defaultFontSize(element: Element): number {
  if (element.type === "ui.control") return 14;
  return isEdge(element) ? CONNECTOR_LABEL_FONT_SIZE : TEXT_NOTE_FONT_SIZE;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Heights these types derive from their rows, so only width is scaled. */
const DERIVED_HEIGHT = new Set(["erd.table", "uml.class"]);

/**
 * Plan scaling `ids` (with everything inside their frames and groups) by
 * `factor` about `origin`, by default the top-left corner of their bounds.
 * Null when nothing can be scaled or the factor is not a positive number.
 */
export function planScale(
  editor: Editor,
  ids: Iterable<ElementId>,
  factor: number,
  origin?: { readonly x: number; readonly y: number },
): ScalePlan | null {
  if (!Number.isFinite(factor) || factor <= 0) return null;
  const context = editor.createShapeContext(1);
  const elements = expandContainers(editor.store, ids, context)
    .map((id) => editor.store.get(id))
    .filter((element): element is Element => element !== undefined);
  const boxes = new Map<ElementId, Box>();
  for (const element of elements) {
    if (isEdge(element) || element.type === "group") continue;
    const box = editor.getBounds(element.id, context);
    if (box) boxes.set(element.id, box);
  }
  const bounds = unionBoxes([...boxes.values()]);
  if (!bounds && !elements.some(isEdge)) return null;
  const at = origin ?? { x: bounds?.x ?? 0, y: bounds?.y ?? 0 };
  const scaleX = (x: number) => round(at.x + (x - at.x) * factor);
  const scaleY = (y: number) => round(at.y + (y - at.y) * factor);
  const text = (element: Element, visual: Visual): Visual => {
    const style = visual.style ?? {};
    const hasText =
      style.fontSize !== undefined || editor.editableField(element.id) !== null;
    return hasText
      ? {
          ...visual,
          style: {
            ...style,
            fontSize: round(
              (style.fontSize ?? defaultFontSize(element)) * factor,
            ),
          },
        }
      : visual;
  };

  const commands: Command[] = [];
  for (const element of elements) {
    if (element.type === "group") continue;
    if (isEdge(element)) {
      const semantic = isPlainObject(element.semantic) ? element.semantic : {};
      const ends: Record<string, unknown> = {};
      for (const field of ["fromPoint", "toPoint"] as const) {
        const point = semantic[field];
        if (
          isPlainObject(point) &&
          typeof point["x"] === "number" &&
          typeof point["y"] === "number"
        )
          ends[field] = { x: scaleX(point["x"]), y: scaleY(point["y"]) };
      }
      if (Object.keys(ends).length)
        commands.push({
          type: "updateSemantic",
          id: element.id,
          semantic: { ...semantic, ...ends },
        });
      commands.push({
        type: "replaceVisual",
        id: element.id,
        visual: text(element, element.visual),
      });
      continue;
    }
    const box = boxes.get(element.id);
    if (!box) continue;
    const target: Box = {
      x: scaleX(box.x),
      y: scaleY(box.y),
      width: round(box.width * factor),
      height: DERIVED_HEIGHT.has(element.type)
        ? box.height
        : round(box.height * factor),
    };
    const util = editor.getShapeUtil(element.type);
    const patch: Partial<Visual> =
      util.canResize && util.resize
        ? util.resize(element, target).visual
        : {
            // Fixed-size shapes keep their size and move with the layout.
            x: (element.visual.x ?? box.x) + target.x - box.x,
            y: (element.visual.y ?? box.y) + target.y - box.y,
          };
    const { numberTokens, ...rest } = element.visual;
    const links = Object.fromEntries(
      Object.entries(numberTokens ?? {}).filter(([field]) => !(field in patch)),
    );
    commands.push({
      type: "replaceVisual",
      id: element.id,
      visual: text(element, {
        ...rest,
        ...patch,
        ...(element.type === "text.note" &&
        rest.textResize !== undefined &&
        rest.textResize !== "fixed"
          ? { textResize: "fixed" as const }
          : {}),
        ...(Object.keys(links).length ? { numberTokens: links } : {}),
      }),
    });
  }
  if (!commands.length) return null;
  return {
    commands,
    placed: new Set(elements.map((element) => element.id)),
    origin: at,
  };
}
