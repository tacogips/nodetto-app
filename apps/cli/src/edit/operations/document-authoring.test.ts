import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { Batch } from "../batch.ts";
import { normalizeCodeSnippetSemantic } from "./add.ts";

test("code snippet semantics normalize languages and apply defaults", () => {
  expect(normalizeCodeSnippetSemantic({ language: "TS" }, 0)).toEqual({
    language: "javascript",
    code: "",
  });
  expect(normalizeCodeSnippetSemantic(undefined, 0)).toEqual({
    language: "plain",
    code: "",
  });
  expect(
    normalizeCodeSnippetSemantic(
      { code: "x", language: "rust", lineNumbers: true },
      0,
    ),
  ).toEqual({ code: "x", language: "rust", lineNumbers: true });
  expect(() =>
    normalizeCodeSnippetSemantic({ language: "klingon" }, 2),
  ).toThrow('Unknown language "klingon". Choose one of:');
  expect(() => normalizeCodeSnippetSemantic({ language: 3 }, 3)).toThrow(
    "language",
  );
  expect(normalizeCodeSnippetSemantic("unchanged", 0)).toBe("unchanged");
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
