import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { Batch } from "./edit/batch.ts";

test("registered code snippets are authored through the edit pipeline", () => {
  const editor = new Editor();
  const batch = new Batch(editor);
  batch.apply(
    { op: "add", type: "text.code", id: "code1", semantic: { language: "TS" } },
    0,
  );
  batch.apply({ op: "add", type: "text.code", id: "code2" }, 1);
  expect(editor.store.get("code1")?.semantic).toMatchObject({
    language: "javascript",
    code: "",
  });
  expect(editor.store.get("code2")?.semantic).toMatchObject({
    language: "plain",
    code: "",
  });
  expect(() =>
    batch.apply(
      {
        op: "add",
        type: "text.code",
        id: "code3",
        semantic: { language: "klingon" },
      },
      2,
    ),
  ).toThrow('Unknown language "klingon"');
  batch.dispose();
});
