import { expect, test } from "bun:test";
import { createManifoldKernel } from "@nodetto/cad-kernel";
import {
  type CadDisplayBody,
  CommandError,
  createCadMemo,
  displayBody,
  Editor,
  evaluateCadPage,
  keyAfter,
  layerName,
  newElementId,
  releaseCadMemo,
} from "@nodetto/core";
import { decodeNmesh, fromInline, toTriangleMesh } from "@nodetto/io/nmesh";
import { readStl, writeBinaryStl } from "@nodetto/io/stl";
import { hasErrors, validateDocument } from "@nodetto/ir";
import { bodiesToStl, stlToMeshCommands } from "./mesh-io.ts";

const ids = {
  next: newElementId,
  indexAfter: (after?: string) => keyAfter(after ?? null),
};
const corners = [
  [1, 2, 3],
  [7, 2, 3],
  [7, 6, 3],
  [1, 6, 3],
  [1, 2, 5],
  [7, 2, 5],
  [7, 6, 5],
  [1, 6, 5],
];
const box = {
  positions: Float32Array.from(corners.flat()),
  triangles: Uint32Array.from(
    [
      [3, 2, 1, 0],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
    ].flatMap(([a, b, c, d]) => [a, b, c, a, c, d]),
  ),
};

function importedBox(bytes: Uint8Array) {
  const editor = new Editor();
  const page = editor.createPage({ kind: "cad3d" });
  const sketch = editor.createElement("cad.sketch");
  const previous = editor.store.get(sketch)?.index;
  const result = stlToMeshCommands(
    page,
    bytes,
    " Enclosure.STL",
    ids,
    previous,
  );
  if ("error" in result) throw new Error(result.error);
  const [command] = result.commands;
  if (command?.type !== "createElement")
    throw new Error("Expected CAD mesh creation");
  editor.apply(result.commands);
  const { element } = command;
  const semantic = element.semantic as { data: string };
  const mesh = toTriangleMesh(decodeNmesh(fromInline(semantic.data)));
  return { editor, page, previous, element, mesh, data: semantic.data };
}

test("imports a named canonical mesh at the end of CAD history in one undo step", () => {
  const { editor, previous, element, mesh } = importedBox(
    writeBinaryStl([box]),
  );
  expect(hasErrors(validateDocument(editor.getSnapshot()))).toBe(false);
  expect(layerName(element)).toBe("Enclosure");
  expect(element.index > (previous ?? "")).toBe(true);
  expect(mesh.triangles.length / 3).toBe(12);
  const decodedCorners = [];
  for (let i = 0; i < mesh.positions.length; i += 3)
    decodedCorners.push(Array.from(mesh.positions.slice(i, i + 3)));
  expect(decodedCorners.sort()).toEqual([...corners].sort());
  editor.undo();
  expect(editor.store.has(element.id)).toBe(false);
  expect(editor.getSnapshot().elements).toHaveLength(1);
  editor.redo();
  expect(editor.store.get(element.id)).toEqual(element);
});

test("real-kernel box re-export is byte-identical after reimport", async () => {
  const kernel = await createManifoldKernel();
  function exportImport(bytes: Uint8Array) {
    const { editor, data, mesh, element } = importedBox(bytes);
    const memo = createCadMemo(kernel);
    try {
      const evaluated = evaluateCadPage(
        editor.getSnapshot().elements,
        kernel,
        memo,
        {
          decodeMesh: () => ({
            ...mesh,
            triFace: new Uint32Array(12),
            faceNames: ["mesh"],
          }),
        },
      );
      expect(evaluated.status.get(element.id)).toEqual({ ok: true });
      expect(evaluated.bodies).toHaveLength(1);
      const bodies = evaluated.bodies.map(({ id, handle, reference }) =>
        displayBody(id, reference, kernel.mesh(handle)),
      );
      return { data, bytes: bodiesToStl(bodies) };
    } finally {
      releaseCadMemo(memo);
    }
  }
  const first = exportImport(writeBinaryStl([box]));
  const second = exportImport(first.bytes);
  expect(second.bytes).toEqual(first.bytes);
  expect(importedBox(first.bytes).data).toBe(second.data);
});

test("rejects a corrupt STL and a valid STL with no usable triangles", () => {
  expect(stlToMeshCommands("cad", Uint8Array.of(1, 2), "Broken", ids)).toEqual({
    error: "Could not read the STL file.",
  });
  expect(stlToMeshCommands("cad", writeBinaryStl([]), "Empty", ids)).toEqual({
    error: "The STL contains no usable triangles.",
  });
});

test("rejects a detailed sphere that exceeds the inline size cap", () => {
  const segments = 512;
  const rings = 320;
  const positions = [0, 0, 100];
  const triangles: number[] = [];
  for (let ring = 1; ring < rings; ring++) {
    const phi = (ring * Math.PI) / rings;
    for (let segment = 0; segment < segments; segment++) {
      const theta = (segment * 2 * Math.PI) / segments;
      positions.push(
        100 * Math.sin(phi) * Math.cos(theta),
        100 * Math.sin(phi) * Math.sin(theta),
        100 * Math.cos(phi),
      );
      const a = 1 + (ring - 1) * segments + segment;
      const b = 1 + (ring - 1) * segments + ((segment + 1) % segments);
      if (ring === 1) triangles.push(0, a, b);
      if (ring < rings - 1)
        triangles.push(a, a + segments, b, b, a + segments, b + segments);
      else triangles.push(a, 1 + (rings - 1) * segments, b);
    }
  }
  positions.push(0, 0, -100);
  const bytes = writeBinaryStl([
    {
      positions: Float32Array.from(positions),
      triangles: Uint32Array.from(triangles),
    },
  ]);
  expect(stlToMeshCommands("cad", bytes, "Sphere", ids)).toEqual({
    error:
      "Mesh too large for an inline body (limit 1 MiB encoded). Simplify it first.",
  });
});

test("the command layer rejects mesh imports on a freeform page", () => {
  const editor = new Editor();
  const result = stlToMeshCommands(
    editor.currentPageId,
    writeBinaryStl([box]),
    "Box",
    ids,
  );
  if ("error" in result) throw new Error(result.error);
  try {
    editor.apply(result.commands);
    throw new Error("Expected the page content rule to refuse the import");
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    expect(error.issues).toContainEqual(
      expect.objectContaining({ code: "page.contentKind" }),
    );
  }
  expect(editor.getSnapshot().elements).toEqual([]);
});

test("display STL export excludes reference bodies unless requested", () => {
  const body: CadDisplayBody = {
    id: "box",
    reference: false,
    positions: box.positions,
    indices: box.triangles,
    triFace: new Uint32Array(12),
    faceNames: ["mesh"],
    edges: new Float32Array(),
  };
  const reference = { ...body, id: "board", reference: true };
  expect(readStl(bodiesToStl([body, reference])).triangles.length / 3).toBe(12);
  expect(
    readStl(bodiesToStl([body, reference], { includeReference: true }))
      .triangles.length / 3,
  ).toBe(24);
});

test("mesh picker, drop and STL export controls work in light and dark modes", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--conditions=browser",
      "--config=./test-dom/bunfig.toml",
      "--preload",
      "./test-dom/setup.ts",
      "./test-dom/cad-mesh.dom.tsx",
    ],
    { cwd: `${import.meta.dir}/..`, stdout: "pipe", stderr: "pipe" },
  );
  const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
  expect(result.exitCode, output).toBe(0);
  expect(output).toContain("ok light");
  expect(output).toContain("ok dark");
});
