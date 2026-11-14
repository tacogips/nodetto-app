import type { TableSheetSemantic } from "@nodetto/ir";

export interface TableSheetRange {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
} // inclusive indices
export type TableSheetEditCode =
  | "table.limit"
  | "table.cellType"
  | "table.lastColumn"
  | "table.unknownRow"
  | "table.unknownColumn";
export type TableSheetEditResult =
  | {
      readonly ok: true;
      readonly semantic: TableSheetSemantic;
      readonly skipped: number;
    }
  | {
      readonly ok: false;
      readonly code: TableSheetEditCode;
      readonly message: string;
    };
