import {
  type Element,
  type ElementId,
  type ErdEndpoint,
  type ErdRelationSemantic,
  type ErdTableSemantic,
  erdEndpointColumnIds,
} from "@nodetto/ir";

/** Authoring warning only: table-level FK drafts remain valid document elements. */
export function erdForeignKeyWarning(
  element: Element,
  resolve: (id: ElementId) => Element | undefined,
): string | null {
  if (element.type !== "erd.relation") return null;
  const semantic = element.semantic as ErdRelationSemantic;
  if (semantic.logical === true) return null;
  const from = erdEndpointColumnIds(semantic.from);
  const to = erdEndpointColumnIds(semantic.to);
  if (from.length === 0 || to.length === 0)
    return "Foreign key columns are not assigned. Assign source and target columns.";
  if (from.length !== to.length)
    return "Foreign key column mapping is incomplete. Each source column needs a target column.";
  for (const end of ["from", "to"] as const) {
    const table = resolve(semantic[end].table);
    if (table?.type !== "erd.table")
      return "Foreign key references a missing table.";
    const columns = erdEndpointColumnIds(semantic[end]);
    const available = new Set(
      (table.semantic as ErdTableSemantic).columns.map((column) => column.id),
    );
    if (columns.some((id) => !available.has(id)))
      return "Foreign key references a missing column. Reassign source and target columns.";
    if (new Set(columns).size !== columns.length)
      return "Foreign key column mapping contains duplicate columns.";
  }
  return null;
}

/** Returns transient view state; the result is never written to the document. */
export function erdRelationHighlightedColumns(
  selection: Iterable<ElementId>,
  resolve: (id: ElementId) => Element | undefined,
): ReadonlyMap<ElementId, ReadonlySet<string>> {
  const highlighted = new Map<ElementId, Set<string>>();

  for (const id of selection) {
    const relation = resolve(id);
    if (relation?.type !== "erd.relation") continue;
    const semantic: unknown = relation.semantic;
    if (semantic === null || typeof semantic !== "object") continue;

    for (const endName of ["from", "to"] as const) {
      const end = (semantic as Record<string, unknown>)[endName];
      if (end === null || typeof end !== "object") continue;
      const endpoint = end as Record<string, unknown>;
      if (typeof endpoint.table !== "string") continue;
      if (endpoint.column !== undefined && typeof endpoint.column !== "string")
        continue;
      if (
        endpoint.columns !== undefined &&
        (!Array.isArray(endpoint.columns) ||
          !endpoint.columns.every((column) => typeof column === "string"))
      )
        continue;

      const tableId = endpoint.table;
      const table = resolve(tableId);
      if (table?.type !== "erd.table") continue;
      const tableSemantic: unknown = table.semantic;
      if (tableSemantic === null || typeof tableSemantic !== "object") continue;
      const columns = (tableSemantic as Record<string, unknown>).columns;
      if (!Array.isArray(columns)) continue;
      const currentIds = new Set<string>();
      for (const column of columns) {
        if (column !== null && typeof column === "object") {
          const columnId = (column as Record<string, unknown>).id;
          if (typeof columnId === "string") currentIds.add(columnId);
        }
      }

      const existingIds = erdEndpointColumnIds(
        endpoint as unknown as ErdEndpoint,
      ).filter((columnId) => currentIds.has(columnId));
      if (existingIds.length === 0) continue;

      let tableHighlights = highlighted.get(tableId);
      if (!tableHighlights) {
        tableHighlights = new Set<string>();
        highlighted.set(tableId, tableHighlights);
      }
      for (const columnId of existingIds) tableHighlights.add(columnId);
    }
  }

  return highlighted;
}
