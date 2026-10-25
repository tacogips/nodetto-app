import type {
  BreadboardImportDiagnostic,
  BreadboardImportResult,
} from "@nodetto/ir";
import { importNetlist } from "./netlist.ts";
import { importSchematic } from "./schematic.ts";
import { atomAt, readSexpr } from "./sexpr.ts";

export { readSexpr } from "./sexpr.ts";
export type { SexprAtom, SexprList, SexprNode } from "./sexpr.ts";

export function importKicad(
  text: string,
  options: { fileName: string },
): BreadboardImportResult {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("EESchema"))
    return {
      diagnostics: [
        {
          severity: "error",
          code: "kicad.legacyFormat",
          message: "KiCad legacy schematic files are not supported.",
        },
      ],
    };
  const parsed = readSexpr(text);
  const diagnostics: BreadboardImportDiagnostic[] = [...parsed.diagnostics];
  const root = parsed.root;
  if (!root) return { diagnostics };
  const rootName = atomAt(root, 0);
  if (rootName === "kicad_sch")
    return {
      plan: importSchematic(root, options.fileName, diagnostics),
      diagnostics,
    };
  if (rootName === "export")
    return {
      plan: importNetlist(root, options.fileName, diagnostics),
      diagnostics,
    };
  return {
    diagnostics: [
      ...diagnostics,
      {
        severity: "error",
        code: "kicad.unknownRoot",
        message: `Unsupported KiCad root '${rootName ?? ""}'.`,
      },
    ],
  };
}
