import { expect, test } from "bun:test";
import { Editor, frameParents } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import type { FrameSemantic } from "@nodetto/ir";
import { Batch } from "./edit/batch.ts";
import { runCli } from "./commands.ts";

function members(editor: Editor, id: string): readonly string[] | undefined {
  return (editor.store.get(id)?.semantic as FrameSemantic).memberIds;
}

test("adding inside a layout frame attaches and lays out the new member", () => {
  const editor = new Editor();
  const first = editor.createElement("shape.geo", {
    visual: { x: 220, y: 30, width: 40, height: 30 },
  });
  const second = editor.createElement("shape.geo", {
    visual: { x: 220, y: 80, width: 40, height: 30 },
  });
  const frame = editor.createElement("frame", {
    semantic: {
      name: "Layout",
      memberIds: [first, second],
      layout: {
        direction: "vertical",
        gap: 8,
        padding: 8,
        sizing: "fixed",
        align: "start",
      },
    },
    visual: { x: 200, y: 0, width: 400, height: 500 },
  });
  const batch = new Batch(editor);
  try {
    batch.apply(
      {
        op: "add",
        id: "third",
        type: "shape.geo",
        visual: { x: 230, y: 160, width: 40, height: 30 },
      },
      0,
    );
    expect(members(editor, frame)).toEqual([first, second, "third"]);
    const a = editor.getBounds(second, editor.createShapeContext());
    const b = editor.getBounds("third", editor.createShapeContext());
    expect(b!.y).toBe(a!.y + a!.height + 8);
  } finally {
    batch.dispose();
  }
});

test("explicit frame placement, member order, reparent, detach and inspect", () => {
  const editor = new Editor();
  const frame = editor.createElement("frame", {
    semantic: {
      name: "Screen",
      memberIds: [],
      platform: "ios",
      safeArea: { top: 47, right: 0, bottom: 34, left: 0 },
    },
    visual: { x: 100, y: 200, width: 390, height: 844 },
  });
  const other = editor.createElement("frame", {
    semantic: { name: "Other", memberIds: [] },
    visual: { x: 600, y: 200, width: 390, height: 844 },
  });
  const batch = new Batch(editor);
  try {
    batch.apply(
      {
        op: "add",
        id: "relative",
        type: "shape.geo",
        parent: frame,
        visual: { x: 16, y: 60, width: 40, height: 30 },
      },
      0,
    );
    expect(editor.store.get("relative")?.visual).toMatchObject({
      x: 116,
      y: 260,
    });
    batch.apply(
      {
        op: "add",
        id: "safe",
        type: "shape.geo",
        parent: frame,
        memberIndex: 0,
        visual: { width: 40, height: 30 },
      },
      1,
    );
    expect(editor.store.get("safe")?.visual).toMatchObject({ x: 100, y: 247 });
    expect(members(editor, frame)).toEqual(["safe", "relative"]);
    const io = {
      readText: () => serializeDocument(editor.getSnapshot()),
      writeText: () => {},
    };
    const outline = runCli(["inspect", "doc.jsonl"], io, "test");
    expect(outline.exitCode).toBe(0);
    expect(outline.stdout).toContain("rel 16,60");
    const json = runCli(
      ["inspect", "doc.jsonl", "--format", "json"],
      io,
      "test",
    );
    expect(json.exitCode).toBe(0);
    const parsed = JSON.parse(json.stdout);
    expect(
      parsed.pages[0].elements.find(
        (element: { id: string }) => element.id === "relative",
      ).rel,
    ).toEqual({ x: 16, y: 60 });
    batch.apply({ op: "update", id: "relative", parent: other }, 2);
    expect(members(editor, other)).toContain("relative");
    batch.apply({ op: "update", id: "relative", parent: null }, 3);
    expect(
      frameParents(
        editor.store,
        editor.currentPageId,
        editor.createShapeContext(),
      ).has("relative"),
    ).toBe(false);
    expect(() =>
      batch.apply({ op: "add", type: "shape.geo", memberIndex: 0 }, 4),
    ).toThrow('"memberIndex" requires "parent"');
  } finally {
    batch.dispose();
  }
});
