import { expect, test } from "bun:test";
import { snippetViewBox } from "./snippet-view-model.ts";
test("formats the box", () =>
  expect(snippetViewBox({ x: 1, y: 2, width: 3, height: 4 })).toBe("1 2 3 4"));
