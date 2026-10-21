import { expect, test } from "bun:test";
import * as Y from "yjs";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { irToYDoc, ydocToIr } from "./ydoc.ts";

test("state nodes and transitions synchronize between Yjs documents", () => {
  const editor = new Editor();
  editor.setPageKind(editor.currentPageId, "state");
  const a = editor.createElement("state.node");
  const b = editor.createElement("state.node", { visual: { x: 300 } });
  const edge = editor.connectSmart(a, b)!;
  editor.apply([
    {
      type: "updateSemantic",
      id: edge,
      semantic: {
        from: a,
        to: b,
        trigger: "start",
        guard: "ready",
        effect: "run()",
      },
    },
  ]);
  const source = irToYDoc(editor.getSnapshot());
  const remote = new Y.Doc();
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(source));
  expect(serializeDocument(ydocToIr(remote))).toBe(
    serializeDocument(editor.getSnapshot()),
  );
  source.destroy();
  remote.destroy();
});
