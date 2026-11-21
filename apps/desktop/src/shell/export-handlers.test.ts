import { expect, test } from "bun:test";
import { createManifoldKernel } from "@nodetto/cad-kernel";
import {
  type CadEngine,
  type CadEngineInput,
  createCadEngineClient,
  Editor,
  extractPdfText,
} from "@nodetto/core";
import { stlToInlineMesh } from "@nodetto/io/cad-mesh";
import { readStl, writeBinaryStl } from "@nodetto/io/stl";
import { createWorkerHost } from "../../../../packages/cad-kernel/src/worker-host.ts";
import type { ExportBackend } from "../file/backend.ts";
import { createExportHandlers } from "./export-handlers.ts";

const png = new Blob(
  [
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=",
      "base64",
    ),
  ],
  { type: "image/png" },
);

function fixture(
  rasterizeSvg: (svg: string, scale: number) => Promise<Blob> = async () => png,
  createCadEngine?: () => CadEngine,
) {
  const editor = new Editor();
  editor.loadDocument({ ...editor.getSnapshot(), title: "Paper" });
  for (const x of [0, 300]) {
    editor.createElement("frame", {
      semantic: { name: "Page", page: { size: "a4", orientation: "portrait" } },
      visual: { x, y: 0, width: 200, height: 250 },
    });
  }
  editor.createElement("text.code", {
    semantic: { code: "const answer = 42;", language: "javascript" },
    visual: { x: 20, y: 30, width: 150, height: 60 },
  });
  editor.createElement("shape.geo", {
    semantic: { geo: "rect" },
    visual: { x: 320, y: 30, width: 100, height: 80 },
  });
  const picked: [string, string][] = [];
  const writes: { path: string; bytes: Uint8Array }[] = [];
  const errors: (string | null)[] = [];
  const backend: ExportBackend = {
    available: true,
    pickExportPath: async (name, extension) => {
      picked.push([name, extension]);
      return `/out/${name}`;
    },
    writeBytes: async (path, bytes) => {
      writes.push({ path, bytes });
    },
    writeText: async () => {
      throw new Error("unexpected writeText");
    },
  };
  return {
    editor,
    picked,
    writes,
    errors,
    handlers: createExportHandlers(
      { editor, exportBackend: backend },
      (message) => errors.push(message),
      { rasterizeSvg, createCadEngine },
    ),
  };
}

test("document PDF writes two pages with extractable snippet text", async () => {
  const { handlers, picked, writes, errors } = fixture();
  await handlers.exportDocumentPdf(1, "#ffffff");
  expect(picked).toEqual([["Paper.pdf", "pdf"]]);
  expect(writes).toHaveLength(1);
  expect(writes[0].path).toBe("/out/Paper.pdf");
  expect(new TextDecoder().decode(writes[0].bytes.slice(0, 5))).toBe("%PDF-");
  const text = await extractPdfText(writes[0].bytes);
  expect(text.pages).toHaveLength(2);
  expect(text.pages.join("\n")).toContain("const answer = 42;");
  expect(errors.at(-1)).toBeNull();
});

test("document Markdown writes a ZIP with Markdown and SVG asset", async () => {
  const { handlers, picked, writes, errors } = fixture();
  await handlers.exportDocumentMarkdown();
  expect(picked).toEqual([["Paper.zip", "zip"]]);
  expect(writes).toHaveLength(1);
  expect(writes[0].path).toBe("/out/Paper.zip");
  const zip = new TextDecoder().decode(writes[0].bytes);
  expect(zip).toContain("Paper.md");
  expect(zip).toMatch(/Paper\.assets\/[a-zA-Z0-9_.-]+\.svg/);
  expect(errors.at(-1)).toBeNull();
});

test("document PDF reports rasterizer failures without writing", async () => {
  const { handlers, writes, errors } = fixture(async () => {
    throw new Error("boom");
  });
  await handlers.exportDocumentPdf(1, "#ffffff");
  expect(writes).toEqual([]);
  expect(errors.at(-1)).toBe("could not export: boom");
});

const openTriangle = {
  positions: Float32Array.of(0, 0, 0, 3, 0, 0, 0, 2, 0),
  triangles: Uint32Array.of(0, 1, 2),
};

test("STL export sends a CAD snapshot with visible body IDs and saves the worker bytes", async () => {
  const bytes = writeBinaryStl([openTriangle]);
  const requests: CadEngineInput[] = [];
  let disposed = 0;
  const { editor, handlers, picked, writes, errors } = fixture(
    undefined,
    () => ({
      async evaluate(input) {
        requests.push(input);
        return { revision: input.revision, status: [], bodies: [], stl: bytes };
      },
      dispose() {
        disposed++;
      },
    }),
  );
  await handlers.exportStl();
  expect(requests).toEqual([]);
  expect(picked).toEqual([]);
  const page = editor.createPage({ kind: "cad3d", name: "Carrier: preview" });
  const data = stlToInlineMesh(bytes);
  const id = editor.createElement("cad.mesh", {
    semantic: { name: "Bracket", data },
  });
  editor.createElement("cad.sketch");
  editor.createElement("cad.mesh", {
    semantic: { name: "Hidden", data },
    visual: { hidden: true },
  });
  await handlers.exportStl();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    pageId: page,
    revision: editor.revision,
    exportStl: { bodyIds: [id] },
  });
  expect(requests[0].elements.every((element) => element.page === page)).toBe(
    true,
  );
  expect(disposed).toBe(1);
  expect(picked).toEqual([["Carrier- preview.stl", "stl"]]);
  expect(writes).toEqual([{ path: "/out/Carrier- preview.stl", bytes }]);
  expect(errors.at(-1)).toBeNull();
});

test("real CAD client saves a closed import and refuses a page with only an open mesh", async () => {
  const kernel = createManifoldKernel();
  const { editor, handlers, writes, picked, errors } = fixture(
    undefined,
    () => {
      const host = createWorkerHost(kernel);
      let receive: (message: unknown) => void;
      return createCadEngineClient({
        post(message) {
          void host(message, (reply, transfer) =>
            receive(structuredClone(reply, { transfer: [...transfer] })),
          );
        },
        onMessage(handler) {
          receive = handler;
        },
        restart() {},
      });
    },
  );
  editor.createPage({ kind: "cad3d", name: "Housing" });
  editor.createElement("cad.mesh", {
    semantic: {
      name: "Open",
      data: stlToInlineMesh(writeBinaryStl([openTriangle])),
    },
  });
  await handlers.exportStl();
  expect(picked).toEqual([]);
  expect(writes).toEqual([]);
  expect(errors.at(-1)).toContain("no visible solid bodies");

  editor.createElement("cad.mesh", {
    semantic: {
      name: "Closed",
      data: stlToInlineMesh(
        writeBinaryStl([
          {
            positions: Float32Array.of(0, 0, 0, 3, 0, 0, 0, 2, 0, 0, 0, 4),
            triangles: Uint32Array.of(0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3),
          },
        ]),
      ),
    },
  });
  await handlers.exportStl();
  expect(picked).toEqual([["Housing.stl", "stl"]]);
  expect(writes).toHaveLength(1);
  expect(readStl(writes[0].bytes).triangles.length / 3).toBe(4);
  expect(errors.at(-1)).toBeNull();
});
