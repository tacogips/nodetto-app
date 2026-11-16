import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { Batch } from "../batch.ts";

test("code add normalizes languages and applies defaults", () => {
  const editor = new Editor();
  const batch = new Batch(editor);
  batch.apply(
    { op: "add", type: "text.code", id: "code1", semantic: { language: "TS" } },
    0,
  );
  expect(editor.store.get("code1")?.semantic).toMatchObject({
    language: "typescript",
    code: "",
  });
  batch.apply({ op: "add", type: "text.code", id: "code2" }, 1);
  expect(editor.store.get("code2")?.semantic).toMatchObject({
    language: "plain",
    code: "",
  });
  expect(() =>
    batch.apply(
      { op: "add", type: "text.code", semantic: { language: "klingon" } },
      2,
    ),
  ).toThrow('Unknown language "klingon"');
  expect(() =>
    batch.apply({ op: "add", type: "text.code", semantic: { language: 3 } }, 3),
  ).toThrow("language");
  batch.dispose();
});

test("page flow sets horizontal and removes vertical or null", () => {
  const editor = new Editor();
  const batch = new Batch(editor);
  const page = editor.store.listPages()[0]!;
  const flow = (value: "horizontal" | "vertical" | null) =>
    batch.apply({ op: "set-page-flow", page: page.id, flow: value }, 0);
  flow("horizontal");
  expect(editor.store.listPages()[0]?.pageFlow).toBe("horizontal");
  flow("vertical");
  expect(editor.store.listPages()[0]).not.toHaveProperty("pageFlow");
  flow("horizontal");
  flow(null);
  expect(editor.store.listPages()[0]).not.toHaveProperty("pageFlow");
  expect(() =>
    batch.apply({ op: "set-page-flow", page: page.id, flow: "diagonal" }, 0),
  ).toThrow('"flow" must be vertical, horizontal or null');
  expect(() =>
    batch.apply({ op: "set-page-flow", page: "missing-page", flow: null }, 0),
  ).toThrow("missing-page");
  expect(() =>
    batch.apply(
      { op: "set-page-flow", page: page.id, flow: null, extra: true },
      0,
    ),
  ).toThrow('unknown field "extra"');
  batch.dispose();
});
