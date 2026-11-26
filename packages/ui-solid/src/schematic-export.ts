import {
  computeSchematicConnectivity,
  toSchematicNetlist,
} from "@nodetto/core";
import type { Document, PageId } from "@nodetto/ir";
import {
  exportSchematicKicadNetlist,
  exportSchematicNetlistText,
} from "@nodetto/io";

export type SchematicExportKind = "text" | "kicad";
export const SCHEMATIC_EXPORTS: readonly {
  kind: SchematicExportKind;
  label: string;
  extension: "txt" | "net";
}[] = [
  { kind: "text", label: "Netlist (text)", extension: "txt" },
  { kind: "kicad", label: "KiCad netlist (.net)", extension: "net" },
];
export function schematicExportEnabled(
  pageKind: string | undefined,
  hasHandler: boolean,
): boolean {
  return pageKind === "schematic" && hasHandler;
}
export function schematicExportText(
  document: Document,
  pageId: PageId,
  kind: SchematicExportKind,
) {
  const netlist = toSchematicNetlist(
    document,
    pageId,
    computeSchematicConnectivity(document, pageId),
  );
  const report =
    kind === "text"
      ? exportSchematicNetlistText(netlist)
      : exportSchematicKicadNetlist(netlist);
  return { ...report, extension: kind === "text" ? "txt" : "net" };
}
