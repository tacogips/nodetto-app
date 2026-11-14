import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { decodeRasterDataUrl, type ImageSemantic } from "@nodetto/ir";
import { parseDocument } from "@nodetto/io";
import type { FileBackend } from "./backend.ts";
import { DocumentSession } from "./session.ts";
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const reference = "artifacts/fixture.png";
function backend() {
  const files = new Map<string, string>();
  const attachments = new Map<string, Uint8Array>();
  const events: string[] = [];
  const host: FileBackend = {
    available: true,
    pickOpenPath: async () => null,
    pickSavePath: async () => "/first/design.jsonl",
    readDocument: async (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error("missing document");
      return value;
    },
    writeDocument: async (path, text) => {
      events.push("document");
      files.set(path, text);
    },
    storeAttachment: async (path, _extension, bytes) => {
      events.push("asset");
      attachments.set(`${path}:${reference}`, bytes);
      return reference;
    },
    readAttachment: async (path, relative) => {
      const value = attachments.get(`${path}:${relative}`);
      if (!value) throw new Error("missing attachment");
      return value;
    },
    listRecent: async () => [],
    addRecent: async () => [],
    removeRecent: async () => [],
    watch: async () => {},
    unwatch: async () => {},
    onFileChanged: () => () => {},
  };
  return { host, files, attachments, events };
}
test("first save externalizes image bytes before JSONL and reopen resolves them without changing the document", async () => {
  const { host, files, events } = backend();
  const editor = new Editor();
  const id = editor.createElement("image.raster", {
    semantic: { src: PNG, alt: "Example" },
  });
  const session = new DocumentSession({
    editor,
    backend: host,
    saveMode: "manual",
  });
  const undo = editor.history.undoSize;
  expect(await session.save()).toBe(true);
  expect(events).toEqual(["asset", "document"]);
  const written = files.get("/first/design.jsonl")!;
  expect(written).not.toContain("data:image");
  expect(
    (parseDocument(written).elements[0]?.semantic as ImageSemantic).src,
  ).toBe(reference);
  expect(editor.assets.resolve(reference)).toBe(PNG);
  expect(editor.exportPageSvg()).toContain(PNG);
  expect(editor.history.undoSize).toBe(undo);
  expect(session.state().dirty).toBe(false);
  const reopened = new Editor();
  const second = new DocumentSession({
    editor: reopened,
    backend: host,
    saveMode: "manual",
  });
  expect(await second.openPath("/first/design.jsonl")).toBe(true);
  expect(reopened.assets.resolve(reference)).toBe(PNG);
  expect((reopened.store.get(id)?.semantic as ImageSemantic).src).toBe(
    reference,
  );
  expect(second.state().dirty).toBe(false);
  session.dispose();
  second.dispose();
});
test("Save As copies required bytes to another directory while preserving the source document", async () => {
  const { host, files, attachments } = backend();
  const editor = new Editor();
  editor.createElement("image.raster", {
    semantic: { src: PNG, alt: "Example" },
  });
  const session = new DocumentSession({
    editor,
    backend: host,
    saveMode: "manual",
  });
  await session.save();
  const before = files.get("/first/design.jsonl");
  host.pickSavePath = async () => "/second/copy.jsonl";
  expect(await session.saveAs()).toBe(true);
  expect(attachments.get(`/second/copy.jsonl:${reference}`)).toEqual(
    decodeRasterDataUrl(PNG).bytes,
  );
  expect(files.get("/first/design.jsonl")).toBe(before);
  expect(session.state().filePath).toBe("/second/copy.jsonl");
  session.dispose();
});
test("missing assets keep valid documents open but prevent saving a broken copy", async () => {
  const { host, files, events } = backend();
  const source = new Editor();
  source.createElement("image.raster", {
    semantic: { src: reference, alt: "Missing" },
  });
  const { serializeDocument } = await import("@nodetto/io");
  files.set("/source.jsonl", serializeDocument(source.getSnapshot()));
  const editor = new Editor();
  const session = new DocumentSession({
    editor,
    backend: host,
    saveMode: "manual",
  });
  expect(await session.openPath("/source.jsonl")).toBe(true);
  expect(session.state().error).toContain("missing attachment");
  expect(await session.saveAs()).toBe(false);
  expect(events).toEqual([]);
  expect(files.has("/first/design.jsonl")).toBe(false);
  session.dispose();
});
test("failed attachment writes never publish JSONL or replace embedded editor semantics", async () => {
  const { host, files } = backend();
  host.storeAttachment = async () => {
    throw new Error("disk full");
  };
  const editor = new Editor();
  const id = editor.createElement("image.raster", {
    semantic: { src: PNG, alt: "Example" },
  });
  const session = new DocumentSession({
    editor,
    backend: host,
    saveMode: "manual",
  });
  expect(await session.save()).toBe(false);
  expect(files.size).toBe(0);
  expect((editor.store.get(id)?.semantic as ImageSemantic).src).toBe(PNG);
  expect(session.state().error).toContain("disk full");
  session.dispose();
});
test("a document switch during asset preparation retires the pending JSONL write", async () => {
  const { host, files } = backend();
  let finish: (value: string) => void = () => {};
  host.storeAttachment = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const editor = new Editor();
  editor.createElement("image.raster", {
    semantic: { src: PNG, alt: "Example" },
  });
  const session = new DocumentSession({
    editor,
    backend: host,
    saveMode: "manual",
  });
  const saving = session.save();
  await Promise.resolve();
  await Promise.resolve();
  await session.newDocument();
  finish(reference);
  expect(await saving).toBe(false);
  expect(files.size).toBe(0);
  expect(editor.assets.resolve(reference)).toBeUndefined();
  session.dispose();
});

test("same-directory save preserves relative images and stores embedded images", async () => {
  const { host, files, events } = backend();
  const source = new Editor();
  source.createElement("image.raster", {
    semantic: { src: "thumbs/widget-1.png", alt: "Widget" },
  });
  const { serializeDocument } = await import("@nodetto/io");
  files.set("/first/design.jsonl", serializeDocument(source.getSnapshot()));
  const editor = new Editor();
  const session = new DocumentSession({
    editor,
    backend: host,
    saveMode: "manual",
  });
  expect(await session.openPath("/first/design.jsonl")).toBe(true);
  editor.createElement("image.raster", {
    semantic: { src: PNG, alt: "Embedded" },
  });
  expect(await session.save()).toBe(true);
  expect(events).toEqual(["asset", "document"]);
  const written = files.get("/first/design.jsonl");
  expect(written).toBeDefined();
  expect(written).toContain("thumbs/widget-1.png");
  expect(written).not.toContain("data:image");
  session.dispose();
});

test("attachment preparation follows the save decision table", async () => {
  const { prepareDocumentAttachments } = await import("./attachments.ts");
  const src = "thumbs/widget-1.png";
  const bytes = decodeRasterDataUrl(PNG).bytes;
  const make = (count = 1) => {
    const editor = new Editor();
    for (let i = 0; i < count; i++)
      editor.createElement("image.raster", {
        semantic: { src, alt: "Widget" },
      });
    return editor;
  };
  const source = "/first/design.jsonl";
  const destination = "/second/design.jsonl";
  const sources = (
    result: Awaited<ReturnType<typeof prepareDocumentAttachments>>,
  ) =>
    result.document.elements.map(
      (element) => (element.semantic as ImageSemantic).src,
    );

  {
    const editor = make(3);
    const { host } = backend();
    let reads = 0;
    let stores = 0;
    host.readAttachment = async () => {
      reads++;
      throw new Error("unexpected read");
    };
    host.storeAttachment = async () => {
      stores++;
      throw new Error("unexpected store");
    };
    const result = await prepareDocumentAttachments(
      editor,
      editor.getSnapshot(),
      host,
      "/first/copy.jsonl",
      source,
    );
    expect(sources(result)).toEqual([src, src, src]);
    expect(result.changes).toEqual([]);
    expect(result.copied).toEqual([]);
    host.storeAttachment = undefined;
    const missing = await prepareDocumentAttachments(
      editor,
      editor.getSnapshot(),
      host,
      source,
      source,
    );
    expect(sources(missing)).toEqual([src, src, src]);
    const bare = await prepareDocumentAttachments(
      editor,
      editor.getSnapshot(),
      host,
      "copy.jsonl",
      "design.jsonl",
    );
    expect(sources(bare)).toEqual([src, src, src]);
    expect(reads).toBe(0);
    expect(stores).toBe(0);
  }
  {
    const editor = make();
    const { host } = backend();
    await expect(
      prepareDocumentAttachments(
        editor,
        editor.getSnapshot(),
        host,
        destination,
        null,
      ),
    ).rejects.toThrow("Missing attachment");
    editor.assets.set(src, PNG);
    const result = await prepareDocumentAttachments(
      editor,
      editor.getSnapshot(),
      host,
      destination,
      null,
    );
    expect(sources(result)).toEqual([reference]);
    expect(result.copied).toEqual([]);
  }
  for (const sourceAvailable of [true, false]) {
    const editor = make();
    const { host, attachments, events } = backend();
    if (sourceAvailable) attachments.set(`${source}:${src}`, bytes);
    attachments.set(`${destination}:${src}`, bytes);
    const result = await prepareDocumentAttachments(
      editor,
      editor.getSnapshot(),
      host,
      destination,
      source,
    );
    expect(sources(result)).toEqual([src]);
    expect(result.resolved.get(src)).toBe(PNG);
    expect(result.copied).toEqual([]);
    expect(events).toEqual([]);
  }
  for (const destinationAvailable of [true, false]) {
    const editor = make(2);
    const { host, attachments, events } = backend();
    attachments.set(`${source}:${src}`, bytes);
    if (destinationAvailable)
      attachments.set(`${destination}:${src}`, new Uint8Array([...bytes, 1]));
    const result = await prepareDocumentAttachments(
      editor,
      editor.getSnapshot(),
      host,
      destination,
      source,
    );
    expect(sources(result)).toEqual([reference, reference]);
    expect(result.copied).toEqual([{ from: src, to: reference }]);
    expect(result.changes).toHaveLength(2);
    expect(events).toEqual(["asset"]);
  }
  {
    const editor = make();
    const { host, attachments } = backend();
    await expect(
      prepareDocumentAttachments(
        editor,
        editor.getSnapshot(),
        host,
        destination,
        source,
      ),
    ).rejects.toThrow("Missing attachment");
    attachments.set(`${source}:${src}`, bytes);
    host.storeAttachment = undefined;
    await expect(
      prepareDocumentAttachments(
        editor,
        editor.getSnapshot(),
        host,
        destination,
        source,
      ),
    ).rejects.toThrow("cannot save document attachments");
  }
  {
    const editor = new Editor();
    editor.createElement("image.raster", {
      semantic: { src: PNG, alt: "Embedded" },
    });
    const { host } = backend();
    host.storeAttachment = undefined;
    const result = await prepareDocumentAttachments(
      editor,
      editor.getSnapshot(),
      host,
      destination,
      null,
    );
    expect(sources(result)).toEqual([PNG]);
    expect(result.copied).toEqual([]);
  }
  {
    const editor = new Editor();
    editor.createElement("image.raster", {
      semantic: { src: reference, alt: "Widget" },
    });
    editor.assets.set(reference, PNG);
    const { host } = backend();
    const result = await prepareDocumentAttachments(
      editor,
      editor.getSnapshot(),
      host,
      destination,
      source,
    );
    expect(result.copied).toEqual([{ from: reference, to: reference }]);
  }
});
