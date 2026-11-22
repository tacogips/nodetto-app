import { expect, test } from "bun:test";
import type { Element } from "@nodetto/ir";
import { isFractionalKey } from "../fractional.ts";
import { isElementIdFormat } from "../ids.ts";
import { checkCadPage } from "./check.ts";
import { createCadMemo, evaluateCadPage, releaseCadMemo } from "./evaluate.ts";
import {
  CAD_TEST_PAGE,
  bossOnFace,
  cadElement,
  extrude,
  plateElements,
  rectangle,
  sketch,
} from "./testing/documents.ts";
import { generateCadDocument } from "./testing/generate.ts";
import { RecordingKernel } from "./testing/recording-kernel.ts";

const report = (elements: readonly Element[]) =>
  checkCadPage(elements, CAD_TEST_PAGE.id);

test("check reports Plate, counts only local known CAD records, and has no bounds for an empty page", () => {
  expect(
    report([
      ...plateElements(),
      { ...sketch("foreign", "a1"), page: "elsewhere" },
      cadElement("future", "cad.future", "a3", {}),
      cadElement("color", "design.token", "a4", {
        name: "Finish",
        kind: "color",
        value: "#627385",
      }),
    ]),
  ).toEqual({
    pageId: CAD_TEST_PAGE.id,
    features: 2,
    entities: 4,
    errors: [],
    bounds: { min: [0, 0, 0], max: [100, 60, 5] },
  });
  expect(report([])).toEqual({
    pageId: CAD_TEST_PAGE.id,
    features: 0,
    entities: 0,
    errors: [],
    bounds: null,
  });
});

test("bounds follow face frames and include negative and symmetric tool spans", () => {
  const elements = [
    ...bossOnFace().elements,
    sketch("side", "a5", {
      face: { feature: "ex1", role: "side", entity: "base-edge-0" },
    }),
    ...rectangle("side", 1, 1, 2, 2),
    extrude("cut", "a6", {
      sketch: "side",
      distance: -8,
      symmetric: true,
      op: "cut",
      bodies: ["ex1"],
    }),
  ];
  expect(report(elements)).toMatchObject({
    bounds: { min: [0, -4, 0], max: [100, 60, 15] },
    errors: [],
  });
});

test("check includes structural, semantic and dependent failures from history", () => {
  const elements = [
    ...plateElements(),
    extrude("missing", "b1", { distance: 2, op: "new" }),
    sketch("failed", "b2", { face: { feature: "missing", role: "end" } }),
    sketch("forward", "b3", { face: { feature: "later", role: "end" } }),
    extrude("later", "b4", { sketch: "base", distance: 2, op: "new" }),
    sketch("cycle-sketch", "b5", {
      face: { feature: "cycle-extrude", role: "start" },
    }),
    extrude("cycle-extrude", "b6", {
      sketch: "cycle-sketch",
      distance: 2,
      op: "new",
    }),
    extrude("body-absent", "b7", {
      sketch: "base",
      distance: 2,
      op: "cut",
      bodies: [],
    }),
    extrude("body-reference", "b8", {
      sketch: "base",
      distance: 2,
      op: "add",
      bodies: ["ex1", "missing-body"],
    }),
    cadElement("invalid-mesh", "cad.mesh", "b9", {
      name: "Mesh",
      data: "invalid",
    }),
    extrude("invalid-mesh-target", "bA", {
      sketch: "base",
      distance: 1,
      op: "cut",
      bodies: ["invalid-mesh"],
    }),
    cadElement("round", "cad.circle", "bB", {
      sketch: "base",
      c: [10, 10],
      r: 2,
    }),
    sketch("curved-face", "bC", {
      face: { feature: "ex1", role: "side", entity: "round" },
    }),
    cadElement("invalid-sketch", "cad.sketch", "bD", { name: "Sketch" }),
    cadElement("invalid-entity", "cad.circle", "bE", {
      sketch: "different",
      c: [0, 0],
      r: 0,
    }),
    cadElement("detached-entity", "cad.circle", "bF", { c: [0, 0], r: 1 }),
  ];
  expect(report(elements).errors).toEqual([
    { id: "missing", code: "cad.reference.missing" },
    { id: "failed", code: "cad.reference.failed" },
    { id: "forward", code: "cad.order.forward" },
    { id: "cycle-sketch", code: "cad.cycle" },
    { id: "cycle-extrude", code: "cad.cycle" },
    { id: "body-absent", code: "cad.body.missing" },
    { id: "body-reference", code: "cad.body.reference" },
    { id: "invalid-mesh", code: "cad.mesh.invalid" },
    { id: "invalid-mesh-target", code: "cad.body.missing" },
    { id: "curved-face", code: "cad.plane.notPlanar" },
    { id: "invalid-sketch", code: "cad.feature.invalid" },
    { id: "invalid-entity", code: "cad.profile.invalid" },
    { id: "detached-entity", code: "cad.reference.missing" },
  ]);
});

test.each([
  ["cad.profile.empty", []],
  ["cad.profile.open", rectangle("base", 0, 0, 4, 4).slice(1)],
  [
    "cad.profile.branch",
    [
      ...rectangle("base", 0, 0, 4, 4),
      cadElement("branch", "cad.line", "a1", {
        sketch: "base",
        a: [0, 0],
        b: [1, 1],
      }),
    ],
  ],
  [
    "cad.profile.intersect",
    [
      ...rectangle("base", 0, 0, 4, 4),
      cadElement("crossing", "cad.circle", "a1", {
        sketch: "base",
        c: [4, 2],
        r: 1,
      }),
    ],
  ],
] as const)("check reports %s on the extrude", (code, entities) => {
  expect(
    report([
      sketch("base", "a1"),
      ...entities,
      extrude("tool", "a2", { sketch: "base", distance: 2, op: "new" }),
    ]),
  ).toMatchObject({ errors: [{ id: "tool", code }], bounds: null });
});

test("extent limits apply after transforming the tool and suppressed bodies are unavailable", () => {
  expect(
    report([
      sketch("base", "a1", { base: "xy", offset: 9999 }),
      ...rectangle("base", 0, 0, 4, 4),
      extrude("limit", "a2", { sketch: "base", distance: 2, op: "new" }),
      extrude("suppressed", "a3", {
        sketch: "base",
        distance: 2,
        op: "new",
        suppressed: true,
      }),
      extrude("cut", "a4", {
        sketch: "base",
        distance: -2,
        op: "cut",
        bodies: ["suppressed"],
      }),
    ]),
  ).toMatchObject({
    errors: [
      { id: "limit", code: "cad.limit" },
      { id: "cut", code: "cad.reference.failed" },
    ],
    bounds: null,
  });
});

test.each([
  ["suppressed cut, suppressed body", true, true, false, []],
  ["active cut, suppressed body", false, true, false, ["cut"]],
  ["suppressed cut, failed body", true, false, true, ["body", "cut"]],
] as const)(
  "check and evaluator agree for a %s",
  (_label, suppressed, suppressBody, failBody, failedIds) => {
    const elements = [
      sketch("base", "a1"),
      ...rectangle("base", 0, 0, 4, 4),
      ...(failBody ? [sketch("empty", "a2")] : []),
      extrude("body", "a3", {
        sketch: failBody ? "empty" : "base",
        distance: 2,
        op: "new",
        suppressed: suppressBody,
      }),
      extrude("cut", "a4", {
        sketch: "base",
        distance: -2,
        op: "cut",
        bodies: ["body"],
        suppressed,
      }),
    ];
    const kernel = new RecordingKernel();
    const memo = createCadMemo(kernel);
    try {
      const { status } = evaluateCadPage(elements, kernel, memo);
      const errors = [...status].flatMap(([id, result]) =>
        result.ok ? [] : [{ id, code: result.code }],
      );
      expect(errors.map(({ id }) => id)).toEqual([...failedIds]);
      expect(report(elements).errors).toEqual(errors);
    } finally {
      releaseCadMemo(memo);
    }
  },
);

test("CAD document generator is repeatable and uses unique production-format IDs", () => {
  const options = { features: 4, entitiesPerSketch: 19 };
  const doc = generateCadDocument(options);
  expect(generateCadDocument(options)).toEqual(doc);
  const ids = [
    doc.id,
    ...doc.pages.map(({ id }) => id),
    ...doc.elements.map(({ id }) => id),
  ];
  expect(doc.elements).toHaveLength(84);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every(isElementIdFormat)).toBe(true);
  expect(doc.elements.filter(({ type }) => type === "cad.line")).toHaveLength(
    32,
  );
  expect(doc.elements.filter(({ type }) => type === "cad.circle")).toHaveLength(
    44,
  );
  expect(
    doc.elements.filter(({ type }) => type === "cad.extrude"),
  ).toHaveLength(4);
  const indexes = doc.elements.map(({ index }) => index);
  expect(indexes.every(isFractionalKey)).toBe(true);
  expect([...new Set(indexes)].sort()).toEqual(indexes);
});

test("check handles 20,000 CAD elements in under one second", () => {
  const doc = generateCadDocument({ features: 1_000, entitiesPerSketch: 18 });
  const page = doc.pages[0];
  if (!page) throw new Error("Expected the generated CAD page");
  expect(doc.elements).toHaveLength(20_000);
  const start = performance.now();
  const result = checkCadPage(doc.elements, page.id);
  const elapsed = performance.now() - start;
  console.log(`CAD check, 20,000 elements: ${elapsed.toFixed(1)} ms`);
  expect(result).toMatchObject({
    features: 2_000,
    entities: 18_000,
    errors: [],
  });
  expect(elapsed).toBeLessThan(1000);
});
