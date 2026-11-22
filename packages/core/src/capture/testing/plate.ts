import type { CadXY } from "@nodetto/ir";
import {
  CAD_TEST_PAGE,
  cadElement,
  extrude,
  rectangle,
  sketch,
} from "../../cad/testing/documents.ts";
import { document } from "../../test-helpers.ts";

function circle(id: string, sketchId: string, c: CadXY, r: number) {
  return cadElement(id, "cad.circle", "a1", { sketch: sketchId, c, r });
}

export function capturePlateDocument() {
  const plate = cadElement("plate", "cad.extrude", "a2", {
    name: "Plate",
    sketch: "base",
    distance: 5,
    op: "new",
  });
  const end = { face: { feature: plate.id, role: "end" } } as const;
  return document(
    [
      sketch("base", "a1"),
      ...rectangle("base", 0, 0, 100, 60),
      plate,
      sketch("holes", "a3", end),
      ...Array.from({ length: 60 }, (_, i) =>
        circle(
          `hole-${i}`,
          "holes",
          [5 + (i % 10) * 10, 5 + Math.floor(i / 10) * 10],
          2,
        ),
      ),
      extrude("drill", "a4", {
        sketch: "holes",
        distance: -5,
        op: "cut",
        bodies: [plate.id],
      }),
      sketch("pocket", "a5", end),
      ...rectangle("pocket", 10, 12, 20, 16),
      extrude("mill", "a6", {
        sketch: "pocket",
        distance: -2,
        op: "cut",
        bodies: [plate.id],
      }),
      sketch("ring", "a7", end),
      circle("ring-outside", "ring", [55, 35], 11),
      circle("ring-inside", "ring", [55, 35], 5),
      extrude("boss", "a8", {
        sketch: "ring",
        distance: 8,
        op: "add",
        bodies: [plate.id],
      }),
      sketch("block-base", "a9", { base: "xy", offset: 2 }),
      ...rectangle("block-base", 85, 45, 25, 25),
      cadElement("block", "cad.extrude", "aA", {
        name: "Block",
        sketch: "block-base",
        distance: 12,
        op: "new",
      }),
      sketch("puck-base", "aB"),
      ...rectangle("puck-base", 140, 5, 30, 30),
      cadElement("puck", "cad.extrude", "aC", {
        name: "Puck",
        sketch: "puck-base",
        distance: 8,
        op: "new",
      }),
      sketch("puck-rim", "aD"),
      circle("rim", "puck-rim", [155, 20], 18),
      extrude("round-puck", "aE", {
        sketch: "puck-rim",
        distance: 8,
        op: "intersect",
        bodies: ["puck"],
      }),
    ],
    [{ ...CAD_TEST_PAGE, name: "Plate" }],
  );
}
