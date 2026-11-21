import type { CadFaceRef, CadXY, Element } from "@nodetto/ir";
import { extrude, plateElements, rectangle, sketch } from "./documents.ts";

interface FaceCase {
  label: string;
  elements: readonly Element[];
  face: CadFaceRef;
  centre: CadXY;
  sign: 1 | -1;
  volume: number;
}

export function extrudeFaceCases(): readonly FaceCase[] {
  const plate = plateElements();
  const negative = [
    ...plate.slice(0, -1),
    extrude("ex1", "a2", { sketch: "base", distance: -5, op: "new" }),
  ];
  const reversed = plate.map((element) =>
    element.id === "base-edge-0"
      ? { ...element, semantic: { sketch: "base", a: [100, 0], b: [0, 0] } }
      : element,
  );
  const hollow = [
    ...plate,
    ...rectangle("inner", 30, 15, 40, 30).map((edge) => ({
      ...edge,
      semantic: { ...edge.semantic, sketch: "base" },
    })),
  ];
  const pocket = [
    ...plate,
    sketch("pocket", "a3", { face: { feature: "ex1", role: "end" } }),
    ...rectangle("pocket", 30, 20, 40, 20),
    extrude("pocket-cut", "a4", {
      sketch: "pocket",
      distance: -2,
      op: "cut",
      bodies: ["ex1"],
    }),
  ];
  const overlap = [
    ...plate,
    sketch("overlap", "a3"),
    ...rectangle("overlap", 30, 10, 100, 40),
    extrude("overlap-tool", "a4", {
      sketch: "overlap",
      distance: 4,
      op: "intersect",
      bodies: ["ex1"],
    }),
  ];
  const cap = (role: "start" | "end"): CadFaceRef => ({ feature: "ex1", role });
  const side = (entity: string): CadFaceRef => ({
    feature: "ex1",
    role: "side",
    entity,
  });
  return [
    {
      label: "positive plate end",
      elements: plate,
      face: cap("end"),
      centre: [50, 30],
      sign: 1,
      volume: 30_000,
    },
    {
      label: "positive plate start",
      elements: plate,
      face: cap("start"),
      centre: [50, 30],
      sign: -1,
      volume: 30_000,
    },
    {
      label: "negative plate end",
      elements: negative,
      face: cap("end"),
      centre: [50, 30],
      sign: -1,
      volume: 30_000,
    },
    {
      label: "forward side",
      elements: plate,
      face: side("base-edge-0"),
      centre: [50, 2.5],
      sign: 1,
      volume: 30_000,
    },
    {
      label: "reversed side",
      elements: reversed,
      face: side("base-edge-0"),
      centre: [50, 2.5],
      sign: -1,
      volume: 30_000,
    },
    {
      label: "hole side",
      elements: hollow,
      face: side("inner-edge-0"),
      centre: [20, 2.5],
      sign: -1,
      volume: 24_000,
    },
    {
      label: "pocket floor",
      elements: pocket,
      face: { feature: "pocket-cut", role: "end" },
      centre: [50, 30],
      sign: 1,
      volume: 28_400,
    },
    {
      label: "pocket wall",
      elements: pocket,
      face: { feature: "pocket-cut", role: "side", entity: "pocket-edge-0" },
      centre: [20, -1],
      sign: -1,
      volume: 28_400,
    },
    {
      label: "intersection end",
      elements: overlap,
      face: { feature: "overlap-tool", role: "end" },
      centre: [50, 30],
      sign: 1,
      volume: 11_200,
    },
  ];
}
