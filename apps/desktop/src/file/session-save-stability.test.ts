import { expect, spyOn, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { decodeRasterDataUrl } from "@nodetto/ir";
import {
  addShape,
  createHarness,
  type Harness,
} from "./session-test-helpers.ts";

const path = "/docs/widgets.jsonl";
const png = "data:image/png;base64,iVBORw0KGgo=";

async function drain(): Promise<void> {
  for (let i = 0; i < 1200; i += 1) await Promise.resolve();
}

async function opened(images = true): Promise<Harness> {
  const source = new Editor();
  if (images) {
    for (let page = 0; page < 4; page += 1) {
      if (page > 0) source.createPage({ name: `Images ${page}` });
      for (let i = 0; i < 40; i += 1) {
        source.createElement("image.raster", {
          semantic: {
            src: `thumbs/widget-${page * 40 + i}.png`,
            alt: "Widget",
          },
        });
      }
    }
    source.createPage({ name: "Shapes" });
  }
  const h = createHarness({ seeded: false });
  h.backend.readAttachment = async () => decodeRasterDataUrl(png).bytes;
  h.backend.storeAttachment = async () => "artifacts/copied.png";
  h.backend.files.set(path, serializeDocument(source.getSnapshot()));
  expect(await h.session.openPath(path)).toBe(true);
  await drain();
  return h;
}

function external(h: Harness, label: string): string {
  const editor = new Editor({
    document: parseDocument(`${h.backend.files.get(path)}`),
  });
  const pages = editor.store.listPages();
  const last = pages[pages.length - 1];
  if (last) editor.setCurrentPage(last.id);
  addShape(editor, label);
  const text = serializeDocument(editor.getSnapshot());
  h.backend.files.set(path, text);
  h.backend.emitFileChanged(path);
  return text;
}

function imageLines(text: string): string[] {
  return text.split("\n").filter((line) => line.includes("thumbs/"));
}

test("clean external changes across many images do not save or store", async () => {
  const h = await opened();
  let reads = 0;
  let stores = 0;
  h.backend.readAttachment = async () => {
    reads += 1;
    return decodeRasterDataUrl(png).bytes;
  };
  h.backend.storeAttachment = async () => {
    stores += 1;
    return "artifacts/copied.png";
  };
  external(h, "outside one");
  await drain();
  h.timers.fire();
  await drain();
  external(h, "outside two");
  await drain();
  const readsAfterHydration = reads;
  h.timers.fire();
  await drain();
  expect(h.backend.writes).toHaveLength(0);
  expect(stores).toBe(0);
  expect(reads).toBe(readsAfterHydration);
  expect(h.session.state().dirty).toBe(false);
  expect(
    h.editor.store
      .listElements()
      .some((e) => (e.semantic as { label?: string }).label === "outside two"),
  ).toBe(true);
});

test("merged local edit preserves all image lines", async () => {
  const h = await opened();
  let stores = 0;
  h.backend.storeAttachment = async () => {
    stores += 1;
    return "artifacts/copied.png";
  };
  addShape(h.editor, "local");
  const disk = external(h, "outside");
  await drain();
  h.timers.fire();
  await drain();
  expect(h.backend.writes).toHaveLength(1);
  const written = h.backend.writes[0]?.contents ?? "";
  expect(imageLines(written)).toEqual(imageLines(disk));
  expect(written).not.toContain("artifacts/");
  expect(stores).toBe(0);
});

test("noncanonical image line survives external then local edits", async () => {
  const h = await opened();
  const original = `${h.backend.files.get(path)}`;
  const line = imageLines(original)[0] ?? "";
  const raw = line.replace('{"kind":', '{  "kind":');
  h.backend.files.set(path, original.replace(line, raw));
  await h.session.openPath(path);
  await drain();
  const other = new Editor({ document: parseDocument(original) });
  addShape(other, "outside");
  const disk = serializeDocument(other.getSnapshot()).replace(line, raw);
  h.backend.files.set(path, disk);
  h.backend.emitFileChanged(path);
  await drain();
  addShape(h.editor, "local");
  h.timers.fire();
  await drain();
  expect(h.backend.writes[0]?.contents).toContain(raw);
});

test("edit and undo makes autosave and flush no-ops", async () => {
  const h = await opened(false);
  addShape(h.editor, "temporary");
  h.editor.undo();
  h.timers.fire();
  await drain();
  expect(h.backend.writes).toHaveLength(0);
  expect(h.session.state().dirty).toBe(false);
  const second = await opened(false);
  addShape(second.editor, "temporary");
  second.editor.undo();
  expect(await second.session.flush()).toBe(true);
  expect(second.backend.writes).toHaveLength(0);
  expect(second.session.state().dirty).toBe(false);
});

test("keeping a conflict still overwrites on autosave", async () => {
  const h = await opened(false);
  const mine = `${h.backend.files.get(path)}`;
  h.backend.files.set(path, '{"kind":"document"}\n');
  h.backend.emitFileChanged(path);
  await drain();
  expect(await h.session.resolveConflict("keep")).toBe(true);
  h.timers.fire();
  await drain();
  expect(h.backend.files.get(path)).toBe(mine);
  expect(h.backend.writes).toHaveLength(1);
});

async function preparing(): Promise<{ h: Harness; release: () => void }> {
  const source = new Editor();
  source.createElement("image.raster", {
    semantic: { src: png, alt: "Widget" },
  });
  const h = createHarness({ seeded: false });
  h.backend.files.set(path, serializeDocument(source.getSnapshot()));
  expect(await h.session.openPath(path)).toBe(true);
  let release = () => {};
  let held = false;
  h.backend.storeAttachment = async () => {
    if (!held) {
      held = true;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    return "artifacts/copied.png";
  };
  addShape(h.editor, "local");
  h.timers.fire();
  await drain();
  return { h, release };
}

test("outside edit during attachment preparation enters the first write", async () => {
  const { h, release } = await preparing();
  external(h, "outside");
  await drain();
  release();
  await drain();
  expect(h.backend.writes[0]?.contents).toContain("outside");
  expect(h.session.state().conflict).toBeNull();
});

test("switching documents during preparation prevents writing", async () => {
  const { h, release } = await preparing();
  await h.session.newDocument();
  release();
  await drain();
  expect(h.backend.writes).toHaveLength(0);
});

test("Save As reports copies and clears them on local edit", async () => {
  const h = await opened();
  h.backend.readAttachment = async (documentPath) => {
    if (documentPath !== path) throw new Error("missing");
    return decodeRasterDataUrl(png).bytes;
  };
  h.backend.saveAnswers.push("/copy/widgets.jsonl");
  expect(await h.session.saveAs()).toBe(true);
  expect(h.session.state().copiedAttachments).toHaveLength(160);
  addShape(h.editor, "local");
  expect(h.session.state().copiedAttachments).toHaveLength(0);
});

test("Save As retains a relative image present at destination", async () => {
  const h = await opened();
  h.backend.readAttachment = async () => decodeRasterDataUrl(png).bytes;
  h.backend.saveAnswers.push("/copy/widgets.jsonl");
  expect(await h.session.saveAs()).toBe(true);
  expect(h.session.state().copiedAttachments).toHaveLength(0);
  expect(h.backend.files.get("/copy/widgets.jsonl")).toContain(
    "thumbs/widget-0.png",
  );
});

test("derived reconciliation runs for merges but not clean reloads", async () => {
  const h = await opened(false);
  const reconcile = spyOn(h.editor, "reconcileDerivedState");
  external(h, "clean outside");
  await drain();
  expect(reconcile).not.toHaveBeenCalled();
  addShape(h.editor, "local");
  external(h, "merged outside");
  await drain();
  expect(reconcile).toHaveBeenCalled();
  reconcile.mockRestore();
});
