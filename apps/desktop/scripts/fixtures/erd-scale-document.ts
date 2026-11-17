// Deterministic large-ERD document used by the scale benchmarks: a grid of
// tables with neighbour foreign keys plus one heavily referenced hub table.
// Pure data, so the headless bench and the browser fixture share it.
import type { Document, Element } from "@nodetto/ir";

export interface ErdScaleOptions {
  readonly tables?: number;
  readonly columnsPerRow?: number;
  readonly tableColumns?: number;
  /** Relations pointing at table 0, as a tenant-style hub. */
  readonly hubRelations?: number;
  readonly routing?: "straight" | "orthogonal" | "curved";
}

export interface ErdScaleDocument {
  readonly document: Document;
  readonly tableIds: readonly string[];
  readonly relationIds: readonly string[];
}

export const ERD_SCALE_PAGE = "erd-scale-page";
const CELL_WIDTH = 360;
const CELL_HEIGHT = 300;

function index(position: number): string {
  // Fixed-width base-36 keys order lexicographically like their positions.
  return `a${position.toString(36).padStart(5, "0")}`;
}

export function erdScaleDocument(
  options: ErdScaleOptions = {},
): ErdScaleDocument {
  const tables = options.tables ?? 2000;
  const perRow = options.columnsPerRow ?? 50;
  const tableColumns = options.tableColumns ?? 6;
  const hubRelations = options.hubRelations ?? 200;
  const elements: Element[] = [];
  const tableIds: string[] = [];
  const relationIds: string[] = [];
  let order = 0;
  for (let i = 0; i < tables; i += 1) {
    const id = `table-${i}`;
    tableIds.push(id);
    elements.push({
      id,
      page: ERD_SCALE_PAGE,
      type: "erd.table",
      index: index(order++),
      semantic: {
        tableName: `table_${i}`,
        columns: Array.from({ length: tableColumns }, (_, column) => ({
          id: `c${column}`,
          name: column === 0 ? "id" : `column_${column}`,
          dataType: column === 0 ? "uuid" : "text",
          ...(column === 0 ? { pk: true } : {}),
        })),
      },
      visual: {
        x: 40 + (i % perRow) * CELL_WIDTH,
        y: 40 + Math.floor(i / perRow) * CELL_HEIGHT,
        width: 240,
      },
    });
  }
  const relate = (from: number, to: number, column: number): void => {
    const id = `relation-${relationIds.length}`;
    relationIds.push(id);
    elements.push({
      id,
      page: ERD_SCALE_PAGE,
      type: "erd.relation",
      index: index(order++),
      semantic: {
        from: { table: `table-${to}`, column: "c0" },
        to: { table: `table-${from}`, column: `c${column}` },
        cardinality: "1:*",
        ...(options.routing ? { routing: options.routing } : {}),
      },
      visual: {},
    });
  };
  for (let i = 0; i < tables; i += 1) {
    if ((i + 1) % perRow !== 0 && i + 1 < tables)
      relate(i, i + 1, 1 % tableColumns);
    if (i % 2 === 0 && i + perRow < tables)
      relate(i, i + perRow, 2 % tableColumns);
  }
  const stride = Math.max(1, Math.floor(tables / Math.max(1, hubRelations)));
  for (let n = 0; n < hubRelations; n += 1) {
    const from = 1 + ((n * stride) % Math.max(1, tables - 1));
    if (from < tables) relate(from, 0, 3 % tableColumns);
  }
  return {
    document: {
      schemaVersion: 1,
      id: "erd-scale",
      title: "ERD scale benchmark",
      pages: [{ id: ERD_SCALE_PAGE, name: "ERD", kind: "erd" }],
      elements,
    },
    tableIds,
    relationIds,
  };
}
