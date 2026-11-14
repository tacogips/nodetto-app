import { connectScreenTransition } from "@nodetto/core";
// `nodetto-cli edit`: apply a batch of drawing operations through the editor's
// command layer, so validation, reference cascades and derived state are the
// same as when a person edits in the app.
//
// The batch is all-or-nothing. Before the atomic write the file is read again;
// if someone (typically the person in the desktop app) saved meanwhile, the
// batch is applied again to the new contents instead of overwriting them.

import {
  type ArrangeMode,
  type Box,
  CommandError,
  connectShape,
  Editor,
  findShape,
  isFractionalKey,
  newElementId,
  planArrangement,
  type ShapeCatalogueEntry,
  shapeCreation,
} from "@nodetto/core";
import { parseDocumentResult, serializeDocument } from "@nodetto/io";
import {
  type Element,
  getElementTypeDefinition,
  isKnownElementType,
  isPageKind,
  isPageMode,
  isPlainObject,
  type KeyOrder,
  PAGE_MODES,
  type Page,
  resolvePageQuery,
  validateDocument,
} from "@nodetto/ir";
import {
  type CommandIo,
  type CommandResult,
  fail,
  formatIssue,
  ok,
  parseArgs,
} from "./commands.ts";
import { helpFor } from "./help.ts";
import { resolveId } from "./ids.ts";

const EDIT_OPTIONS = new Set(["--ops", "--format", "--snapshot"]);
const EDIT_FLAGS = new Set(["--arrange", "--dry-run"]);
/** The file kept changing while the batch was being written. */
export const EXIT_CONTENDED = 4;
const MAX_ATTEMPTS = 3;
/** Default space between placed elements, in canvas units. */
const PLACE_GAP = 80;

type Json = unknown;
type JsonObject = Readonly<Record<string, Json>>;

interface Created {
  readonly ref?: string;
  readonly id: string;
  readonly type: string;
  readonly page: string;
}

export interface EditWarning {
  readonly operation: number;
  readonly op: string;
  readonly element: string;
  readonly type: string;
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

interface BatchResult {
  readonly warnings: readonly EditWarning[];
  readonly text: string;
  readonly created: readonly Created[];
  readonly counts: ReadonlyMap<
    string,
    { added: number; updated: number; removed: number }
  >;
  readonly operations: number;
}

class OperationError extends Error {
  constructor(
    readonly index: number,
    message: string,
  ) {
    super(message);
  }
}

/** Parse a JSON array of operations, or JSON Lines with one operation each. */
export function parseOperations(text: string): readonly JsonObject[] {
  const trimmed = text.trim();
  if (trimmed === "") throw new Error("No operations were given.");
  let values: Json[];
  if (trimmed.startsWith("[")) {
    const parsed: Json = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");
    values = parsed;
  } else {
    values = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .map((line, index) => {
        try {
          return JSON.parse(line) as Json;
        } catch (cause) {
          throw new Error(
            `Line ${index + 1} is not JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
          );
        }
      });
  }
  return values.map((value, index) => {
    if (!isPlainObject(value))
      throw new OperationError(index, "an operation must be a JSON object");
    return value;
  });
}

/** Objects merge key by key, arrays and scalars replace, null removes a key. */
export function deepMerge(base: Json, patch: Json): Json {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const result: Record<string, Json> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key];
    else result[key] = deepMerge(base[key], value);
  }
  return result;
}

/** Give list items that need an id (columns, indexes, attributes) a fresh one. */
function fillIds(value: Json, order: KeyOrder | undefined): Json {
  if (!isPlainObject(value) || !order) return value;
  const result: Record<string, Json> = { ...value };
  for (const [key, child] of Object.entries(order.children ?? {})) {
    const field = result[key];
    if (Array.isArray(field))
      result[key] = field.map((item) => {
        const filled = fillIds(item, child);
        return isPlainObject(filled) &&
          child.keys.includes("id") &&
          (typeof filled["id"] !== "string" || filled["id"] === "")
          ? { id: newElementId(), ...filled }
          : filled;
      });
    else if (isPlainObject(field)) result[key] = fillIds(field, child);
  }
  return result;
}

function text(value: Json, field: string, index: number): string {
  if (typeof value !== "string" || value === "")
    throw new OperationError(index, `"${field}" must be a non-empty string`);
  return value;
}

function number(value: Json, field: string, index: number): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new OperationError(index, `"${field}" must be a number`);
  return value;
}

function unknownMode(mode: Json): string {
  return `Unknown page mode "${String(mode)}". Choose ${PAGE_MODES.join(", ")}, or null to follow the page kind.`;
}

class Batch {
  readonly refs = new Map<string, string>();
  readonly created: Created[] = [];
  readonly touchedPages = new Set<string>();
  /** The element auto placement put last on each page, to line up with. */
  private readonly lastPlaced = new Map<string, string>();

  constructor(readonly editor: Editor) {}

  private elementIds(): string[] {
    return this.editor.store.listElements().map((element) => element.id);
  }

  element(query: Json, index: number): Element {
    const value = text(query, "id", index);
    const resolved = resolveId(value, this.elementIds(), this.refs);
    if (!resolved.ok) {
      const page = resolvePageQuery(
        this.editor.store.listPages(),
        value.startsWith("@")
          ? (this.refs.get(value.slice(1)) ?? value)
          : value,
      );
      throw new OperationError(
        index,
        page.ok
          ? `"${value}" is a page, not an element; use rename-page, move-page or delete-page for pages.`
          : resolved.message,
      );
    }
    const element = this.editor.store.get(resolved.id);
    if (!element) throw new OperationError(index, `No element ${resolved.id}.`);
    return element;
  }

  page(query: Json, index: number): Page {
    const pages = this.editor.store.listPages();
    if (query === undefined && pages.length === 1) return pages[0] as Page;
    const value = text(query, "page", index);
    const byRef = value.startsWith("@")
      ? this.refs.get(value.slice(1))
      : undefined;
    const resolved = resolvePageQuery(pages, byRef ?? value);
    if (resolved.ok) return resolved.page;
    throw new OperationError(index, resolved.message);
  }

  /**
   * Put a page before or after another page, or at an explicit fractional
   * order key. Returns false when the operation names no placement.
   */
  placePage(id: string, operation: JsonObject, index: number): boolean {
    const fields = (["before", "after", "order"] as const).filter(
      (field) => operation[field] !== undefined,
    );
    if (fields.length > 1)
      throw new OperationError(
        index,
        `use only one of "before", "after" and "order"`,
      );
    const field = fields[0];
    if (field === undefined) return false;
    if (field === "order") {
      const order = text(operation["order"], "order", index);
      if (!isFractionalKey(order))
        throw new OperationError(
          index,
          `"order" must be a base62 fractional key without a trailing zero (for example "a0" or "b1V").`,
        );
      const taken = this.editor.store
        .listPages()
        .find((page) => page.id !== id && page.order === order);
      if (taken)
        throw new OperationError(
          index,
          `order "${order}" is already used by page ${taken.id}; use "before" or "after" instead.`,
        );
      this.editor.apply([{ type: "updatePage", id, page: { order } }]);
      return true;
    }
    const anchor = this.page(operation[field], index);
    if (anchor.id === id)
      throw new OperationError(
        index,
        `a page cannot be placed ${field} itself.`,
      );
    const remaining = this.editor.store
      .listPages()
      .filter((page) => page.id !== id);
    const at = remaining.findIndex((page) => page.id === anchor.id);
    this.editor.reorderPageTo(id, field === "before" ? at : at + 1);
    return true;
  }

  /** Replace "@ref" strings and id prefixes in reference fields with ids. */
  private resolveReferences(type: string, semantic: Json, index: number): Json {
    const substitute = (value: Json): Json => {
      if (typeof value === "string" && value.startsWith("@")) {
        const id = this.refs.get(value.slice(1));
        if (id === undefined)
          throw new OperationError(index, `Unknown ref "${value}".`);
        return id;
      }
      if (Array.isArray(value)) return value.map(substitute);
      if (isPlainObject(value))
        return Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, substitute(item)]),
        );
      return value;
    };
    let resolved = substitute(semantic);
    if (type === "erd.relation" && isPlainObject(resolved)) {
      const end = (value: Json): Json => {
        if (!isPlainObject(value) || typeof value["table"] !== "string")
          return value;
        const table = this.element(value["table"], index);
        const columns = isPlainObject(table.semantic)
          ? table.semantic["columns"]
          : undefined;
        const column = value["column"];
        if (typeof column === "string" && Array.isArray(columns)) {
          const byId = columns.some(
            (item) => isPlainObject(item) && item["id"] === column,
          );
          const byName = columns.find(
            (item) => isPlainObject(item) && item["name"] === column,
          );
          if (
            !byId &&
            isPlainObject(byName) &&
            typeof byName["id"] === "string"
          )
            return { ...value, table: table.id, column: byName["id"] };
        }
        return { ...value, table: table.id };
      };
      resolved = {
        ...resolved,
        from: end(resolved["from"]),
        to: end(resolved["to"]),
      };
    } else if (isKnownElementType(type) && isPlainObject(resolved)) {
      const definition = getElementTypeDefinition(type);
      if (definition?.category === "edge") {
        const edge: Record<string, Json> = { ...resolved };
        for (const field of ["from", "to"] as const) {
          const value = edge[field];
          if (
            type === "edge.generic" &&
            edge[`${field}Point`] !== undefined &&
            value === ""
          )
            delete edge[field];
          else if (typeof value === "string")
            edge[field] = this.element(value, index).id;
        }
        resolved = edge;
      }
    }
    return resolved;
  }

  private boundsOf(id: string): Box | null {
    const element = this.editor.store.get(id);
    if (!element) return null;
    this.editor.setCurrentPage(element.page);
    return this.editor.getBounds(id, this.editor.createShapeContext(1));
  }

  /** Create one element; place it relative to another or beside the page content. */
  add(operation: JsonObject, index: number): string {
    if (operation["shape"] !== undefined)
      return this.addShape(operation, index);
    const type = text(operation["type"], "type", index);
    if (!isKnownElementType(type))
      throw new OperationError(
        index,
        `Unknown element type "${type}". Run "nodetto-cli types".`,
      );
    const page = this.page(operation["page"], index);
    const definition = getElementTypeDefinition(type);
    const visual = operation["visual"];
    if (visual !== undefined && !isPlainObject(visual))
      throw new OperationError(index, `"visual" must be an object`);
    const place = operation["place"];
    if (place !== undefined && !isPlainObject(place))
      throw new OperationError(index, `"place" must be an object`);
    const positioned =
      isPlainObject(visual) && ("x" in visual || "y" in visual);
    const autoPlace =
      definition?.category !== "edge" && !positioned && place === undefined;
    this.editor.setCurrentPage(page.id);
    const content = autoPlace ? this.editor.pageBounds(page.id) : null;
    // Given fields are merged over the type's defaults, so an agent states
    // only what it cares about (lists such as columns replace the default).
    const semantic =
      operation["semantic"] === undefined
        ? undefined
        : this.resolveReferences(
            type,
            fillIds(
              deepMerge(
                this.editor.registry.getOrFallback(type).defaultSemantic(),
                operation["semantic"],
              ),
              definition?.keyOrder,
            ),
            index,
          );
    const id = this.editor.createElement(type, {
      page: page.id,
      ...(typeof operation["id"] === "string" ? { id: operation["id"] } : {}),
      ...(semantic === undefined ? {} : { semantic }),
      ...(visual === undefined ? {} : { visual }),
    });
    if (isPlainObject(place)) this.placeRelative(id, place, index);
    else if (autoPlace && content) {
      // Continue the row: right of everything, centred on the previous
      // auto-placed element so connectors between them run straight.
      const previous = this.lastPlaced.get(page.id);
      const previousBox = previous ? this.boundsOf(previous) : null;
      const own = this.boundsOf(id);
      const y =
        previousBox && own
          ? previousBox.y + (previousBox.height - own.height) / 2
          : content.y;
      this.moveBoxTo(id, content.x + content.width + PLACE_GAP, y);
    }
    if (autoPlace) this.lastPlaced.set(page.id, id);
    const ref = operation["ref"];
    if (typeof ref === "string") {
      if (this.refs.has(ref))
        throw new OperationError(index, `ref "${ref}" is already used.`);
      this.refs.set(ref, id);
    }
    this.created.push({
      ...(typeof ref === "string" ? { ref } : {}),
      id,
      type,
      page: page.id,
    });
    this.touchedPages.add(page.id);
    return id;
  }

  private shape(operation: JsonObject, index: number): ShapeCatalogueEntry {
    const id = text(operation["shape"], "shape", index);
    const shape = findShape(id);
    if (!shape)
      throw new OperationError(
        index,
        `Unknown shape "${id}". Run "nodetto-cli shapes" for the shape IDs.`,
      );
    if (operation["type"] !== undefined)
      throw new OperationError(index, `use either "shape" or "type", not both`);
    return shape;
  }

  /**
   * Draw a palette shape by its shape ID: the tool's own defaults (a
   * flowchart decision is a labelled diamond, an iPhone artboard has the
   * device size), then the operation's semantic and visual, then `label`
   * in the shape's text field.
   */
  private addShape(operation: JsonObject, index: number): string {
    const shape = this.shape(operation, index);
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
        ? this.addParticipant(rest, semantic, index)
        : this.add(
            {
              ...rest,
              type: creation.type,
              ...(semantic === undefined ? {} : { semantic }),
              ...(visual === undefined ? {} : { visual }),
            },
            index,
          );
    if (label !== undefined) {
      const value = typeof label === "string" ? label : undefined;
      if (value === undefined)
        throw new OperationError(index, `"label" must be a string`);
      if (this.editor.editableField(id)) this.editor.setText(id, value);
      else {
        // Shapes the canvas names in the inspector (sequence participants,
        // pseudo-states) still take a label through their text field.
        const element = this.editor.store.get(id);
        const semantic = isPlainObject(element?.semantic)
          ? element.semantic
          : {};
        const field = ["name", "label", "text"].find(
          (key) => typeof semantic[key] === "string",
        );
        if (!field)
          throw new OperationError(
            index,
            `${shape.id} has no text to label; set its fields with "semantic".`,
          );
        this.editor.apply([
          {
            type: "updateSemantic",
            id,
            semantic: { ...semantic, [field]: value },
          },
        ]);
      }
    }
    return id;
  }

  /** Sequence participants take the next lifeline order on their page. */
  private addParticipant(
    operation: JsonObject,
    semantic: Json,
    index: number,
  ): string {
    const page = this.page(operation["page"], index);
    this.editor.setCurrentPage(page.id);
    const visual = isPlainObject(operation["visual"])
      ? operation["visual"]
      : {};
    const content = this.editor.pageBounds(page.id);
    const x =
      typeof visual["x"] === "number"
        ? visual["x"] + 80
        : content
          ? content.x + content.width + PLACE_GAP + 80
          : 80;
    const y =
      typeof visual["y"] === "number"
        ? visual["y"] + 28
        : (content?.y ?? 0) + 28;
    const kind = isPlainObject(semantic) ? semantic["kind"] : undefined;
    const id = this.editor.createSequenceParticipant(
      kind === "actor" || kind === "db" ? kind : "service",
      { x, y },
    );
    const created = this.editor.store.get(id);
    if (created && isPlainObject(semantic))
      this.editor.apply([
        {
          type: "updateSemantic",
          id,
          semantic: deepMerge(created.semantic, semantic),
        },
      ]);
    this.record(operation, index, id, "sequence.participant", page.id);
    return id;
  }

  private record(
    operation: JsonObject,
    index: number,
    id: string,
    type: string,
    page: string,
  ): void {
    const ref = operation["ref"];
    if (typeof ref === "string") {
      if (this.refs.has(ref))
        throw new OperationError(index, `ref "${ref}" is already used.`);
      this.refs.set(ref, id);
    }
    this.created.push({
      ...(typeof ref === "string" ? { ref } : {}),
      id,
      type,
      page,
    });
    this.touchedPages.add(page);
  }

  /** Move an element so that its bounding box starts at (x, y). */
  private moveBoxTo(id: string, x: number, y: number): void {
    const element = this.editor.store.get(id);
    const box = this.boundsOf(id);
    if (!element || !box) return;
    const vx = typeof element.visual.x === "number" ? element.visual.x : box.x;
    const vy = typeof element.visual.y === "number" ? element.visual.y : box.y;
    this.editor.moveElements([
      { id, x: Math.round(vx + x - box.x), y: Math.round(vy + y - box.y) },
    ]);
  }

  private placeRelative(id: string, place: JsonObject, index: number): void {
    const sides = ["rightOf", "leftOf", "below", "above"] as const;
    const side = sides.find((name) => place[name] !== undefined);
    if (!side)
      throw new OperationError(
        index,
        `"place" needs one of ${sides.join(", ")} with an element id or @ref`,
      );
    const anchor = this.element(place[side], index);
    const gap =
      place["gap"] === undefined
        ? PLACE_GAP
        : number(place["gap"], "place.gap", index);
    const target = this.boundsOf(anchor.id);
    const own = this.boundsOf(id);
    if (!target || !own)
      throw new OperationError(
        index,
        "Cannot place an element without bounds.",
      );
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
    this.moveBoxTo(id, position.x, position.y);
  }

  /**
   * Connect two elements the way the app's connect tool does (connectSmart):
   * ERD tables get a relation, UML classes an association, sequence
   * participants a message on the next timeline row (lifelines grow), BPMN
   * nodes a flow that obeys BPMN rules, anything else a generic edge.
   */
  connect(operation: JsonObject, index: number): string {
    const from = this.element(operation["from"], index);
    const to = this.element(operation["to"], index);
    if (from.page !== to.page)
      throw new OperationError(
        index,
        "connect needs two elements on the same page.",
      );
    const shape =
      operation["shape"] === undefined
        ? undefined
        : this.shape(operation, index);
    if (shape && !shape.connector)
      throw new OperationError(
        index,
        `${shape.id} is not a connector; use {"op":"add","shape":"${shape.id}"}.`,
      );
    if (typeof operation["type"] === "string")
      return this.add(
        {
          op: "add",
          page: from.page,
          type: operation["type"],
          semantic: deepMerge(
            { from: from.id, to: to.id },
            isPlainObject(operation["semantic"]) ? operation["semantic"] : {},
          ),
          ...(typeof operation["ref"] === "string"
            ? { ref: operation["ref"] }
            : {}),
        },
        index,
      );
    this.editor.setCurrentPage(from.page);
    const id = shape
      ? connectShape(this.editor, shape.id, from.id, to.id)
      : isPlainObject(operation["semantic"]) &&
          operation["semantic"]["prototype"] === true
        ? connectScreenTransition(this.editor, from.id, to.id)
        : this.editor.connectSmart(from.id, to.id);
    if (id === null)
      throw new OperationError(
        index,
        shape
          ? `${shape.label} (${shape.id}) cannot connect ${from.type} to ${to.type}; it joins ${shape.type} endpoints of its own notation.`
          : `Cannot connect ${from.type} to ${to.type} here (a rule of this diagram kind forbids it, or an element is locked).`,
      );
    const created = this.editor.store.get(id);
    if (!created)
      throw new OperationError(index, "The connector was not created.");
    let patch: Record<string, Json> = {};
    if (created.type === "erd.relation") {
      const column = (table: Element, query: Json, field: string) => {
        if (query === undefined) return {};
        const name = text(query, field, index);
        const columns = isPlainObject(table.semantic)
          ? table.semantic["columns"]
          : undefined;
        const match = Array.isArray(columns)
          ? columns.find(
              (item) =>
                isPlainObject(item) &&
                (item["id"] === name || item["name"] === name),
            )
          : undefined;
        if (!isPlainObject(match) || typeof match["id"] !== "string")
          throw new OperationError(
            index,
            `${field} "${name}" is not a column of that table.`,
          );
        return { column: match["id"] };
      };
      patch = {
        from: {
          table: from.id,
          ...column(from, operation["fromColumn"], "fromColumn"),
        },
        to: { table: to.id, ...column(to, operation["toColumn"], "toColumn") },
        cardinality:
          typeof operation["cardinality"] === "string"
            ? operation["cardinality"]
            : "*:1",
      };
    }
    const label = operation["label"];
    if (typeof label === "string")
      patch[
        created.type === "state.transition"
          ? "trigger"
          : created.type.startsWith("bpmn.")
            ? "name"
            : "label"
      ] = label;
    if (isPlainObject(operation["semantic"]))
      patch = deepMerge(patch, operation["semantic"]) as Record<string, Json>;
    if (Object.keys(patch).length)
      this.editor.apply([
        {
          type: "updateSemantic",
          id,
          semantic: deepMerge(created.semantic, patch),
        },
      ]);
    const ref = operation["ref"];
    if (typeof ref === "string") {
      if (this.refs.has(ref))
        throw new OperationError(index, `ref "${ref}" is already used.`);
      this.refs.set(ref, id);
    }
    this.created.push({
      ...(typeof ref === "string" ? { ref } : {}),
      id,
      type: created.type,
      page: from.page,
    });
    this.touchedPages.add(from.page);
    return id;
  }

  apply(operation: JsonObject, index: number): void {
    const op = operation["op"];
    switch (op) {
      case "add-page": {
        const kind = operation["kind"] ?? "freeform";
        if (typeof kind !== "string" || !isPageKind(kind))
          throw new OperationError(
            index,
            `Unknown page kind "${String(kind)}".`,
          );
        const mode = operation["mode"];
        if (mode !== undefined && !isPageMode(mode))
          throw new OperationError(index, unknownMode(mode));
        const id = this.editor.createPage({
          name: text(operation["name"], "name", index),
          kind,
          ...(mode === undefined ? {} : { mode }),
          ...(typeof operation["id"] === "string"
            ? { id: operation["id"] }
            : {}),
        });
        if (typeof operation["ref"] === "string")
          this.refs.set(operation["ref"], id);
        this.placePage(id, operation, index);
        this.touchedPages.add(id);
        return;
      }
      case "move-page": {
        const page = this.page(operation["id"], index);
        if (!this.placePage(page.id, operation, index))
          throw new OperationError(
            index,
            `move-page needs "before" or "after" (a page) or "order" (a fractional key)`,
          );
        return;
      }
      case "rename-page": {
        const page = this.page(operation["id"], index);
        this.editor.renamePage(page.id, text(operation["name"], "name", index));
        return;
      }
      case "set-page-mode": {
        const page = this.page(operation["id"], index);
        const mode = operation["mode"];
        if (mode !== null && !isPageMode(mode))
          throw new OperationError(index, unknownMode(mode));
        this.editor.setPageMode(page.id, mode);
        return;
      }
      case "delete-page": {
        const page = this.page(operation["id"], index);
        if (!this.editor.deletePage(page.id))
          throw new OperationError(index, "The last page cannot be deleted.");
        this.touchedPages.delete(page.id);
        return;
      }
      case "add": {
        this.add(operation, index);
        return;
      }
      case "connect": {
        this.connect(operation, index);
        return;
      }
      case "append":
      case "remove-item": {
        const element = this.element(operation["id"], index);
        const field = text(operation["field"], "field", index);
        const semantic = isPlainObject(element.semantic)
          ? element.semantic
          : {};
        const current = semantic[field];
        if (!Array.isArray(current))
          throw new OperationError(
            index,
            `${element.type} has no list field "${field}".`,
          );
        let next: Json[];
        if (op === "append") {
          const items = operation["items"];
          if (!Array.isArray(items) || !items.length)
            throw new OperationError(
              index,
              `"items" must be a non-empty array`,
            );
          next = [...current, ...items];
        } else {
          const item = text(operation["item"], "item", index);
          const position = current.findIndex(
            (entry) =>
              isPlainObject(entry) &&
              (entry["id"] === item || entry["name"] === item),
          );
          if (position < 0)
            throw new OperationError(
              index,
              `No item with id or name "${item}" in ${field}.`,
            );
          next = current.filter((_, at) => at !== position);
        }
        const definition = isKnownElementType(element.type)
          ? getElementTypeDefinition(element.type)
          : undefined;
        this.editor.apply([
          {
            type: "updateSemantic",
            id: element.id,
            semantic: fillIds(
              { ...semantic, [field]: next },
              definition?.keyOrder,
            ),
          },
        ]);
        this.touchedPages.add(element.page);
        return;
      }
      case "update": {
        const element = this.element(operation["id"], index);
        const definition = isKnownElementType(element.type)
          ? getElementTypeDefinition(element.type)
          : undefined;
        const commands = [];
        if (operation["semantic"] !== undefined) {
          const merged = this.resolveReferences(
            element.type,
            fillIds(
              deepMerge(element.semantic, operation["semantic"]),
              definition?.keyOrder,
            ),
            index,
          );
          commands.push({
            type: "updateSemantic" as const,
            id: element.id,
            semantic: merged,
          });
        }
        const visual = operation["visual"];
        if (visual !== undefined) {
          if (!isPlainObject(visual))
            throw new OperationError(index, `"visual" must be an object`);
          commands.push({
            type: "updateVisual" as const,
            id: element.id,
            visual,
          });
        }
        if (!commands.length)
          throw new OperationError(index, "update needs semantic or visual");
        this.editor.apply(commands);
        this.touchedPages.add(element.page);
        return;
      }
      case "move": {
        const element = this.element(operation["id"], index);
        this.editor.moveElements([
          {
            id: element.id,
            x: number(operation["x"], "x", index),
            y: number(operation["y"], "y", index),
          },
        ]);
        this.touchedPages.add(element.page);
        return;
      }
      case "delete": {
        const element = this.element(operation["id"], index);
        this.editor.deleteElements([element.id]);
        this.touchedPages.add(element.page);
        return;
      }
      default:
        throw new OperationError(
          index,
          `Unknown op "${String(op)}". Use add-page, move-page, rename-page, set-page-mode, delete-page, add, connect, update, append, remove-item, move or delete.`,
        );
    }
  }
}

/** Apply the batch to one version of the document text. */
export function applyBatch(
  documentText: string,
  operations: readonly JsonObject[],
  arrange: boolean,
): BatchResult {
  const parsed = parseDocumentResult(documentText);
  if (!parsed.ok)
    throw new Error(
      `The document is not a valid nodetto document:\n${parsed.issues
        .filter((issue) => issue.severity === "error")
        .map(formatIssue)
        .join("\n")}`,
    );
  const before = new Map(
    parsed.document.elements.map((element) => [element.id, element]),
  );
  const editor = new Editor({ document: parsed.document });
  const batch = new Batch(editor);
  const lastTouch = new Map<string, number>();
  let records = new Map(
    editor.store.listElements().map((element) => [element.id, element]),
  );
  operations.forEach((operation, index) => {
    try {
      batch.apply(operation, index);
      const next = new Map(
        editor.store.listElements().map((element) => [element.id, element]),
      );
      for (const [id, element] of next)
        if (records.get(id) !== element) lastTouch.set(id, index);
      records = next;
    } catch (cause) {
      if (cause instanceof OperationError) throw cause;
      if (cause instanceof CommandError) {
        const details = cause.issues
          .filter((issue) => issue.severity === "error")
          .map(
            (issue) => `${issue.path ? `${issue.path}: ` : ""}${issue.message}`,
          );
        throw new OperationError(
          index,
          details.length
            ? `invalid element:\n  ${details.join("\n  ")}\nRun "nodetto-cli types <type>" for the expected fields.`
            : cause.message,
        );
      }
      throw new OperationError(
        index,
        cause instanceof Error ? cause.message : String(cause),
      );
    }
  });
  if (arrange)
    for (const pageId of batch.touchedPages) {
      if (!editor.store.getPage(pageId)) continue;
      const { commands, placed } = planArrangement(
        editor.store,
        pageId,
        editor.createShapeContext(1),
        { mode: "tidy" as ArrangeMode },
      );
      if (commands.length) editor.apply(commands, { placed });
    }
  const snapshot = editor.getSnapshot();
  const validation = validateDocument(snapshot);
  const issues = validation.filter((issue) => issue.severity === "error");
  if (issues.length)
    throw new Error(
      `The result is not a valid document:\n${issues
        .map(
          (issue) => `  ${issue.path ? `${issue.path}: ` : ""}${issue.message}`,
        )
        .join("\n")}`,
    );
  const warningKey = (path: string, elements: readonly Element[]) => {
    const match = /^elements\[(\d+)\]\.(.+)$/.exec(path);
    const element = match && elements[Number(match[1])];
    return element && match
      ? {
          element,
          path: match[2] as string,
          key: JSON.stringify([element.id, match[2]]),
        }
      : undefined;
  };
  const baseline = new Set(
    parsed.issues
      .filter((issue) => issue.code === "semantic.unknownField")
      .map((issue) => warningKey(issue.path, parsed.document.elements)?.key),
  );
  const warnings: EditWarning[] = [];
  for (const issue of validation) {
    if (issue.code !== "semantic.unknownField") continue;
    const item = warningKey(issue.path, snapshot.elements);
    if (!item || baseline.has(item.key)) continue;
    const operation = lastTouch.get(item.element.id);
    if (operation === undefined) continue;
    warnings.push({
      operation,
      op: String(operations[operation]?.op),
      element: item.element.id,
      type: item.element.type,
      path: item.path,
      code: issue.code,
      message: issue.message,
    });
  }
  warnings.sort(
    (a, b) => a.operation - b.operation || a.path.localeCompare(b.path),
  );
  const counts = new Map<
    string,
    { added: number; updated: number; removed: number }
  >();
  const bump = (page: string, field: "added" | "updated" | "removed") => {
    const entry = counts.get(page) ?? { added: 0, updated: 0, removed: 0 };
    entry[field] += 1;
    counts.set(page, entry);
  };
  const after = new Map(
    snapshot.elements.map((element) => [element.id, element]),
  );
  for (const [id, element] of after) {
    const previous = before.get(id);
    if (!previous) bump(element.page, "added");
    else if (JSON.stringify(previous) !== JSON.stringify(element))
      bump(element.page, "updated");
  }
  for (const [id, element] of before)
    if (!after.has(id)) bump(element.page, "removed");
  return {
    text: serializeDocument(snapshot),
    created: batch.created,
    counts,
    operations: operations.length,
    warnings,
  };
}

export function editCommand(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const parsed = parseArgs(args, EDIT_OPTIONS, EDIT_FLAGS);
  if (typeof parsed === "string")
    return fail(`${parsed}\n\n${helpFor("edit")}`);
  if (parsed.positional.length !== 1)
    return fail(
      `edit expects exactly one document path.\n\n${helpFor("edit")}`,
    );
  const path = parsed.positional[0] as string;
  const format = parsed.options.get("--format") ?? "text";
  if (format !== "text" && format !== "json")
    return fail(`Unsupported format "${format}". Choose text or json.`);
  const source = parsed.options.get("--ops");
  if (source === undefined)
    return fail(`edit requires --ops <file.json|->.\n\n${helpFor("edit")}`);
  let operations: readonly JsonObject[];
  try {
    const opsText =
      source === "-" ? (io.readStdin?.() ?? "") : io.readText(source);
    operations = parseOperations(opsText);
  } catch (cause) {
    if (cause instanceof OperationError)
      return fail(`Operation ${cause.index}: ${cause.message}`);
    return fail(
      `Cannot read operations: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  return runOperations(io, path, operations, {
    arrange: parsed.flags.has("--arrange"),
    dryRun: parsed.flags.has("--dry-run"),
    format,
    ...(parsed.options.has("--snapshot")
      ? { snapshot: parsed.options.get("--snapshot") as string }
      : {}),
  });
}

export interface RunOptions {
  readonly arrange: boolean;
  readonly dryRun: boolean;
  readonly format: string;
  /** Also write the result here, as a baseline for a later diff. */
  readonly snapshot?: string;
}

/**
 * Apply operations to the file at `path` and report them; the batch is
 * re-applied when the file changes during the write.
 */
export function runOperations(
  io: CommandIo,
  path: string,
  operations: readonly JsonObject[],
  options: RunOptions,
): CommandResult {
  const { arrange, format } = options;
  if (format !== "text" && format !== "json")
    return fail(`Unsupported format "${format}". Choose text or json.`);
  let result: BatchResult | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let current: string;
    try {
      current = io.readText(path);
    } catch (cause) {
      return fail(
        `Cannot read ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
    try {
      result = applyBatch(current, operations, arrange);
    } catch (cause) {
      if (cause instanceof OperationError)
        return fail(
          `Operation ${cause.index} (${String(operations[cause.index]?.["op"])}): ${cause.message}\nNothing was written.`,
        );
      return fail(
        `${cause instanceof Error ? cause.message : String(cause)}\nNothing was written.`,
      );
    }
    if (options.dryRun) break;
    let latest: string;
    try {
      latest = io.readText(path);
    } catch {
      latest = current;
    }
    if (latest !== current) {
      result = undefined;
      continue;
    }
    try {
      io.writeText(path, result.text);
    } catch (cause) {
      return fail(
        `Cannot write ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
    const snapshot = options.snapshot;
    if (snapshot !== undefined)
      try {
        io.writeText(snapshot, result.text);
      } catch (cause) {
        return fail(
          `Wrote ${path}, but cannot write the snapshot ${snapshot}: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    break;
  }
  if (!result)
    return {
      exitCode: EXIT_CONTENDED,
      stdout: "",
      stderr: `${path} kept changing while the batch was applied (${MAX_ATTEMPTS} attempts); nothing was written. Retry later.\n`,
    };

  const dryRun = options.dryRun;
  if (format === "json")
    return ok(
      `${JSON.stringify(
        {
          written: !dryRun,
          operations: result.operations,
          created: result.created,
          pages: Object.fromEntries(result.counts),
          warnings: result.warnings,
        },
        null,
        2,
      )}\n`,
    );
  const lines = [
    `${dryRun ? "Would apply" : "Applied"} ${result.operations} operation(s) to ${path}.`,
    ...[...result.counts].map(
      ([page, count]) =>
        `  page ${page}: +${count.added} ~${count.updated} -${count.removed}`,
    ),
    ...result.created.map(
      (item) =>
        `  created ${item.ref ? `@${item.ref} = ` : ""}${item.id} (${item.type})`,
    ),
  ];
  lines.push(
    ...result.warnings.map(
      (warning) =>
        `  warning operation ${warning.operation} (${warning.op}): ${warning.element} (${warning.type}) ${warning.path}: ${warning.message} (${warning.code})`,
    ),
  );
  return ok(`${lines.join("\n")}\n`);
}
