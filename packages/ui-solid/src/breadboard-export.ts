export type BreadboardExportKind = "bom" | "kicad" | "spice";

export const BREADBOARD_EXPORTS: readonly {
  kind: BreadboardExportKind;
  label: string;
  extension: "csv" | "net" | "cir";
}[] = [
  { kind: "bom", label: "BOM (CSV)", extension: "csv" },
  { kind: "kicad", label: "KiCad netlist (.net)", extension: "net" },
  { kind: "spice", label: "SPICE netlist (.cir)", extension: "cir" },
];

export function breadboardExportEnabled(
  pageKind: string | undefined,
  hasHandler: boolean,
): boolean {
  return pageKind === "breadboard" && hasHandler;
}
