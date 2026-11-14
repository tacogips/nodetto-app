import { pcbNetMembers, type Command, type Editor } from "@nodetto/core";
import {
  roundNm,
  type Document,
  type Element,
  type ElementId,
} from "@nodetto/ir";

export type PcbEditableField =
  | "reference"
  | "value"
  | "x"
  | "y"
  | "width"
  | "diameter"
  | "drill"
  | "layer"
  | "net";

export function pcbSemanticCommand(
  element: Element,
  field: PcbEditableField,
  value: string | number,
): Command | null {
  const semantic = element.semantic as Record<string, unknown>;
  const type = element.type;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (field === "reference" || field === "value") {
    if (type !== "pcb.footprint" || typeof value !== "string") return null;
    return {
      type: "updateSemantic",
      id: element.id,
      semantic: { ...semantic, [field]: value },
    };
  }
  if (field === "x" || field === "y") {
    if (type !== "pcb.footprint" || typeof value !== "number") return null;
    const at = semantic.at;
    if (
      !Array.isArray(at) ||
      at.length !== 2 ||
      !at.every(
        (coordinate) =>
          typeof coordinate === "number" && Number.isFinite(coordinate),
      )
    )
      return null;
    const nextAt: readonly [number, number] =
      field === "x"
        ? [roundNm(value), at[1] as number]
        : [at[0] as number, roundNm(value)];
    return {
      type: "updateSemantic",
      id: element.id,
      semantic: { ...semantic, at: nextAt },
    };
  }
  if (
    field === "width" &&
    (type !== "pcb.track" || typeof value !== "number" || roundNm(value) <= 0)
  )
    return null;
  if (
    (field === "diameter" || field === "drill") &&
    (type !== "pcb.via" || typeof value !== "number" || roundNm(value) <= 0)
  )
    return null;
  if (field === "layer" && !(type === "pcb.track" && typeof value === "string"))
    return null;
  if (
    field === "net" &&
    !(["pcb.track", "pcb.via"].includes(type) && typeof value === "string")
  )
    return null;
  if (
    field !== "width" &&
    field !== "diameter" &&
    field !== "drill" &&
    field !== "layer" &&
    field !== "net"
  )
    return null;
  const nextValue = typeof value === "number" ? roundNm(value) : value;
  const next = { ...semantic, [field]: nextValue };
  if (type === "pcb.via") {
    const diameter = next.diameter;
    const drill = next.drill;
    if (
      typeof diameter !== "number" ||
      typeof drill !== "number" ||
      !(diameter > drill && drill > 0)
    )
      return null;
  }
  return { type: "updateSemantic", id: element.id, semantic: next };
}

export function editPcbSemantic(
  editor: Editor,
  element: Element,
  field: PcbEditableField,
  value: string | number,
): boolean {
  const command = pcbSemanticCommand(element, field, value);
  if (!command) return false;
  editor.apply([command]);
  return true;
}

export function pcbNetMemberIds(
  document: Document,
  pageId: string,
  net: string,
): ElementId[] {
  return net ? pcbNetMembers(document, pageId, net) : [];
}
