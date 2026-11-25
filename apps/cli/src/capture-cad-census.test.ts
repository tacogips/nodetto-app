import { expect, test } from "bun:test";
import {
  canonicalize,
  encodeNmesh,
  toInline,
} from "../../../packages/nmesh/src/index.ts";
import {
  CAD_TEST_PAGE,
  cadElement,
} from "../../../packages/core/src/cad/testing/documents.ts";
import { renderCadCapture } from "./capture-cad.ts";

test("CLI retains unknown census bodies including beyond the summary", () => {
  const names = [
    "Bracket",
    ...Array.from({ length: 8 }, (_, i) => `Rib-${i + 1}`),
    "Gusset",
  ];
  const data = toInline(
    encodeNmesh(
      canonicalize({
        positions: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
        triangles: new Uint32Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]),
      }),
    ),
  );
  const elements = names.map((name, i) =>
    cadElement(`mesh-${i}`, "cad.mesh", `a${i}`, { name, data }),
  );
  const report = {
    width: 320,
    height: 240,
    bodies: names.map((_, i) => ({
      state: i === 0 || i === 9 ? "unknown" : "drawn",
      open: false,
      emptiedByStep: -1,
    })),
    analysis: null,
    pairs: [],
  };
  const result = renderCadCapture(
    elements,
    elements,
    CAD_TEST_PAGE,
    { width: 320, height: 240, theme: "dark", camera: { view: "iso" } },
    () => ({ image: Uint8Array.of(1), report: JSON.stringify(report) }),
    "png",
    90,
  );
  expect(result.lines.join("\n")).toContain("Bracket [not sampled]");
  expect(result.metadata.bodies[9]).toMatchObject({
    name: "Gusset",
    state: "unknown",
  });
  expect(
    result.metadata.errors.some((error) => error.code === "cad.result.empty"),
  ).toBe(false);
});
