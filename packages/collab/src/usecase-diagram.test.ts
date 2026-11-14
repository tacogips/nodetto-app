import { expect, test } from "bun:test";
import * as Y from "yjs";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { irToYDoc, ydocToIr } from "./ydoc.ts";

test("use-case nodes, relationships and packages synchronize between Yjs documents", () => {
  const editor = new Editor();
  editor.setPageKind(editor.currentPageId, "uml");
  const system = editor.createElement("usecase.node", {
    semantic: { name: "Lending desk", kind: "system" },
  });
  const actor = editor.createElement("usecase.node", {
    semantic: { name: "Member", kind: "actor" },
    visual: { x: -120 },
  });
  const borrow = editor.createElement("usecase.node", {
    semantic: { name: "Borrow item", kind: "usecase" },
    visual: { x: 40, y: 60 },
  });
  const card = editor.createElement("usecase.node", {
    visual: { x: 40, y: 200 },
  });
  editor.connectSmart(actor, borrow);
  editor.connectUseCase(borrow, card, "include");
  const extend = editor.connectUseCase(card, borrow, "extend")!;
  editor.apply([
    {
      type: "updateSemantic",
      id: extend,
      semantic: { from: card, to: borrow, kind: "extend", label: "on demand" },
    },
  ]);
  editor.createElement("shape.geo", {
    semantic: { geo: "package", label: "Records" },
    visual: { x: 500, width: 200, height: 140 },
  });
  expect(editor.store.get(system)?.visual).toMatchObject({
    width: 400,
    height: 320,
  });
  const source = irToYDoc(editor.getSnapshot());
  const remote = new Y.Doc();
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(source));
  expect(serializeDocument(ydocToIr(remote))).toBe(
    serializeDocument(editor.getSnapshot()),
  );
  expect(
    ydocToIr(remote).elements.filter(
      (element) => element.type === "usecase.relationship",
    ),
  ).toHaveLength(3);
  source.destroy();
  remote.destroy();
});
