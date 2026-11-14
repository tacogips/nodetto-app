import { expect, test } from "bun:test";
import { erdColumnKey } from "@nodetto/core";
import type { ErdColumn, ErdTableSemantic } from "@nodetto/ir";
import { erdRowHighlighted } from "./shapes/erd-row-highlight.ts";

test("ERD column badges prioritize primary, unique and ordinary indexes", () => {
  const semantic: ErdTableSemantic = {
    tableName: "users",
    columns: [
      { id: "id", name: "id", dataType: "uuid", pk: true },
      { id: "email", name: "email", dataType: "text" },
      { id: "created", name: "created_at", dataType: "timestamp" },
      { id: "plain", name: "name", dataType: "text" },
    ],
    indexes: [
      { id: "email-uq", columns: ["email"], unique: true },
      { id: "timeline", columns: ["created", "email"] },
    ],
  };
  expect(
    semantic.columns.map((column) => erdColumnKey(semantic, column)),
  ).toEqual(["PK", "UQ", "IX", ""]);
});

test("ERD row highlighting matches the highlighted column id", () => {
  const column: ErdColumn = { id: "email", name: "email", dataType: "text" };
  expect(erdRowHighlighted(new Set(["email"]), column)).toBe(true);
  expect(erdRowHighlighted(new Set(["id"]), column)).toBe(false);
  expect(erdRowHighlighted(undefined, column)).toBe(false);
  expect(erdRowHighlighted(new Set(), column)).toBe(false);
});
