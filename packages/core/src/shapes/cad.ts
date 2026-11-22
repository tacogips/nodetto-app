import {
  CAD_ELEMENT_TYPES,
  type CadElementType,
  type SemanticByType,
} from "@nodetto/ir";
import type { ShapeUtil } from "../shape-util.ts";

const defaults: { [Type in CadElementType]: () => SemanticByType[Type] } = {
  "cad.sketch": () => ({ name: "Sketch", plane: { base: "xy" } }),
  "cad.line": () => ({ a: [0, 0], b: [10, 0] }),
  "cad.arc": () => ({ a: [0, 0], m: [5, 5], b: [10, 0] }),
  "cad.circle": () => ({ c: [0, 0], r: 5 }),
  "cad.extrude": () => ({ name: "Extrude", distance: 10, op: "new" }),
  "cad.pcb": () => ({ name: "PCB Board" }),
  "cad.mesh": () => ({
    name: "Mesh",
    data: "nmesh1:Tk1TSAEAAwAEBAEABAAAAAAA0A8A0A/PD9APzw8AAAAAAwEABAEDAwECP/0Vww==",
  }),
};

export const cadShapeUtils: readonly ShapeUtil[] = CAD_ELEMENT_TYPES.map(
  (type) => ({
    type,
    canResize: false,
    getBounds: () => null,
    hitTest: () => false,
    defaultSemantic: defaults[type],
    defaultVisual: () => ({}),
  }),
);
