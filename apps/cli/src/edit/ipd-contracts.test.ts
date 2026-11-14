import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { Batch } from "./batch.ts";
import type { JsonObject } from "./operation-input.ts";

function run(operation: JsonObject): string {
  const batch = new Batch(new Editor());
  try {
    batch.apply(operation, 0);
    return "";
  } catch (error) {
    return String(error);
  } finally {
    batch.dispose();
  }
}

test("new edit fields and operations reach their handlers", () => {
  for (const field of [
    "parent",
    "memberIndex",
    "props",
    "sizing",
    "absolute",
  ]) {
    for (const op of ["add", "update"]) {
      const message = run({
        op,
        ...(op === "add" ? { type: "shape.geo" } : {}),
        id: "missing",
        [field]: {},
      });
      expect(message).not.toMatch(/unknown field|unknown op/i);
    }
  }
  for (const op of ["layout", "align", "distribute", "snap"]) {
    expect(run({ op })).not.toMatch(/unknown field|unknown op/i);
  }
});

test("props on a non-kit shape are rejected", () => {
  expect(
    run({ op: "add", type: "shape.geo", semantic: { geo: "rect" }, props: {} }),
  ).toContain("props");
});

test("ordinary add retains explicit coordinates", () => {
  const editor = new Editor();
  const batch = new Batch(editor);
  try {
    batch.apply(
      { op: "add", type: "shape.geo", id: "rect", visual: { x: 10, y: 20 } },
      0,
    );
    expect(editor.store.get("rect")?.visual).toMatchObject({ x: 10, y: 20 });
  } finally {
    batch.dispose();
  }
});

test("unknown update fields still include suggestions", () => {
  const message = run({ op: "update", id: "missing", bogus: 1, visua: {} });
  expect(message).toContain('unknown field "bogus"');
  expect(message).toContain('Did you mean "visual"?');
});
