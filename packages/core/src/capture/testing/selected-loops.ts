import {
  CAD_TEST_PAGE,
  cadElement,
  rectangle,
  sketch,
} from "../../cad/testing/documents.ts";
import { document } from "../../test-helpers.ts";

function profile(id: string, order: string, x: number) {
  const outer = `${id}-outer-circle`;
  const inner = `${id}-inner-circle`;
  return {
    elements: [
      sketch(id, order),
      ...rectangle(id, x, 0, 60, 40),
      cadElement(outer, "cad.circle", "a1", {
        sketch: id,
        c: [x + 30, 20],
        r: 10,
      }),
      cadElement(inner, "cad.circle", "a1", {
        sketch: id,
        c: [x + 30, 20],
        r: 4,
      }),
    ],
    rectangle: `${id}-edge-0`,
    outer,
    inner,
  };
}

export function captureSelectedLoopsDocument() {
  const disc = profile("disc-profile", "a1", 0);
  const slab = profile("slab-profile", "a3", 80);
  return document(
    [
      ...disc.elements,
      cadElement("disc", "cad.extrude", "a2", {
        name: "Disc",
        sketch: "disc-profile",
        loops: [disc.outer, disc.inner],
        distance: 4,
        op: "new",
      }),
      ...slab.elements,
      cadElement("slab", "cad.extrude", "a4", {
        name: "Slab",
        sketch: "slab-profile",
        loops: [slab.rectangle, slab.inner],
        distance: 4,
        op: "new",
      }),
    ],
    [{ ...CAD_TEST_PAGE, name: "Selected loops" }],
  );
}
