import {
  type Box,
  type Editor,
  findShape,
  type ShapeCatalogueEntry,
  type TextReplacement,
} from "@nodetto/core";
import {
  type Element,
  getElementTypeDefinition,
  isKnownElementType,
  isPlainObject,
  type Page,
  resolvePageQuery,
} from "@nodetto/ir";
import { resolveElementReference } from "./selectors.ts";
import { orderElements, orderOpHint } from "./operations/order.ts";
import { selectElement } from "./operations/select.ts";
import {
  OperationError,
  requireText,
  type Json,
  type JsonObject,
} from "./operation-input.ts";
import type {
  ConvertReport,
  Created,
  EditWarning,
  MatchReport,
  ReconnectReport,
} from "./types.ts";
import { checkOperationFields } from "./operation-fields.ts";
import {
  addPage,
  movePage,
  renamePage,
  setPageMode,
  setPageRouting,
  deletePage,
} from "./operations/pages.ts";
import { setCells } from "./operations/table.ts";
import {
  layoutOperation,
  alignOperation,
  distributeOperation,
  snapOperation,
} from "./operations/layout.ts";
import { addElement } from "./operations/add.ts";
import { connectElements } from "./operations/connect.ts";
import { convertElements } from "./operations/convert.ts";
import {
  editListField,
  updateElement,
  moveElement,
  scaleElements,
  replaceTextIn,
  deleteElement,
} from "./operations/elements.ts";
import { groupElements, ungroupElement } from "./operations/groups.ts";

export class Batch {
  readonly matches: MatchReport[] = [];
  readonly refs = new Map<string, string>();
  readonly created: Created[] = [];
  readonly touchedPages = new Set<string>();
  readonly replaced: TextReplacement[] = [];
  readonly converted: ConvertReport[] = [];
  readonly reconnected: ReconnectReport[] = [];
  readonly convertWarnings: EditWarning[] = [];
  /** The element auto placement put last on each page, to line up with. */
  readonly lastPlaced = new Map<string, string>();
  private orderedIdsCache: readonly string[] | undefined;
  private readonly orderedPageCache = new Map<string, readonly string[]>();
  private readonly indexedPages = new Map<string, string>();
  private readonly unsubscribe: () => void;

  constructor(readonly editor: Editor) {
    this.unsubscribe = editor.store.subscribe((diff) => {
      if (
        diff.added.length ||
        diff.removed.length ||
        diff.pagesChanged ||
        diff.updated.some(
          (id) =>
            this.indexedPages.has(id) &&
            this.indexedPages.get(id) !== editor.store.get(id)?.page,
        )
      ) {
        this.orderedIdsCache = undefined;
        this.orderedPageCache.clear();
        this.indexedPages.clear();
      }
    });
  }

  dispose(): void {
    this.unsubscribe();
  }

  orderedIds(page?: string): readonly string[] {
    if (!this.orderedIdsCache) {
      const ranks = new Map(
        this.editor.store.listPages().map((p, i) => [p.id, i]),
      );
      const elements = [...this.editor.store.listElements()];
      elements.sort(
        (a, b) =>
          (ranks.get(a.page) ?? 0) - (ranks.get(b.page) ?? 0) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      );
      for (const element of elements)
        this.indexedPages.set(element.id, element.page);
      this.orderedIdsCache = elements.map((element) => element.id);
    }
    if (page === undefined) return this.orderedIdsCache;
    let ids = this.orderedPageCache.get(page);
    if (!ids) {
      ids = this.orderedIdsCache.filter(
        (id) => this.indexedPages.get(id) === page,
      );
      this.orderedPageCache.set(page, ids);
    }
    return ids;
  }

  element(query: Json, index: number, scopePage?: string): Element {
    return resolveElementReference(
      this,
      requireText(query, "id", index),
      index,
      scopePage,
    );
  }

  page(query: Json, index: number): Page {
    const pages = this.editor.store.listPages();
    if (query === undefined && pages.length === 1) return pages[0] as Page;
    const value = requireText(query, "page", index);
    const byRef = value.startsWith("@")
      ? this.refs.get(value.slice(1))
      : undefined;
    const resolved = resolvePageQuery(pages, byRef ?? value);
    if (resolved.ok) return resolved.page;
    throw new OperationError(index, resolved.message);
  }

  /** Replace "@ref" strings and id prefixes in reference fields with ids. */
  resolveReferences(
    type: string,
    semantic: Json,
    index: number,
    scopePage?: string,
  ): Json {
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
    if (isKnownElementType(type) && isPlainObject(resolved)) {
      const definition = getElementTypeDefinition(type);
      for (const reference of definition?.references(resolved) ?? []) {
        if (
          !reference.id.startsWith("name:") ||
          this.editor.store.get(reference.id)
        )
          continue;
        const id = resolveElementReference(
          this,
          reference.id,
          index,
          scopePage,
        ).id;
        const path = reference.field.replace(/\[(\d+)\]/g, ".$1").split(".");
        let target: unknown = resolved;
        for (const part of path.slice(0, -1)) {
          if (typeof target !== "object" || target === null) break;
          target = (target as Record<string, unknown>)[part];
        }
        const last = path[path.length - 1];
        if (typeof target === "object" && target !== null && last !== undefined)
          (target as Record<string, unknown>)[last] = id;
      }
    }
    if (type === "erd.relation" && isPlainObject(resolved)) {
      const end = (value: Json): Json => {
        if (!isPlainObject(value) || typeof value["table"] !== "string")
          return value;
        const table = this.element(value["table"], index, scopePage);
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
            edge[field] = this.element(value, index, scopePage).id;
        }
        resolved = edge;
      }
    }
    return resolved;
  }

  boundsOf(id: string): Box | null {
    const element = this.editor.store.get(id);
    if (!element) return null;
    this.editor.setCurrentPage(element.page);
    return this.editor.getBounds(id, this.editor.createShapeContext(1));
  }

  /**
   * The elements an operation targets: "ids", or every element on "page".
   * Without either, the single page; `wholeDocument` widens that to every
   * page.
   */
  targets(
    operation: JsonObject,
    index: number,
    wholeDocument: boolean,
  ): Element[] {
    const ids = operation["ids"];
    if (ids !== undefined) {
      if (operation["page"] !== undefined)
        throw new OperationError(index, `use either "ids" or "page"`);
      if (!Array.isArray(ids) || !ids.length)
        throw new OperationError(index, `"ids" must be a non-empty array`);
      return ids.map((id) => this.element(id, index));
    }
    if (operation["page"] === undefined && wholeDocument)
      return [...this.editor.store.listElements()];
    const page = this.page(operation["page"], index);
    return [...this.editor.store.getPageElements(page.id)];
  }

  shape(operation: JsonObject, index: number): ShapeCatalogueEntry {
    const id = requireText(operation["shape"], "shape", index);
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

  record(
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
  moveBoxTo(id: string, x: number, y: number): void {
    const element = this.editor.store.get(id);
    const box = this.boundsOf(id);
    if (!element || !box) return;
    const vx = typeof element.visual.x === "number" ? element.visual.x : box.x;
    const vy = typeof element.visual.y === "number" ? element.visual.y : box.y;
    this.editor.moveElements([
      { id, x: Math.round(vx + x - box.x), y: Math.round(vy + y - box.y) },
    ]);
  }

  apply(operation: JsonObject, index: number): void {
    const op = operation["op"];
    checkOperationFields(operation, index);
    switch (op) {
      case "add-page":
        addPage(this, operation, index);
        return;
      case "move-page":
        movePage(this, operation, index);
        return;
      case "rename-page":
        renamePage(this, operation, index);
        return;
      case "set-page-mode":
        setPageMode(this, operation, index);
        return;
      case "set-page-routing":
        setPageRouting(this, operation, index);
        return;
      case "delete-page":
        deletePage(this, operation, index);
        return;
      case "layout":
        layoutOperation(this, operation, index);
        return;
      case "align":
        alignOperation(this, operation, index);
        return;
      case "distribute":
        distributeOperation(this, operation, index);
        return;
      case "snap":
        snapOperation(this, operation, index);
        return;
      case "add":
        addElement(this, operation, index);
        return;
      case "set-cells":
        setCells(this, operation, index);
        return;
      case "connect":
        connectElements(this, operation, index);
        return;
      case "convert":
        convertElements(this, operation, index);
        return;
      case "append":
      case "remove-item":
        editListField(this, operation, index, op);
        return;
      case "update":
        updateElement(this, operation, index);
        return;
      case "move":
        moveElement(this, operation, index);
        return;
      case "scale":
        scaleElements(this, operation, index);
        return;
      case "replace-text":
        replaceTextIn(this, operation, index);
        return;
      case "group":
        groupElements(this, operation, index);
        return;
      case "ungroup":
        ungroupElement(this, operation, index);
        return;
      case "delete":
        deleteElement(this, operation, index);
        return;
      case "order":
        orderElements(this, operation, index);
        return;
      case "select":
        selectElement(this, operation, index);
        return;
      default:
        throw new OperationError(
          index,
          `Unknown op "${String(op)}". Use add-page, move-page, rename-page, set-page-mode, set-page-routing, delete-page, add, set-cells, connect, convert, update, append, remove-item, move, delete, select, scale, replace-text, group, ungroup or order.${orderOpHint(op) ?? ""}`,
        );
    }
  }
}
