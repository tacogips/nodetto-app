import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { Batch } from "./edit/batch.ts";

test("frame carries members by default and can leave them in place", () => {
  for (const carry of [undefined, false]) {
    const editor = new Editor();
    const frame = editor.createElement("frame", {
      visual: { x: 0, y: 0, width: 500, height: 500 },
    });
    const node = editor.createElement("node.generic", {
      visual: { x: 50, y: 50, width: 80, height: 50 },
    });
    const batch = new Batch(editor);
    batch.apply({ op: "update", id: node, visual: { x: 60 } }, 0);
    batch.apply(
      {
        op: "update",
        id: frame,
        visual: { x: 100 },
        ...(carry === false ? { carryMembers: false } : {}),
      },
      1,
    );
    expect(editor.store.get(node)?.visual.x).toBe(carry === false ? 60 : 160);
    expect(() =>
      batch.apply(
        { op: "update", id: node, visual: {}, carryMembers: false },
        2,
      ),
    ).toThrow("carryMembers applies only to frames");
    expect(() =>
      batch.apply(
        { op: "update", id: frame, visual: {}, carryMembers: "no" },
        2,
      ),
    ).toThrow('"carryMembers" must be true or false');
  }
});
