import { expect, test } from "bun:test";
import * as Y from "yjs";
import { peer, Wire } from "./binding-test-helpers.ts";
import { erdDocument } from "./test-fixtures.ts";
import { applyIrToDoc, ydocToIr } from "./ydoc.ts";
test("page flow survives Y.Doc and invalid values are dropped", () => {
  const base = erdDocument();
  const page = base.pages[0];
  if (!page) throw new Error("missing page");
  const doc = new Y.Doc();
  applyIrToDoc(doc, { ...base, pages: [{ ...page, pageFlow: "vertical" }] });
  expect(ydocToIr(doc).pages[0]?.pageFlow).toBe("vertical");
  const map = doc.getMap("pages").get(page.id);
  if (!(map instanceof Y.Map)) throw new Error("missing page map");
  map.set("pageFlow", "diagonal");
  expect(ydocToIr(doc).pages[0]).not.toHaveProperty("pageFlow");
});
test("page flow changes synchronize across peers", () => {
  const wire = new Wire();
  const a = peer(wire, erdDocument());
  a.binding.attach();
  const b = peer(wire);
  b.binding.attach();
  wire.flush();
  const id = a.editor.getSnapshot().pages[0]?.id;
  if (!id) throw new Error("missing page");
  a.editor.apply([
    { type: "updatePage", id, page: { pageFlow: "horizontal" } },
  ]);
  wire.flush();
  expect(b.editor.store.getPage(id)?.pageFlow).toBe("horizontal");
  a.editor.apply([{ type: "updatePage", id, page: { pageFlow: null } }]);
  wire.flush();
  expect(b.editor.store.getPage(id)).not.toHaveProperty("pageFlow");
  a.binding.detach();
  b.binding.detach();
});

test("frame page metadata survives Y.Doc", () => {
  const base = erdDocument();
  const page = base.pages[0];
  if (!page) throw new Error("missing page");
  const doc = new Y.Doc();
  applyIrToDoc(doc, {
    ...base,
    elements: [
      {
        id: "f",
        page: page.id,
        index: "a0",
        type: "frame",
        semantic: {
          name: "Frame",
          page: { size: "a4", orientation: "portrait" },
        },
        visual: { x: 0, y: 0 },
      },
    ],
  });
  expect(ydocToIr(doc).elements[0]?.semantic).toEqual({
    name: "Frame",
    page: { size: "a4", orientation: "portrait" },
  });
});
