export type BreadboardExportKind = "bom" | "kicad" | "spice" | "gerber";

export const BREADBOARD_EXPORTS: readonly {
  kind: BreadboardExportKind;
  label: string;
  extension: "csv" | "net" | "cir" | "zip";
}[] = [
  { kind: "bom", label: "BOM (CSV)", extension: "csv" },
  { kind: "kicad", label: "KiCad netlist (.net)", extension: "net" },
  { kind: "spice", label: "SPICE netlist (.cir)", extension: "cir" },
  {
    kind: "gerber",
    label: "PCB Gerber and drill (.zip)",
    extension: "zip",
  },
];

export function breadboardExportEnabled(
  pageKind: string | undefined,
  hasHandler: boolean,
): boolean {
  return pageKind === "breadboard" && hasHandler;
}
