import {
  isSchematicElementType,
  isSchematicPartType,
  roundCoordinate,
  SCHEMATIC_REFERENCE_PREFIX,
  type Element,
  type ElementId,
  type PageId,
  type SchematicElementType,
} from "@nodetto/ir";
import { annotateReferences } from "../breadboard/annotate.ts";
import { snapBreadboardPoint } from "../breadboard/snap.ts";
import type { Command } from "../commands.ts";
import type { Rng } from "../fractional.ts";
import type { Vec } from "../geometry.ts";
import {
  schematicDefaultSemantic,
  schematicLocalBox,
  schematicPins,
} from "../schematic/symbols.ts";
import type { Store } from "../store.ts";
import type { EditorCore } from "./facade/core.ts";

export function buildSchematicElement(
  editor: EditorCore,
  _rng: Rng,
  type: SchematicElementType,
  at: Vec,
  patch?: Readonly<Record<string, unknown>>,
): Element | null {
  const page = editor.store.getPage(editor.currentPageId);
  if (!page || page.kind !== "schematic") return null;
  const defaults =
    isSchematicPartType(type) || type === "schematic.power"
      ? schematicDefaultSemantic(type)
      : type === "schematic.wire"
        ? {
            points: [
              { x: 0, y: 0 },
              { x: 20, y: 0 },
            ],
          }
        : type === "schematic.label"
          ? { net: "NET" }
          : {};
  const semantic: Record<string, unknown> = { ...defaults, ...patch };
  if (
    type === "schematic.power" &&
    semantic["style"] === "rail" &&
    patch?.["net"] === undefined
  )
    semantic["net"] = "VCC";
  if (isSchematicPartType(type)) {
    const existing = editor.store
      .getPageElements(page.id)
      .filter((e) => isSchematicPartType(e.type))
      .map((e) => (e.semantic as { reference: string }).reference);
    const [reference] = annotateReferences(existing, [
      {
        prefix: SCHEMATIC_REFERENCE_PREFIX[type],
        reference: String(semantic["reference"] ?? ""),
      },
    ]);
    if (reference) semantic["reference"] = reference;
  }
  const point = snapBreadboardPoint(at);
  let element = editor.buildElement(type, {
    page: page.id,
    semantic,
    visual: { x: point.x, y: point.y },
  });
  if (isSchematicPartType(type) || type === "schematic.power") {
    const box = schematicLocalBox(element);
    element = {
      ...element,
      visual: { ...element.visual, width: box.width, height: box.height },
    };
    const pin = schematicPins(element)[0];
    if (pin)
      element = {
        ...element,
        visual: {
          ...element.visual,
          x: roundCoordinate(point.x + point.x - pin.x),
          y: roundCoordinate(point.y + point.y - pin.y),
        },
      };
  } else if (type === "schematic.wire") {
    const first = (semantic["points"] as readonly Vec[] | undefined)?.[0];
    if (first)
      element = {
        ...element,
        visual: {
          ...element.visual,
          x: roundCoordinate(point.x - first.x),
          y: roundCoordinate(point.y - first.y),
        },
      };
  }
  return element;
}

export function planSchematicSemanticUpdate(
  store: Store,
  id: ElementId,
  patch: Readonly<Record<string, unknown>>,
): Command[] | null {
  const element = store.get(id);
  if (!element || !isSchematicElementType(element.type)) return null;
  const semantic = { ...(element.semantic as object), ...patch };
  const commands: Command[] = [{ type: "updateSemantic", id, semantic }];
  if (!isSchematicPartType(element.type) && element.type !== "schematic.power")
    return commands;
  const first = schematicPins(element)[0];
  const candidate = { ...element, semantic };
  const box = schematicLocalBox(candidate);
  const visual = { ...element.visual, width: box.width, height: box.height };
  const next = schematicPins({ ...candidate, visual })[0];
  if (!first || !next) return null;
  commands.push({
    type: "replaceVisual",
    id,
    visual: {
      ...visual,
      x: roundCoordinate(
        roundCoordinate(element.visual.x ?? 0) + first.x - next.x,
      ),
      y: roundCoordinate(
        roundCoordinate(element.visual.y ?? 0) + first.y - next.y,
      ),
    },
  });
  return commands;
}

export function planPastedSchematicReferences(
  store: Store,
  pageId: PageId,
  pasted: readonly Command[],
): Command[] {
  const copied = pasted.flatMap((command) =>
    command.type === "createElement" &&
    isSchematicPartType(command.element.type)
      ? [
          {
            element: command.element,
            prefix: SCHEMATIC_REFERENCE_PREFIX[command.element.type],
            reference: (command.element.semantic as { reference: string })
              .reference,
          },
        ]
      : [],
  );
  const existing = store
    .getPageElements(pageId)
    .filter((e) => isSchematicPartType(e.type))
    .map((e) => (e.semantic as { reference: string }).reference);
  const refs = annotateReferences(existing, copied);
  return copied.flatMap(({ element, reference }, i): Command[] =>
    refs[i] && refs[i] !== reference
      ? [
          {
            type: "updateSemantic",
            id: element.id,
            semantic: { ...(element.semantic as object), reference: refs[i] },
          },
        ]
      : [],
  );
}
