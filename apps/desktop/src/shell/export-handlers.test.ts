import {
  boardReference,
  edge,
  PCB_TEST_PAGE,
  testBoard,
} from "../../../../packages/core/src/cad/testing/pcb.ts";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { capturePlateDocument } from "../../../../packages/core/src/capture/testing/plate.ts";
import { createManifoldKernel } from "@nodetto/cad-kernel";
import {
  type CadEngine,
  type CadEngineInput,
  createCadEngineClient,
  collectCadInput,
  DEFAULT_CAD_INTERFERENCE,
  Editor,
  extractPdfText,
  prepareCadCapture,
} from "@nodetto/core";
import { stlToInlineMesh } from "@nodetto/io/cad-mesh";
import { decodeCaptureMesh } from "@nodetto/io/nmesh";
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
  expect(errors.at(-1)).toContain("STL saved. 1 feature has issues");

  const sketch = editor.createElement("cad.sketch");
  editor.createElement("cad.extrude", {
    semantic: { name: "Incomplete extrusion", sketch, op: "new", distance: 2 },
  });
  await handlers.exportStl();
  expect(picked).toHaveLength(2);
  expect(writes).toHaveLength(2);
  expect(writes.at(-1)?.bytes).toEqual(writes[0].bytes);
  expect(errors.at(-1)).toContain("STL saved. 2 features have issues");
});

test("CAD image capture saves PNG and JPG and reports interference and empty bodies", async () => {
  const editor = new Editor();
  const page = editor.createPage({ kind: "cad3d", name: "Capture plate" });
  const data = stlToInlineMesh(writeBinaryStl([openTriangle]));
  editor.createElement("cad.mesh", { semantic: { name: "First", data } });
  editor.createElement("cad.mesh", { semantic: { name: "Second", data } });
  const requests: { scene: Uint8Array; format: string; quality: number }[] = [];
  const writes: { path: string; bytes: Uint8Array }[] = [];
  const picks: [string, string][] = [];
  const notes: (string | null)[] = [];
  const image = Uint8Array.of(1, 2, 3);
  const report = JSON.stringify({
    width: 1024,
    height: 768,
    bodies: [
      { state: "empty", emptiedByStep: 0, open: false },
      { state: "drawn", emptiedByStep: -1, open: false },
    ],
    analysis: {
      cell: 0.25,
      candidates: 1,
      checked: 1,
      unchecked: [],
      uncheckedCount: 0,
      cappedCount: 1,
      budget: 24000000,
      cappedWithoutHit: [],
    },
    pairs: [
      {
        a: 0,
        b: 1,
        volume: 1,
        min: [0, 0, 0],
        max: [1, 1, 1],
        source: "analysis",
        capped: true,
      },
    ],
  });
  const backend: ExportBackend = {
    available: true,
    async pickExportPath(name, extension) {
      picks.push([name, extension]);
      return `/out/${name}`;
    },
    async writeBytes(path, bytes) {
      writes.push({ path, bytes });
    },
    async writeText() {
      throw new Error("unexpected writeText");
    },
    async captureSolid(scene, format, quality) {
      requests.push({ scene, format, quality });
      return { image, report };
    },
  };
  const handlers = createExportHandlers(
    { editor, exportBackend: backend },
    (note) => notes.push(note),
  );
  const options = {
    camera: { view: "iso" as const },
    width: 1024,
    height: 768,
    theme: "light" as const,
    format: "png" as const,
  };
  await handlers.captureCadImage(options);
  const expected = prepareCadCapture(editor.getSnapshot().elements, page, {
    ...options,
    interference: DEFAULT_CAD_INTERFERENCE,
    decodeMesh: decodeCaptureMesh,
  });
  expect(requests[0].scene).toEqual(expected.scene);
  expect(requests[0]).toMatchObject({ format: "png", quality: 90 });
  expect(picks[0]).toEqual(["Capture plate.png", "png"]);
  expect(writes[0]).toEqual({ path: "/out/Capture plate.png", bytes: image });
  expect(notes.at(-1)).toContain("Image saved.");
  expect(notes.at(-1)).toContain("First x Second");
  expect(notes.at(-1)).toContain(", approximate");
  expect(notes.at(-1)).toContain("leaves no material");
  await handlers.captureCadImage({ ...options, theme: "dark", format: "jpg" });
  expect(requests[1].scene).not.toEqual(requests[0].scene);
  expect(requests[1]).toMatchObject({ format: "jpg", quality: 90 });
  expect(picks[1]).toEqual(["Capture plate.jpg", "jpg"]);
  expect(writes[1]).toEqual({ path: "/out/Capture plate.jpg", bytes: image });
  await handlers.captureCadImage({ ...options, interference: null });
  const disabled = prepareCadCapture(editor.getSnapshot().elements, page, {
    ...options,
    interference: null,
    decodeMesh: decodeCaptureMesh,
  });
  expect(requests[2].scene).toEqual(disabled.scene);
  expect(requests[2].scene).not.toEqual(requests[0].scene);
});

test("CAD capture errors and cancelled save never write", async () => {
  const editor = new Editor();
  editor.createPage({ kind: "cad3d", name: "Empty" });
  const writes: Uint8Array[] = [];
  const notes: (string | null)[] = [];
  let renders = 0;
  let picks = 0;
  const backend: ExportBackend = {
    available: true,
    pickExportPath: async () => {
      picks++;
      return null;
    },
    writeBytes: async (_path, bytes) => {
      writes.push(bytes);
    },
    writeText: async () => {},
    captureSolid: async () => {
      renders++;
      return {
        image: Uint8Array.of(1),
        report: JSON.stringify({
          width: 1024,
          height: 768,
          bodies: [{ state: "drawn", emptiedByStep: -1, open: false }],
          analysis: null,
          pairs: [],
        }),
      };
    },
  };
  const options = {
    camera: { view: "iso" as const },
    width: 1024,
    height: 768,
    theme: "light" as const,
    format: "png" as const,
  };
  const handlers = createExportHandlers(
    { editor, exportBackend: backend },
    (note) => notes.push(note),
  );
  await handlers.captureCadImage(options);
  expect(notes.at(-1)).toContain("could not capture:");
  expect(renders).toBe(0);
  editor.createElement("cad.mesh", {
    semantic: {
      name: "Mesh",
      data: stlToInlineMesh(writeBinaryStl([openTriangle])),
    },
  });
  await handlers.captureCadImage(options);
  expect(renders).toBe(1);
  expect(picks).toBe(1);
  expect(writes).toEqual([]);
  const unavailable = createExportHandlers(
    { editor, exportBackend: { ...backend, captureSolid: undefined } },
    (note) => notes.push(note),
  );
  await unavailable.captureCadImage(options);
  expect(notes.at(-1)).toContain("could not capture:");
  expect(writes).toEqual([]);
  const failing = createExportHandlers(
    {
      editor,
      exportBackend: {
        ...backend,
        captureSolid: async () => {
          throw new Error("render failed");
        },
      },
    },
    (note) => notes.push(note),
  );
  await failing.captureCadImage(options);
  expect(notes.at(-1)).toContain("render failed");
  expect(writes).toEqual([]);
});

test("CAD Plate capture sends the committed default scene", async () => {
  const editor = new Editor();
  editor.loadDocument(capturePlateDocument());
  let scene: Uint8Array | undefined;
  const backend: ExportBackend = {
    available: true,
    pickExportPath: async () => null,
    writeBytes: async () => {},
    writeText: async () => {},
    captureSolid: async (bytes) => {
      scene = bytes;
      return {
        image: Uint8Array.of(1),
        report: JSON.stringify({
          width: 1024,
          height: 768,
          bodies: Array.from({ length: 3 }, () => ({
            state: "drawn",
            emptiedByStep: -1,
            open: false,
          })),
          analysis: null,
          pairs: [],
        }),
      };
    },
  };
  const handlers = createExportHandlers(
    { editor, exportBackend: backend },
    () => {},
  );
  await handlers.captureCadImage({
    camera: { view: "iso" },
    width: 1024,
    height: 768,
    theme: "light",
    format: "png",
  });
  expect(scene).toEqual(
    new Uint8Array(
      readFileSync(
        new URL(
          "../../../cli/src/__fixtures__/capture-plate-default.ncs1",
          import.meta.url,
        ),
      ),
    ),
  );
});

test("CAD mesh-only capture sends the prepared cube scene", async () => {
  const editor = new Editor();
  const page = editor.createPage({ kind: "cad3d", name: "Cube" });
  const cube = {
    positions: Float32Array.of(
      0,
      0,
      0,
      1,
      0,
      0,
      1,
      1,
      0,
      0,
      1,
      0,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      1,
      1,
      0,
      1,
      1,
    ),
    triangles: Uint32Array.of(
      0,
      2,
      1,
      0,
      3,
      2,
      4,
      5,
      6,
      4,
      6,
      7,
      0,
      1,
      5,
      0,
      5,
      4,
      1,
      2,
      6,
      1,
      6,
      5,
      2,
      3,
      7,
      2,
      7,
      6,
      3,
      0,
      4,
      3,
      4,
      7,
    ),
  };
  editor.createElement("cad.mesh", {
    semantic: { name: "Cube", data: stlToInlineMesh(writeBinaryStl([cube])) },
  });
  let scene: Uint8Array | undefined;
  const backend: ExportBackend = {
    available: true,
    pickExportPath: async () => null,
    writeBytes: async () => {},
    writeText: async () => {},
    captureSolid: async (bytes) => {
      scene = bytes;
      return {
        image: Uint8Array.of(1),
        report: JSON.stringify({
          width: 1024,
          height: 768,
          bodies: [{ state: "drawn", emptiedByStep: -1, open: false }],
          analysis: null,
          pairs: [],
        }),
      };
    },
  };
  const options = {
    camera: { view: "iso" as const },
    width: 1024,
    height: 768,
    theme: "light" as const,
    format: "png" as const,
  };
  await createExportHandlers(
    { editor, exportBackend: backend },
    () => {},
  ).captureCadImage(options);
  expect(scene).toEqual(
    prepareCadCapture(editor.getSnapshot().elements, page, {
      ...options,
      interference: DEFAULT_CAD_INTERFERENCE,
      decodeMesh: decodeCaptureMesh,
    }).scene,
  );
});

test("CAD capture follows PCB page kind and undo", async () => {
  const base = capturePlateDocument();
  const editor = new Editor({
    document: {
      ...base,
      pages: [...base.pages, PCB_TEST_PAGE],
      elements: [
        ...base.elements,
        boardReference(),
        testBoard(1.6),
        edge("rim", { kind: "rect", start: [0, 0], end: [20, 10] }),
      ],
    },
  });
  const scenes: Uint8Array[] = [];
  const notes: (string | null)[] = [];
  const backend: ExportBackend = {
    available: true,
    pickExportPath: async () => "/out/image.png",
    writeBytes: async () => {},
    writeText: async () => {},
    captureSolid: async (scene) => {
      scenes.push(scene);
      return {
        image: Uint8Array.of(1),
        report: JSON.stringify({
          width: 1024,
          height: 768,
          bodies: Array.from(
            {
              length:
                editor
                  .getSnapshot()
                  .pages.find((page) => page.id === PCB_TEST_PAGE.id)?.kind ===
                "pcb"
                  ? 4
                  : 3,
            },
            () => ({ state: "drawn", emptiedByStep: -1, open: false }),
          ),
          analysis: null,
          pairs: [],
        }),
      };
    },
  };
  const options = {
    camera: { view: "iso" as const },
    width: 1024,
    height: 768,
    theme: "light" as const,
    format: "png" as const,
  };
  const handlers = createExportHandlers(
    { editor, exportBackend: backend },
    (note) => notes.push(note),
  );
  editor.setPageKind(PCB_TEST_PAGE.id, "freeform");
  const expected = () =>
    prepareCadCapture(
      collectCadInput(editor.getSnapshot(), "cad", editor.revision).elements,
      "cad",
      {
        ...options,
        interference: DEFAULT_CAD_INTERFERENCE,
        decodeMesh: decodeCaptureMesh,
      },
    );
  const missing = expected();
  expect(missing.model.errors).toContainEqual(
    expect.objectContaining({
      id: "board-reference",
      code: "cad.reference.missing",
    }),
  );
  expect(
    missing.model.bodies.some((body) => body.id === "board-reference"),
  ).toBe(false);
  await handlers.captureCadImage(options);
  expect(scenes.at(-1)).toEqual(missing.scene);
  expect(notes.at(-1)).toContain(
    `${missing.model.errors.length} features failed`,
  );
  editor.undo();
  const restored = expected();
  expect(
    restored.model.bodies.some((body) => body.id === "board-reference"),
  ).toBe(true);
  await handlers.captureCadImage(options);
  expect(scenes.at(-1)).toEqual(restored.scene);
});

test.each(["width", "height", "bodies"] as const)(
  "CAD capture rejects mismatched report %s before saving",
  async (field) => {
    const editor = new Editor();
    editor.createPage({ kind: "cad3d", name: "Capture" });
    editor.createElement("cad.mesh", {
      semantic: {
        name: "Mesh",
        data: stlToInlineMesh(writeBinaryStl([openTriangle])),
      },
    });
    let picks = 0;
    let writes = 0;
    const notes: (string | null)[] = [];
    const backend: ExportBackend = {
      available: true,
      pickExportPath: async () => {
        picks++;
        return "/out/image.png";
      },
      writeBytes: async () => {
        writes++;
      },
      writeText: async () => {},
      captureSolid: async () => ({
        image: Uint8Array.of(1),
        report: JSON.stringify({
          width: field === "width" ? 1025 : 1024,
          height: field === "height" ? 769 : 768,
          bodies: Array.from({ length: field === "bodies" ? 2 : 1 }, () => ({
            state: "drawn",
            emptiedByStep: -1,
            open: false,
          })),
          analysis: null,
          pairs: [],
        }),
      }),
    };
    await createExportHandlers({ editor, exportBackend: backend }, (note) =>
      notes.push(note),
    ).captureCadImage({
      camera: { view: "iso" },
      width: 1024,
      height: 768,
      theme: "light",
      format: "png",
    });
    expect(notes.at(-1)).toBe(
      "could not capture: The solid capture report does not match the requested scene.",
    );
    expect(picks).toBe(0);
    expect(writes).toBe(0);
  },
);
