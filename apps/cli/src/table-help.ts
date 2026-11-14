import { TABLE_SHEET_COLUMN_TYPES, TABLE_SHEET_LIMITS } from "@nodetto/ir";

/**
 * Kept apart from table-command.ts so help.ts does not import the command
 * module, which imports commands.ts and would close an import cycle.
 */
export const TABLE_HELP = `Usage: nodetto-cli table create <doc.jsonl> (--csv <file> | --tsv <file> | --data <json>) [--page <id|name>] [--id <id>] [--x <n> --y <n>] [--no-header] [--types t1,t2,...] [--widths w1,w2,...] [--format text|json]
       nodetto-cli table set <doc.jsonl> <table-id> --cell <row>:<col> --value <text> [--cell ... --value ...] [--format text|json]
CSV and TSV support RFC 4180 quoting and a UTF-8 BOM; ragged rows are padded. The first record names columns unless --no-header is given.
Types: ${TABLE_SHEET_COLUMN_TYPES.join(", ")}. Limits: ${TABLE_SHEET_LIMITS.maxColumns} columns, ${TABLE_SHEET_LIMITS.maxRows} rows, ${TABLE_SHEET_LIMITS.maxCellText} characters per cell, ${TABLE_SHEET_LIMITS.maxColumnName} per column name, ${TABLE_SHEET_LIMITS.maxOptions} options of ${TABLE_SHEET_LIMITS.maxOptionLength} characters; widths ${TABLE_SHEET_LIMITS.minColumnWidth}-${TABLE_SHEET_LIMITS.maxColumnWidth}, heights ${TABLE_SHEET_LIMITS.minRowHeight}-${TABLE_SHEET_LIMITS.maxRowHeight}.`;
