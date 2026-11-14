// Breadboard specifics of the editor: probe identity, placing parts on the
// hole grid, semantic edits that keep a part's first pin in place, and
// reference designators for pasted parts.

import {
  BREADBOARD_PITCH,
  type BreadboardElementType,
  type BreadboardPartSemantic,
  type BreadboardPartType,
  type Element,
  type ElementId,
  isBreadboardElementType,
  isBreadboardPartType,
  type PageId,
} from "@nodetto/ir";
import { annotateBreadboardParts } from "../breadboard/annotate.ts";
import { boardLayout } from "../breadboard/board.ts";
import {
  breadboardDefaultSemantic,
  breadboardLocalBox,
  breadboardPins,
  NETLIST_CARD_SIZE,
} from "../breadboard/catalogue.ts";
import { snapBreadboardPoint } from "../breadboard/snap.ts";
import type { BreadboardProbe } from "../breadboard/types.ts";
import type { Command } from "../commands.ts";
import type { Editor } from "../editor.ts";
import { keyBetween, type Rng } from "../fractional.ts";
import type { Vec } from "../geometry.ts";
import type { Store } from "../store.ts";

export function sameBreadboardProbe(
  left: BreadboardProbe | null,
  right: BreadboardProbe | null,
): boolean {
  if (left === right) return true;
  if (!left || !right || left.pageId !== right.pageId) return false;
  if (left.elementIds.length !== right.elementIds.length) return false;
  if (left.elementIds.some((id, index) => id !== right.elementIds[index]))
    return false;
  return (
    left.pin?.elementId === right.pin?.elementId &&
    left.pin?.pin === right.pin?.pin
  );
}

/**
 * Build a breadboard part snapped to the hole grid of the current page, or
 * `null` when the current page is not a breadboard.
 */
export function buildBreadboardPart(
  editor: Editor,
  rng: Rng,
  type: BreadboardElementType,
  at: Vec,
  semantic: Readonly<Record<string, unknown>> | undefined,
): Element | null {
  const page = editor.store.getPage(editor.currentPageId);
  if (!page || page.kind !== "breadboard") return null;
  const merged = {
    ...(breadboardDefaultSemantic(type) as Record<string, unknown>),
    ...(semantic ?? {}),
  };
  if (type === "breadboard.netlist" && merged["source"] === "") {
    merged["source"] = "manual";
  }
  const point = snapBreadboardPoint(at);
  let x = point.x;
  let y = point.y;
  if (isBreadboardPartType(type)) {
    const initial = merged as unknown as BreadboardPartSemantic;
    const local = breadboardLocalBox(type, initial);
    x += local.x * BREADBOARD_PITCH;
    y += local.y * BREADBOARD_PITCH;
    const refs = editor.store
      .getPageElements(page.id)
      .filter((element) => isBreadboardPartType(element.type))
      .map((element) => (element.semantic as { reference: string }).reference);
    const [reference] = annotateBreadboardParts(refs, [
      { type, reference: String(merged["reference"] ?? "") },
    ]);
    if (reference) merged["reference"] = reference;
  } else if (type === "breadboard.board") {
    x -= 3 * BREADBOARD_PITCH;
    y -= 5 * BREADBOARD_PITCH;
  } else if (type === "breadboard.wire") {
    const [first] = merged["points"] as readonly Vec[];
    if (first) {
      x -= first.x;
      y -= first.y;
    }
  }
  let index = editor.nextIndex(page.id);
  if (type === "breadboard.board") {
    const [first] = editor.store.getPageElements(page.id);
    if (first) index = keyBetween(null, first.index, rng);
  }
  const size =
    type === "breadboard.board"
      ? boardLayout(
          merged["size"] === "full" || merged["size"] === "mini"
            ? merged["size"]
            : "half",
        ).width * BREADBOARD_PITCH
      : undefined;
  const dimensions = isBreadboardPartType(type)
    ? breadboardLocalBox(type, merged as unknown as BreadboardPartSemantic)
    : undefined;
  return editor.buildElement(type, {
    page: page.id,
    index,
    semantic: merged,
    visual: {
      x,
      y,
      ...(dimensions
        ? {
            width: dimensions.width * BREADBOARD_PITCH,
            height: dimensions.height * BREADBOARD_PITCH,
          }
        : {}),
      ...(size !== undefined
        ? {
            width: size,
            height:
              boardLayout(
                merged["size"] === "full" || merged["size"] === "mini"
                  ? merged["size"]
                  : "half",
              ).height * BREADBOARD_PITCH,
          }
        : {}),
      ...(type === "breadboard.netlist"
        ? {
            width: NETLIST_CARD_SIZE.width * BREADBOARD_PITCH,
            height: NETLIST_CARD_SIZE.height * BREADBOARD_PITCH,
          }
        : {}),
    },
  });
}

/**
 * The commands that merge `patch` into a breadboard element's semantic,
 * resizing a board and keeping a part's first pin where it was. `null` when
 * the element is not breadboard or its pins cannot be resolved.
 */
export function planBreadboardSemanticUpdate(
  store: Store,
  id: ElementId,
  patch: Readonly<Record<string, unknown>>,
): Command[] | null {
  const element = store.get(id);
  if (!element || !isBreadboardElementType(element.type)) return null;
  const semantic = {
    ...(element.semantic as object),
    ...patch,
  } as unknown as BreadboardPartSemantic;
  if (!isBreadboardPartType(element.type)) {
    const commands: Command[] = [{ type: "updateSemantic", id, semantic }];
    const semanticRecord = semantic as unknown as Record<string, unknown>;
    if (
      element.type === "breadboard.board" &&
      semanticRecord["size"] !==
        (element.semantic as Record<string, unknown>)["size"]
    ) {
      const requestedSize = semanticRecord["size"];
      const size =
        requestedSize === "full" || requestedSize === "mini"
          ? requestedSize
          : "half";
      const layout = boardLayout(size);
      commands.push({
        type: "updateVisual",
        id,
        visual: {
          width: layout.width * BREADBOARD_PITCH,
          height: layout.height * BREADBOARD_PITCH,
        },
      });
    }
    return commands;
  }
  const [first] = breadboardPins(element);
  if (!first) return null;
  const local = breadboardLocalBox(element.type, semantic);
  const baseVisual = {
    ...element.visual,
    width: local.width * BREADBOARD_PITCH,
    height: local.height * BREADBOARD_PITCH,
  };
  const candidate = { ...element, semantic, visual: baseVisual };
  const [nextPin] = breadboardPins(candidate);
  if (!nextPin) return null;
  const visual = {
    ...baseVisual,
    x: (element.visual.x ?? 0) + first.x - nextPin.x,
    y: (element.visual.y ?? 0) + first.y - nextPin.y,
  };
  return [
    { type: "updateSemantic", id, semantic },
    { type: "replaceVisual", id, visual },
  ];
}

/**
 * Renumber the reference designators of breadboard parts a paste creates on
 * `pageId` so they do not collide with the parts already there.
 */
export function planPastedBreadboardReferences(
  store: Store,
  pageId: PageId,
  pasted: readonly Command[],
): Command[] {
  const annotation: Command[] = [];
  const copied = pasted.flatMap((command) =>
    command.type === "createElement" &&
    isBreadboardPartType(command.element.type)
      ? [
          {
            element: command.element,
            type: command.element.type as BreadboardPartType,
            reference: (command.element.semantic as { reference: string })
              .reference,
          },
        ]
      : [],
  );
  const existing = store
    .getPageElements(pageId)
    .filter((element) => isBreadboardPartType(element.type))
    .map((element) => (element.semantic as { reference: string }).reference);
  const refs = annotateBreadboardParts(existing, copied);
  copied.forEach(({ element }, index) => {
    const reference = refs[index];
    if (
      reference &&
      reference !== (element.semantic as { reference: string }).reference
    ) {
      annotation.push({
        type: "updateSemantic",
        id: element.id,
        semantic: { ...(element.semantic as object), reference },
      });
    }
  });
  return annotation;
}
