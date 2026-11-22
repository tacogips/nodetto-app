import { expect, test } from "bun:test";
import {
  CAD_ELEMENT_TYPES,
  CAD_MESH_DATA_MAX_CHARS,
  CAD_OPERATIONS,
  type CadElementType,
  isOnCadGrid,
} from "./cad.ts";
import { getElementTypeDefinition } from "./registry.ts";

function definition(type: CadElementType) {
  const result = getElementTypeDefinition(type);
  if (!result) throw new Error(`Missing definition for ${type}`);
  return result;
}

test("checks the CAD mesh prefix, alphabet and size without decoding", () => {
  const entry = definition("cad.mesh");
  const data =
    "nmesh1:Tk1TSAEAAwAEBAEABAAAAAAA0A8A0A/PD9APzw8AAAAAAwEABAEDAwECP/0Vww==";
  const validate = (data: unknown) =>
    entry.validateSemantic({ name: "Tetrahedron", data }, "semantic");
  expect(validate(data)).toEqual([]);
  expect(entry.references({ name: "Tetrahedron", data })).toEqual([]);
  const largest = `nmesh1:${"A".repeat(CAD_MESH_DATA_MAX_CHARS - 7)}`;
  const start = performance.now();
  expect(validate(largest)).toEqual([]);
  expect(performance.now() - start).toBeLessThan(50);
  for (const invalid of [
    `${largest}A`,
    "nmesh1:",
    "nmesh2:AAAA",
    "nmesh1:AA_A",
    null,
  ]) {
    expect(validate(invalid)).toEqual([
      expect.objectContaining({
        code: "cad.mesh.invalid",
        path: "semantic.data",
      }),
    ]);
  }
});

test("registers all CAD shapes as nodes with the expected reference policies", () => {
  for (const type of CAD_ELEMENT_TYPES) {
    const entry = definition(type);
    expect(entry.category).toBe("node");
    expect(entry.keepsExternalReferences).toBe(true);
    expect(entry.onReferenceDeleted).toBe(
      type === "cad.sketch" || type === "cad.extrude" || type === "cad.pcb"
        ? "detach"
        : "cascade",
    );
  }
});

test.each([
  ["cad.sketch", { name: "Top", plane: { face: { role: "end" } } }],
  [
    "cad.sketch",
    { name: "Wall", plane: { face: { feature: "plate", role: "side" } } },
  ],
  ["cad.sketch", { name: "Base", plane: { base: "zx", offset: -0.000001 } }],
  ["cad.line", { a: [0, 0], b: [10000, 0], construction: true }],
  ["cad.arc", { a: [0, 0], m: [5, 5], b: [10, 0] }],
  ["cad.circle", { c: [-10000, 0], r: 0.000001 }],
] as const)(
  "accepts CAD payload for %s without a required reference",
  (type, semantic) => {
    expect(definition(type).validateSemantic(semantic, "semantic")).toEqual([]);
  },
);

test.each([...CAD_OPERATIONS])(
  "accepts absent and empty reference arrays for %s",
  (op) => {
    const entry = definition("cad.extrude");
    const detached = { name: "Plate", distance: -5, op };
    expect(entry.validateSemantic(detached, "semantic")).toEqual([]);
    expect(
      entry.validateSemantic(
        { ...detached, bodies: [], loops: [] },
        "semantic",
      ),
    ).toEqual([]);
  },
);

test.each([
  ["cad.sketch", { name: "Base", plane: {} }, "semantic.plane"],
  [
    "cad.sketch",
    { name: "Base", plane: { base: "xz" } },
    "semantic.plane.base",
  ],
  [
    "cad.sketch",
    { name: "Wall", plane: { base: "xy", face: { role: "side" } } },
    "semantic.plane",
  ],
  [
    "cad.sketch",
    { name: "Wall", plane: { face: { role: "side", entity: "" } } },
    "semantic.plane.face.entity",
  ],
  ["cad.line", { sketch: "", a: [0, 0], b: [10, 0] }, "semantic.sketch"],
  ["cad.line", { a: [0, 0], b: [10, 0, 0] }, "semantic.b"],
  ["cad.line", { a: [0, 0], b: [10000.000001, 0] }, "semantic.b[0]"],
  [
    "cad.line",
    { a: [0, 0], b: [Number.POSITIVE_INFINITY, 0] },
    "semantic.b[0]",
  ],
  ["cad.arc", { a: [0, 0], m: [10, 0], b: [10, 0] }, "semantic"],
  ["cad.circle", { c: [0, 0], r: -1 }, "semantic.r"],
  ["cad.circle", { c: [0, 0], r: 0.0000001 }, "semantic.r"],
  [
    "cad.extrude",
    { name: "Plate", distance: 0, op: "new" },
    "semantic.distance",
  ],
  ["cad.extrude", { name: "Plate", distance: 5, op: "join" }, "semantic.op"],
  [
    "cad.extrude",
    { name: "Plate", distance: 5, op: "cut", bodies: [17] },
    "semantic.bodies[0]",
  ],
] as const)("rejects malformed CAD payload for %s", (type, semantic, path) => {
  expect(
    definition(type)
      .validateSemantic(semantic, "semantic")
      .map((issue) => issue.path),
  ).toContain(path);
});

test("only finite, nanometre-grid lengths are canonical", () => {
  expect(isOnCadGrid(-1.234567)).toBe(true);
  expect(isOnCadGrid(0)).toBe(true);
  expect(isOnCadGrid(1.2345671)).toBe(false);
  expect(isOnCadGrid(Number.NaN)).toBe(false);
  expect(isOnCadGrid(Number.POSITIVE_INFINITY)).toBe(false);
});

test("enumerates nested face and indexed extrude references in declaration order", () => {
  expect(
    definition("cad.sketch").references({
      plane: { face: { feature: "plate", role: "side", entity: "rim" } },
    }),
  ).toEqual([
    { field: "plane.face.feature", id: "plate" },
    { field: "plane.face.entity", id: "rim" },
  ]);
  expect(
    definition("cad.extrude").references({
      sketch: "holes",
      loops: ["hole-a", "hole-b"],
      bodies: ["plate"],
    }),
  ).toEqual([
    { field: "sketch", id: "holes" },
    { field: "loops[0]", id: "hole-a" },
    { field: "loops[1]", id: "hole-b" },
    { field: "bodies[0]", id: "plate" },
  ]);
});

test("checks PCB board links and optional thickness on the 1 nm grid", () => {
  const entry = definition("cad.pcb");
  expect(entry.validateSemantic({ name: "Detached" }, "semantic")).toEqual([]);
  const semantic = {
    name: "Controller",
    board: "b1",
    thickness: 1.500001,
    suppressed: false,
  };
  expect(entry.validateSemantic(semantic, "semantic")).toEqual([]);
  expect(entry.references(semantic)).toEqual([{ field: "board", id: "b1" }]);
  for (const fields of [
    { board: "" },
    { board: 5 },
    { thickness: 0 },
    { thickness: -1 },
    { thickness: 100.000001 },
    { thickness: 1.5000005 },
    { suppressed: 1 },
  ]) {
    expect(
      entry.validateSemantic({ ...semantic, ...fields }, "semantic"),
    ).toHaveLength(1);
  }
  expect(
    entry.validateSemantic({ ...semantic, thickness: 100 }, "semantic"),
  ).toEqual([]);
});
