import { expect, test } from "bun:test";
import { Editor, encodeDocumentBundle } from "@nodetto/core";
import { parseDocument } from "@nodetto/io";
import { decodeRasterDataUrl, type ImageSemantic } from "@nodetto/ir";
import type { FileBackend } from "./backend.ts";
import { DocumentSession } from "./session.ts";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const PNG_BYTES = decodeRasterDataUrl(PNG).bytes;

function bundleBytes(): Uint8Array {
  const editor = new Editor();
  editor.createElement("image.raster", {
    semantic: { src: "artifacts/logo.png", alt: "Logo" },
  });
  return encodeDocumentBundle(editor.getSnapshot(), () => PNG_BYTES).bytes;
}

function backend(savePath: string | null) {
  const files = new Map<string, string>();
  const stored: { path: string; bytes: Uint8Array }[] = [];
  const prompts: (string | undefined)[] = [];
  const host: FileBackend = {
    available: true,
    pickOpenPath: async () => null,
    pickSavePath: async (name) => {
      prompts.push(name);
      return savePath;
    },
    readDocument: async () => {
      throw new Error("bundles are read as bytes");
    },
    readDocumentBytes: async () => bundleBytes(),
    writeDocument: async (path, text) => {
      files.set(path, text);
    },
    storeAttachment: async (path, extension, bytes) => {
      stored.push({ path, bytes });
      return `artifacts/stored.${extension}`;
    },
    listRecent: async () => [],
    addRecent: async () => [],
    removeRecent: async () => [],
    watch: async () => {},
    unwatch: async () => {},
    onFileChanged: () => () => {},
  };
  return { host, files, stored, prompts };
}

test("opening a bundle asks where to extract and adopts the extracted JSONL", async () => {
  const { host, files, stored, prompts } = backend("/repo/docs/design.jsonl");
  const editor = new Editor();
  const session = new DocumentSession({
    editor,
    backend: host,
    saveMode: "manual",
  });
  expect(await session.openPath("/inbox/design.nodetto")).toBe(true);
  expect(prompts).toEqual(["design.jsonl"]);
  expect(stored).toEqual([
    { path: "/repo/docs/design.jsonl", bytes: PNG_BYTES },
  ]);
  const written = parseDocument(files.get("/repo/docs/design.jsonl") ?? "");
  expect(
    written.elements.map((element) => (element.semantic as ImageSemantic).src),
  ).toEqual(["artifacts/stored.png"]);
  expect(session.state().filePath).toBe("/repo/docs/design.jsonl");
  expect(session.state().dirty).toBe(false);
  session.dispose();
});

test("cancelling extraction keeps the bundle open, unsaved, with its images", async () => {
  const { host, files } = backend(null);
  const editor = new Editor();
  const session = new DocumentSession({
    editor,
    backend: host,
    saveMode: "manual",
  });
  expect(await session.openPath("/inbox/design.nodetto")).toBe(true);
  expect(files.size).toBe(0);
  expect(session.state().filePath).toBeNull();
  expect(session.state().dirty).toBe(true);
  expect(editor.assets.resolve("artifacts/logo.png")).toBe(PNG);
  session.dispose();
});
