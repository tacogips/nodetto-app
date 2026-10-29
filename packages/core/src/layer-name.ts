import type { Element } from "@nodetto/ir";
import type { Editor } from "./editor.ts";

export function layerName(element: Element): string {
  if (element.visual.layerName?.trim()) return element.visual.layerName;
  const data = element.semantic as Record<string, unknown> | null;
  for (const field of ["name", "label", "tableName", "text"]) {
    const value = data?.[field];
    if (typeof value === "string" && value.trim()) return value;
  }
  if (element.type === "state.node")
    return `${String(data?.["kind"] ?? "State")} node`;
  if (element.type === "state.transition")
    return String(data?.["trigger"] || "Transition");
  if (element.type === "usecase.node")
    return String(
      data?.["kind"] === "system"
        ? "System boundary"
        : data?.["kind"] === "actor"
          ? "Actor"
          : "Use case",
    );
  if (element.type === "usecase.relationship")
    return `${String(data?.["kind"] ?? "association")} relationship`;
  if (element.type === "edge.generic" && data?.["prototype"] === true)
    return "Screen transition";
  if (element.type.startsWith("pcb.")) return pcbLayerName(element.type, data);
  return element.type === "frame" ? "Artboard" : element.type;
}

/** Footprints by reference; copper items by kind and net; graphics by layer. */
function pcbLayerName(
  type: string,
  data: Record<string, unknown> | null,
): string {
  const text = (field: string): string => {
    const value = data?.[field];
    return typeof value === "string" ? value.trim() : "";
  };
  const net = text("net");
  switch (type) {
    case "pcb.board":
      return "Board";
    case "pcb.footprint": {
      const reference = text("reference");
      const value = text("value");
      if (reference && value) return `${reference} ${value}`;
      return reference || value || "Footprint";
    }
    case "pcb.track":
      return net ? `Track ${net}` : "Track";
    case "pcb.via":
      return net ? `Via ${net}` : "Via";
    case "pcb.zone":
      return net ? `Zone ${net}` : "Zone";
    case "pcb.graphic": {
      const layer = text("layer");
      return layer ? `Graphic on ${layer}` : "Graphic";
    }
    default:
      return type;
  }
}

/** Empty input restores the semantic/type label without touching content. */
export function renameLayer(editor: Editor, id: string, name: string): boolean {
  const element = editor.store.get(id);
  if (!element || editor.createShapeContext().isLocked?.(id)) return false;
  const value = name.trim();
  if ((element.visual.layerName ?? "") === value) return false;
  const { layerName: _name, ...rest } = element.visual;
  editor.apply([
    {
      type: "replaceVisual",
      id,
      visual: value ? { ...rest, layerName: value } : rest,
    },
  ]);
  return true;
}
