import { expect, test } from "bun:test";
import * as Y from "yjs";
import { peer, Wire } from "./binding-test-helpers.ts";
import { erdDocument } from "./test-fixtures.ts";
import { applyIrToDoc, ydocToIr } from "./ydoc.ts";

test("slide fields round trip and malformed values are omitted", () => {
  const base = erdDocument();
  const page = base.pages[0];
  if (!page) throw new Error("missing fixture page");
  const doc = new Y.Doc();
  applyIrToDoc(doc, {
    ...base,
    slideSize: { width: 1920, height: 1080 },
    pages: [{ ...page, slideOrigin: { x: 10, y: -20 } }],
  });
  expect(ydocToIr(doc).slideSize).toEqual({ width: 1920, height: 1080 });
  expect(ydocToIr(doc).pages[0]?.slideOrigin).toEqual({ x: 10, y: -20 });
  const meta = doc.getMap("meta");
  meta.set("slideSize", "x");
  const map = doc.getMap("pages").get(page.id);
  if (!(map instanceof Y.Map)) throw new Error("missing page map");
  map.set("slideOrigin", { x: "a" });
  expect(ydocToIr(doc)).not.toHaveProperty("slideSize");
  expect(ydocToIr(doc).pages[0]).not.toHaveProperty("slideOrigin");
  applyIrToDoc(doc, base);
  expect(meta.has("slideSize")).toBe(false);
  expect(ydocToIr(doc)).not.toHaveProperty("slideSize");
  expect(ydocToIr(doc).pages[0]).not.toHaveProperty("slideOrigin");
});

test("binding shares size updates, removals, and page origins", () => {
  const wire = new Wire();
  const a = peer(wire, erdDocument());
  a.binding.attach();
  const b = peer(wire);
  b.binding.attach();
  wire.flush();
  const id = a.editor.getSnapshot().pages[0]?.id;
  if (!id) throw new Error("missing page");
  a.editor.apply([
    {
      type: "updateDocument",
      document: { slideSize: { width: 800, height: 600 } },
    },
  ]);
  wire.flush();
  expect(b.editor.store.getMeta().slideSize).toEqual({
    width: 800,
    height: 600,
  });
  a.editor.apply([{ type: "updateDocument", document: { slideSize: null } }]);
  wire.flush();
  expect(b.editor.store.getMeta()).not.toHaveProperty("slideSize");
  expect(b.doc.getMap("meta").has("slideSize")).toBe(false);
  a.editor.apply([
    { type: "updatePage", id, page: { slideOrigin: { x: 10, y: 20 } } },
  ]);
  wire.flush();
  expect(b.editor.store.getPage(id)?.slideOrigin).toEqual({ x: 10, y: 20 });
  a.binding.detach();
  b.binding.detach();
});
