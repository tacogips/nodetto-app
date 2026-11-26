import {
  CommandError,
  computeSchematicConnectivity,
  schematicPinDefs,
  toSchematicNetlist,
  type Editor,
} from "@nodetto/core";
import {
  SCHEMATIC_IC_MAX_PINS,
  SCHEMATIC_IC_SIDES,
  type Document,
  type ElementId,
  type PageId,
  type SchematicIcSemantic,
} from "@nodetto/ir";

type Pin = SchematicIcSemantic["pins"][number];
export function writeSchematicSemantic(
  editor: Editor,
  id: ElementId,
  patch: Readonly<Record<string, unknown>>,
): boolean {
  try {
    return editor.updateSchematicSemantic(id, patch);
  } catch (error) {
    if (error instanceof CommandError) return false;
    throw error;
  }
}
export function pinCountPatch(value: number): { pinCount: number } | null {
  return Number.isFinite(value)
    ? { pinCount: Math.max(1, Math.min(40, Math.round(value))) }
    : null;
}
export function netPatch(value: string): { net: string } | null {
  const net = value.trim();
  return net ? { net } : null;
}
export function pinsPatch(
  pins: readonly Pin[],
): { pins: readonly Pin[] } | null {
  const seen = new Set<number>();
  if (pins.length < 1 || pins.length > SCHEMATIC_IC_MAX_PINS) return null;
  for (const pin of pins) {
    if (
      !Number.isSafeInteger(pin.number) ||
      pin.number < 1 ||
      seen.has(pin.number) ||
      !SCHEMATIC_IC_SIDES.includes(pin.side)
    )
      return null;
    seen.add(pin.number);
  }
  return { pins };
}
export function schematicPinRows(
  document: Document,
  pageId: PageId,
  elementId: ElementId,
): readonly { pin: number; name: string; net: string }[] {
  const element = document.elements.find(
    (item) =>
      item.id === elementId && item.page === pageId && !item.visual.hidden,
  );
  if (!element) return [];
  const connectivity = computeSchematicConnectivity(document, pageId);
  const netlist = toSchematicNetlist(document, pageId, connectivity);
  const indices = new Map<number, number>();
  for (const component of netlist.components)
    for (const pin of component.pins) {
      const id = connectivity.netOfPin({
        elementId: component.elementId,
        pin: pin.number,
      });
      if (id !== undefined && !indices.has(id)) indices.set(id, indices.size);
    }
  return schematicPinDefs(element).map((pin) => {
    const id = connectivity.netOfPin({ elementId, pin: pin.number });
    const index = id === undefined ? -1 : (indices.get(id) ?? -1);
    return {
      pin: pin.number,
      name: pin.name,
      net: netlist.nets[index]?.name ?? "",
    };
  });
}
