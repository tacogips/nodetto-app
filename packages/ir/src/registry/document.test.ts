import { expect, test } from "bun:test";
import { TEXT_CODE, TEXT_MARKDOWN } from "./document.ts";
const codes = (value: unknown) =>
  TEXT_CODE.validateSemantic(value, "semantic").map((i) => i.code);
test("snippet semantic validation enforces required fields and limits", () => {
  expect(codes({ code: "", language: "plain" })).toEqual([]);
  expect(codes({ code: "", language: "Rust" })).toContain("type.pattern");
  expect(codes({ language: "plain" })).toContain("field.missing");
  expect(codes({ code: "x".repeat(200001), language: "plain" })).toContain(
    "text.limit",
  );
  expect(codes({ code: "", language: "plain", wrap: "yes" })).toContain(
    "type.boolean",
  );
  expect(
    TEXT_MARKDOWN.validateSemantic({ markdown: "# a" }, "semantic"),
  ).toEqual([]);
  expect(
    TEXT_MARKDOWN.validateSemantic({}, "semantic").map((i) => i.code),
  ).toContain("field.missing");
});
