import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { validateDocument } from "@nodetto/ir";
import { parseDocument } from "./parse.ts";
import { serializeDocument } from "./serialize.ts";

const text = readFileSync(
  new URL("../__fixtures__/table-sheet.jsonl", import.meta.url),
  "utf8",
);
test("table sheet fixture is canonical and valid", () => {
  const doc = parseDocument(text);
  expect(serializeDocument(doc)).toBe(text);
  const issues = validateDocument(doc);
  expect(
    issues.filter(
      (issue) =>
        issue.severity === "error" || issue.code === "semantic.unknownField",
    ),
  ).toEqual([]);
});
test("cell keys serialize in sorted order", () => {
  const reversed = text.replace(
    '"c1":{"align":"center","bold":true,"fill":"#ffeeaa","value":"alpha\\nbeta"},"c2":{"value":5}',
    '"c2":{"value":5},"c1":{"align":"center","bold":true,"fill":"#ffeeaa","value":"alpha\\nbeta"}',
  );
  expect(reversed).not.toBe(text);
  expect(serializeDocument(parseDocument(reversed))).toBe(text);
});
