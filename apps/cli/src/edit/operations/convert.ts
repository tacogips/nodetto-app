import { findShape, referencesOf, shapeCreation } from "@nodetto/core";
import {
  connectorEndpointIssues,
  erdEndpointColumnIds,
  getElementTypeDefinition,
  isKnownElementType,
  isPlainObject,
  type Element,
  type ErdEndpoint,
} from "@nodetto/ir";
import type { Batch } from "../batch.ts";
import { applyLabel, labelField } from "../label-field.ts";
import {
  deepMerge,
  fillIds,
  type JsonObject,
  OperationError,
  requireText,
} from "../operation-input.ts";
import { selectedWhere } from "../selectors.ts";

function category(element: Element): string | undefined {
  return getElementTypeDefinition(element.type)?.category;
}

function endpoint(edge: Element, end: "from" | "to"): string | undefined {
  if (!isPlainObject(edge.semantic)) return undefined;
  const value = edge.semantic[end];
  return edge.type === "erd.relation" && isPlainObject(value)
    ? typeof value["table"] === "string"
      ? value["table"]
      : undefined
    : typeof value === "string"
      ? value
      : undefined;
}

function checkBpmn(
  batch: Batch,
  edge: Element,
  index: number,
  overlay?: { id: string; type: string },
): void {
  if (!edge.type.startsWith("bpmn.")) return;
  const from = endpoint(edge, "from");
  const to = endpoint(edge, "to");
  if (!from || !to) return;
  const issue = batch.editor.bpmnFlowIssue(edge.type, from, to, overlay);
  if (issue)
    throw new OperationError(
      index,
      `Connector ${edge.id} (${edge.type}): ${issue}`,
    );
}

export function convertElements(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  let type =
    operation["type"] === undefined
      ? undefined
      : requireText(operation["type"], "type", index);
  let creation: ReturnType<typeof shapeCreation> = null;
  let shapeId: string | undefined;
  if (operation["shape"] !== undefined) {
    shapeId = requireText(operation["shape"], "shape", index);
    const shape = findShape(shapeId);
    if (!shape)
      throw new OperationError(
        index,
        `Unknown shape "${shapeId}". Run "nodetto-cli shapes" for the shape IDs.`,
      );
    if (shape.connector)
      throw new OperationError(index, "Connectors are not convertible.");
    creation = shapeCreation(shape.id);
    if (!creation)
      throw new OperationError(index, `${shapeId} cannot be placed.`);
    if (type !== undefined && type !== creation.type)
      throw new OperationError(
        index,
        `shape ${shapeId} creates ${creation.type}, not ${type}.`,
      );
    type = creation.type;
  }
  if (!type) throw new OperationError(index, "convert needs type or shape.");
  if (!isKnownElementType(type))
    throw new OperationError(
      index,
      `Unknown element type "${type}". Run "nodetto-cli types".`,
    );
  const definition = getElementTypeDefinition(type);
  if (!definition)
    throw new OperationError(
      index,
      `Unknown element type "${type}". Run "nodetto-cli types".`,
    );
  const targets = selectedWhere(batch, operation, index, "convert");
  const referrers = new Map<string, Element[]>();
  for (const element of batch.editor.store.listElements()) {
    for (const reference of referencesOf(element)) {
      const existing = referrers.get(reference.id) ?? [];
      if (!existing.some((item) => item.id === element.id))
        existing.push(element);
      referrers.set(reference.id, existing);
    }
  }
  for (const source of targets) {
    if (category(source) === "edge" || definition.category === "edge")
      throw new OperationError(index, "Connectors are not convertible.");
    if (
      ["frame", "group"].includes(source.type) ||
      ["frame", "group"].includes(type)
    )
      throw new OperationError(
        index,
        "Containers are not convertible, because membership would change.",
      );
    if (batch.editor.createShapeContext(1).isLocked?.(source.id))
      throw new OperationError(
        index,
        `Element ${source.id} is locked; unlock it first with updateVisual locked:false.`,
      );
    const references = (referrers.get(source.id) ?? []).filter(
      (item) => item.page === source.page,
    );
    const edges = references
      .filter((item) => category(item) === "edge")
      .sort((a, b) => a.id.localeCompare(b.id));
    if (source.type !== type) {
      for (const dependent of references) {
        if (
          category(dependent) !== "edge" &&
          dependent.type !== "frame" &&
          dependent.type !== "group"
        )
          throw new OperationError(
            index,
            `Cannot convert ${source.id}: dependent ${dependent.id} (${dependent.type}) references it.`,
          );
      }
      for (const edge of edges) {
        const issue = connectorEndpointIssues(
          edge.type,
          edge.semantic,
          edge.page,
          (id) =>
            id === source.id
              ? { type, page: source.page }
              : batch.editor.store.get(id),
        )[0];
        if (issue)
          throw new OperationError(
            index,
            `Connector ${edge.id} (${edge.type}): ${issue.message}`,
          );
        checkBpmn(batch, edge, index, { id: source.id, type });
      }
    }
    const box = batch.boundsOf(source.id);
    if (!box)
      throw new OperationError(
        index,
        `Cannot convert ${source.id}: element has no resolved bounds.`,
      );
    const sourceField = labelField(batch.editor, source);
    const sourceSemantic = isPlainObject(source.semantic)
      ? source.semantic
      : {};
    const sourceText =
      "field" in sourceField ? sourceSemantic[sourceField.field] : undefined;
    let semantic: unknown = batch.editor.registry
      .getOrFallback(type)
      .defaultSemantic();
    const dropped: string[] = [];
    for (const [key, value] of Object.entries(sourceSemantic)) {
      const candidate = {
        ...(isPlainObject(semantic) ? semantic : {}),
        [key]: value,
      };
      const valid =
        source.type === type ||
        (definition.keyOrder.keys.includes(key) &&
          !definition
            .validateSemantic(candidate, "semantic")
            .some(
              (issue) =>
                issue.severity === "error" &&
                (issue.path === `semantic.${key}` ||
                  issue.path.startsWith(`semantic.${key}.`) ||
                  issue.path.startsWith(`semantic.${key}[`)),
            ));
      if (valid) semantic = candidate;
      else if (
        !(
          "field" in sourceField &&
          sourceField.field === key &&
          typeof sourceText === "string" &&
          sourceText !== ""
        )
      )
        dropped.push(`semantic.${key}`);
    }
    if (
      type === "sequence.participant" &&
      source.type !== type &&
      !(
        isPlainObject(operation["semantic"]) && "order" in operation["semantic"]
      )
    )
      semantic = deepMerge(semantic, {
        order: batch.editor.nextParticipantOrderOn(source.page),
      });
    semantic = deepMerge(semantic, creation?.semantic ?? {});
    if (operation["semantic"] !== undefined) {
      if (!isPlainObject(operation["semantic"]))
        throw new OperationError(index, '"semantic" must be an object');
      semantic = deepMerge(semantic, operation["semantic"]);
    }
    semantic = batch.resolveReferences(
      type,
      fillIds(semantic, definition.keyOrder),
      index,
      source.page,
    );
    const visual =
      source.type === type
        ? source.visual
        : {
            ...source.visual,
            x: source.visual.x ?? box.x,
            y: source.visual.y ?? box.y,
            width: source.visual.width ?? box.width,
            height: source.visual.height ?? box.height,
          };
    batch.editor.apply([
      {
        type: "convertElement",
        id: source.id,
        elementType: type,
        semantic,
        visual,
      },
    ]);
    for (const edge of edges) checkBpmn(batch, edge, index);
    const converted = batch.editor.store.get(source.id);
    if (!converted) throw new OperationError(index, `No element ${source.id}.`);
    const targetField = labelField(batch.editor, converted);
    const mapped: { from: string; to: string }[] = [];
    if (operation["label"] !== undefined)
      applyLabel(batch, source.id, operation["label"], index);
    else if (
      typeof sourceText === "string" &&
      sourceText !== "" &&
      "field" in sourceField
    ) {
      if ("error" in targetField) dropped.push(`semantic.${sourceField.field}`);
      else if (
        !(
          isPlainObject(operation["semantic"]) &&
          targetField.field in operation["semantic"]
        )
      ) {
        applyLabel(batch, source.id, sourceText, index);
        mapped.push({
          from: `semantic.${sourceField.field}`,
          to: `semantic.${targetField.field}`,
        });
      }
    }
    const after = batch.boundsOf(source.id);
    if (
      !after ||
      box.x !== after.x ||
      box.y !== after.y ||
      box.width !== after.width ||
      box.height !== after.height
    )
      throw new OperationError(
        index,
        `Cannot convert ${source.id} to ${type}: it would resize from ${box.width}x${box.height} to ${after ? `${after.width}x${after.height}` : "unknown"}; resize it first with update.`,
      );
    const connectors = edges.map((edge) => {
      const keptPorts: string[] = [];
      if (type === "sequence.participant" && isPlainObject(edge.semantic))
        for (const end of ["from", "to"] as const) {
          const port = edge.semantic[`${end}Port`];
          if (endpoint(edge, end) === source.id && typeof port === "string")
            keptPorts.push(port);
        }
      return {
        id: edge.id,
        type: edge.type,
        ...(keptPorts.length ? { keptPorts } : {}),
      };
    });
    batch.converted.push({
      operation: index,
      id: source.id,
      fromType: source.type,
      toType: type,
      ...(shapeId ? { shape: shapeId } : {}),
      mapped,
      dropped,
      connectors,
    });
    for (const path of dropped)
      batch.convertWarnings.push({
        operation: index,
        op: "convert",
        element: source.id,
        type,
        path,
        code: "convert.fieldDropped",
        message: `Cannot carry ${path} to ${type}.`,
      });
    batch.touchedPages.add(source.page);
  }
}

export function reconnectConnectors(
  batch: Batch,
  operation: JsonObject,
  index: number,
  deleted: readonly Element[],
): void {
  if (!deleted.length) return;
  const page = deleted[0]?.page;
  if (!page || deleted.some((element) => element.page !== page))
    throw new OperationError(
      index,
      "Deleted elements must be on the same page to reconnect.",
    );
  const target = batch.element(operation["reconnectTo"], index, page);
  if (
    target.page !== page ||
    category(target) === "edge" ||
    deleted.some((element) => element.id === target.id)
  )
    throw new OperationError(
      index,
      "reconnectTo must name a different non-connector element on the same page.",
    );
  const locked = batch.editor.createShapeContext(1).isLocked;
  for (const element of deleted)
    if (locked?.(element.id))
      throw new OperationError(
        index,
        `Element ${element.id} is locked; unlock it first.`,
      );
  const deletedById = new Map(deleted.map((element) => [element.id, element]));
  const moved = new Map(deleted.map((element) => [element.id, [] as string[]]));
  const edges = [...batch.editor.store.getPageElements(page)]
    .filter((element) => category(element) === "edge")
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const edge of edges) {
    if (!isPlainObject(edge.semantic)) continue;
    const semantic: Record<string, unknown> = { ...edge.semantic };
    let changed = false;
    for (const end of ["from", "to"] as const) {
      const oldId = endpoint(edge, end);
      const old = oldId ? deletedById.get(oldId) : undefined;
      if (!old) continue;
      changed = true;
      const connectors = moved.get(old.id);
      if (connectors && !connectors.includes(edge.id)) connectors.push(edge.id);
      if (edge.type === "erd.relation") {
        const raw = semantic[end];
        if (!isPlainObject(raw)) continue;
        const oldColumns =
          isPlainObject(old.semantic) && Array.isArray(old.semantic["columns"])
            ? old.semantic["columns"]
            : [];
        const newColumns =
          isPlainObject(target.semantic) &&
          Array.isArray(target.semantic["columns"])
            ? target.semantic["columns"]
            : [];
        const ids = erdEndpointColumnIds(raw as unknown as ErdEndpoint).map(
          (id) => {
            const column = oldColumns.find(
              (item) => isPlainObject(item) && item["id"] === id,
            );
            const name = isPlainObject(column) ? column["name"] : undefined;
            const match = newColumns.find(
              (item) =>
                isPlainObject(item) &&
                item["name"] === name &&
                typeof item["id"] === "string",
            );
            if (!isPlainObject(match) || typeof match["id"] !== "string")
              throw new OperationError(
                index,
                `Connector ${edge.id}: target ${target.id} lacks column ${String(name ?? id)}.`,
              );
            return match["id"];
          },
        );
        semantic[end] = {
          ...raw,
          table: target.id,
          ...(Array.isArray(raw["columns"]) ? { columns: ids } : {}),
          ...(typeof raw["column"] === "string" ? { column: ids[0] } : {}),
        };
      } else semantic[end] = target.id;
    }
    if (!changed) continue;
    if (locked?.(edge.id))
      throw new OperationError(
        index,
        `Connector ${edge.id} is locked; unlock it first.`,
      );
    const updated = { ...edge, semantic };
    if (
      endpoint(updated, "from") === endpoint(updated, "to") &&
      !["state.node", "erd.table"].includes(target.type)
    )
      throw new OperationError(
        index,
        `Connector ${edge.id} cannot form a self-loop on ${target.type}.`,
      );
    const issue = connectorEndpointIssues(edge.type, semantic, page, (id) =>
      batch.editor.store.get(id),
    )[0];
    if (issue)
      throw new OperationError(
        index,
        `Connector ${edge.id} (${edge.type}): ${issue.message}`,
      );
    checkBpmn(batch, updated, index);
    batch.editor.apply([{ type: "updateSemantic", id: edge.id, semantic }]);
  }
  for (const item of deleted)
    batch.reconnected.push({
      operation: index,
      deleted: item.id,
      to: target.id,
      connectors: moved.get(item.id) ?? [],
    });
}

export function verifyReconnected(
  batch: Batch,
  index: number,
  deleted: readonly Element[],
): void {
  const selected = new Set(deleted.map((element) => element.id));
  for (const report of batch.reconnected) {
    if (report.operation !== index) continue;
    if (!batch.editor.store.has(report.to))
      throw new OperationError(
        index,
        `reconnectTo target ${report.to} is removed along with ${report.deleted} because it depends on it.`,
      );
    for (const id of report.connectors)
      if (!selected.has(id) && !batch.editor.store.has(id))
        throw new OperationError(
          index,
          `Deleting ${report.deleted} would remove connector ${id}.`,
        );
  }
}
