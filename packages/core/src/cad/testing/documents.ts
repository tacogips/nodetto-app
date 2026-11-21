import type {
  CadExtrudeSemantic,
  CadPlane,
  CadXY,
  Document,
  Element,
} from "@nodetto/ir";
import { document, element } from "../../test-helpers.ts";

export const CAD_TEST_PAGE = {
  id: "cad",
  name: "Model",
  kind: "cad3d",
} as const;

export function cadElement<S>(
  id: string,
  type: string,
  index: string,
  semantic: S,
): Element<S> {
  return {
    ...element({ id, type, index, page: CAD_TEST_PAGE.id, semantic }),
    semantic,
  };
}

export function sketch(
  id: string,
  index: string,
  plane: CadPlane = { base: "xy" },
) {
  return cadElement(id, "cad.sketch", index, { name: id, plane });
}

export function extrude(
  id: string,
  index: string,
  semantic: Omit<CadExtrudeSemantic, "name">,
) {
  return cadElement(id, "cad.extrude", index, { ...semantic, name: id });
}

export function rectangle(
  sketchId: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const lowerLeft: CadXY = [x, y];
  const lowerRight: CadXY = [x + width, y];
  const upperRight: CadXY = [x + width, y + height];
  const upperLeft: CadXY = [x, y + height];
  const edges: ReadonlyArray<readonly [CadXY, CadXY]> = [
    [lowerLeft, lowerRight],
    [lowerRight, upperRight],
    [upperRight, upperLeft],
    [upperLeft, lowerLeft],
  ];
  return edges.map(([a, b], i) =>
    cadElement(`${sketchId}-edge-${i}`, "cad.line", "a1", {
      sketch: sketchId,
      a,
      b,
    }),
  );
}

export function plateElements() {
  return [
    sketch("base", "a1"),
    ...rectangle("base", 0, 0, 100, 60),
    extrude("ex1", "a2", { sketch: "base", distance: 5, op: "new" }),
  ];
}

export function plateWithHoles(holeCount = 6): Document {
  return document(
    [
      ...plateElements(),
      sketch("holes", "a3", { face: { feature: "ex1", role: "end" } }),
      ...Array.from({ length: holeCount }, (_, i) =>
        cadElement(`hole-${i}`, "cad.circle", "a1", {
          sketch: "holes",
          c: [5 + (i % 10) * 10, 5 + Math.floor(i / 10) * 10],
          r: 3,
        }),
      ),
      extrude("ex2", "a4", {
        sketch: "holes",
        distance: -5,
        op: "cut",
        bodies: ["ex1"],
      }),
    ],
    [CAD_TEST_PAGE],
  );
}

export function bossOnFace(): Document {
  return document(
    [
      ...plateElements(),
      sketch("boss", "a3", { face: { feature: "ex1", role: "end" } }),
      ...rectangle("boss", 20, 15, 40, 20),
      extrude("ex2", "a4", {
        sketch: "boss",
        distance: 10,
        op: "add",
        bodies: ["ex1"],
      }),
    ],
    [CAD_TEST_PAGE],
  );
}
