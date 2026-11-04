import { shapeCreation } from "@nodetto/core";
import {
  getElementTypeDefinition,
  isKnownElementType,
  isPlainObject,
} from "@nodetto/ir";
import type { Batch } from "../batch.ts";
import { applyLabel } from "../label-field.ts";
import {
  deepMerge,
  fillIds,
  type Json,
  type JsonObject,
  OperationError,
  requireNumber,
  requireText,
} from "../operation-input.ts";

const PLACE_GAP = 80;

/** Create one element; place it relative to another or beside the page content. */
export function addElement(
  batch: Batch,
  operation: JsonObject,
  index: number,
): string {
  if (operation["shape"] !== undefined)
    return addShape(batch, operation, index);
  const type = requireText(operation["type"], "type", index);
  if (!isKnownElementType(type))
    throw new OperationError(
      index,
      `Unknown element type "${type}". Run "nodetto-cli types".`,
    );
  const page = batch.page(operation["page"], index);
  const definition = getElementTypeDefinition(type);
  const visual = operation["visual"];
  if (visual !== undefined && !isPlainObject(visual))
    throw new OperationError(index, `"visual" must be an object`);
  const place = operation["place"];
  if (place !== undefined && !isPlainObject(place))
    throw new OperationError(index, `"place" must be an object`);
  const positioned = isPlainObject(visual) && ("x" in visual || "y" in visual);
  const autoPlace =
    definition?.category !== "edge" && !positioned && place === undefined;
  batch.editor.setCurrentPage(page.id);
  const content = autoPlace ? batch.editor.pageBounds(page.id) : null;
  // Given fields are merged over the type's defaults, so an agent states
  // only what it cares about (lists such as columns replace the default).
  const semantic =
    operation["semantic"] === undefined
      ? undefined
      : batch.resolveReferences(
          type,
          fillIds(
            deepMerge(
              batch.editor.registry.getOrFallback(type).defaultSemantic(),
              operation["semantic"],
            ),
            definition?.keyOrder,
          ),
          index,
        );
  const id = batch.editor.createElement(type, {
    page: page.id,
    ...(typeof operation["id"] === "string" ? { id: operation["id"] } : {}),
    ...(semantic === undefined ? {} : { semantic }),
    ...(visual === undefined ? {} : { visual }),
  });
  if (operation["label"] !== undefined)
    applyLabel(batch, id, operation["label"], index);
  if (isPlainObject(place)) placeRelative(batch, id, place, index);
  else if (autoPlace && content) {
    // Continue the row: right of everything, centred on the previous
    // auto-placed element so connectors between them run straight.
    const previous = batch.lastPlaced.get(page.id);
    const previousBox = previous ? batch.boundsOf(previous) : null;
    const own = batch.boundsOf(id);
    const y =
      previousBox && own
        ? previousBox.y + (previousBox.height - own.height) / 2
        : content.y;
    batch.moveBoxTo(id, content.x + content.width + PLACE_GAP, y);
  }
  if (autoPlace) batch.lastPlaced.set(page.id, id);
  batch.record(operation, index, id, type, page.id);
  return id;
}

/**
 * Draw a palette shape by its shape ID: the tool's own defaults (a
 * flowchart decision is a labelled diamond, an iPhone artboard has the
 * device size), then the operation's semantic and visual, then `label`
 * in the shape's text field.
 */
function addShape(batch: Batch, operation: JsonObject, index: number): string {
  const shape = batch.shape(operation, index);
  if (shape.connector)
    throw new OperationError(
      index,
      `${shape.id} is a connector; use {"op":"connect","shape":"${shape.id}","from":...,"to":...}.`,
    );
  const creation = shapeCreation(shape.id);
  if (!creation)
    throw new OperationError(index, `${shape.id} cannot be placed.`);
  const { shape: _shape, label, ...rest } = operation;
  const semantic =
    creation.semantic === undefined && operation["semantic"] === undefined
      ? undefined
      : deepMerge(creation.semantic ?? {}, operation["semantic"] ?? {});
  const visual = isPlainObject(operation["visual"])
    ? { ...(creation.visual ?? {}), ...operation["visual"] }
    : (operation["visual"] ?? creation.visual);
  const id =
    creation.type === "sequence.participant"
      ? addParticipant(batch, rest, semantic, index)
      : addElement(
          batch,
          {
            ...rest,
            type: creation.type,
            ...(semantic === undefined ? {} : { semantic }),
            ...(visual === undefined ? {} : { visual }),
          },
          index,
        );
  if (label !== undefined) applyLabel(batch, id, label, index);
  return id;
}

/** Sequence participants take the next lifeline order on their page. */
function addParticipant(
  batch: Batch,
  operation: JsonObject,
  semantic: Json,
  index: number,
): string {
  const page = batch.page(operation["page"], index);
  batch.editor.setCurrentPage(page.id);
  const visual = isPlainObject(operation["visual"]) ? operation["visual"] : {};
  const content = batch.editor.pageBounds(page.id);
  const x =
    typeof visual["x"] === "number"
      ? visual["x"] + 80
      : content
        ? content.x + content.width + PLACE_GAP + 80
        : 80;
  const y =
    typeof visual["y"] === "number" ? visual["y"] + 28 : (content?.y ?? 0) + 28;
  const kind = isPlainObject(semantic) ? semantic["kind"] : undefined;
  const id = batch.editor.createSequenceParticipant(
    kind === "actor" || kind === "db" ? kind : "service",
    { x, y },
  );
  const created = batch.editor.store.get(id);
  if (created && isPlainObject(semantic))
    batch.editor.apply([
      {
        type: "updateSemantic",
        id,
        semantic: deepMerge(created.semantic, semantic),
      },
    ]);
  batch.record(operation, index, id, "sequence.participant", page.id);
  return id;
}

function placeRelative(
  batch: Batch,
  id: string,
  place: JsonObject,
  index: number,
): void {
  const sides = ["rightOf", "leftOf", "below", "above"] as const;
  const side = sides.find((name) => place[name] !== undefined);
  if (!side)
    throw new OperationError(
      index,
      `"place" needs one of ${sides.join(", ")} with an element id or @ref`,
    );
  const anchor = batch.element(place[side], index);
  const gap =
    place["gap"] === undefined
      ? PLACE_GAP
      : requireNumber(place["gap"], "place.gap", index);
  const target = batch.boundsOf(anchor.id);
  const own = batch.boundsOf(id);
  if (!target || !own)
    throw new OperationError(index, "Cannot place an element without bounds.");
  const centered = place["align"] === "center";
  const alignX = centered
    ? target.x + (target.width - own.width) / 2
    : target.x;
  const alignY = centered
    ? target.y + (target.height - own.height) / 2
    : target.y;
  const position =
    side === "rightOf"
      ? { x: target.x + target.width + gap, y: alignY }
      : side === "leftOf"
        ? { x: target.x - gap - own.width, y: alignY }
        : side === "below"
          ? { x: alignX, y: target.y + target.height + gap }
          : { x: alignX, y: target.y - gap - own.height };
  batch.moveBoxTo(id, position.x, position.y);
}
