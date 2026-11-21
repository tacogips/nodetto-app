import { CAD_PAGE_KIND, isCadTypeName } from "./cad.ts";
import { getElementTypeDefinition } from "./registry.ts";

/** CAD shapes and ordinary shapes use separate pages. Resources are shared. */
export function pageAcceptsElementType(kind: string, type: string): boolean {
  if (isCadTypeName(type)) return kind === CAD_PAGE_KIND;
  if (kind !== CAD_PAGE_KIND) return true;
  return getElementTypeDefinition(type)?.category === "resource";
}
