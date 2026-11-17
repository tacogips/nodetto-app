import { describe, expect, test } from "bun:test";
import type { StoreDiff } from "./store.ts";
import { document, erdFixture, makeEditor } from "./test-helpers.ts";

function watched() {
  const editor = makeEditor({ document: document(erdFixture()) });
  const seen: { diff: StoreDiff; canUndo: boolean; revision: number }[] = [];
  editor.subscribe((diff) =>
    seen.push({ diff, canUndo: editor.canUndo(), revision: editor.revision }),
  );
  return { editor, seen };
}

describe("editor announcements", () => {
  test("one edit is announced once, with its undo step already in place", () => {
    const { editor, seen } = watched();
    editor.moveElements([{ id: "users", x: 10, y: 10 }]);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.diff.updated).toEqual(["users"]);
    expect(seen[0]?.diff.ephemeral).toBeUndefined();
    expect(seen[0]?.canUndo).toBe(true);
  });

  test("undo and redo are each announced once", () => {
    const { editor, seen } = watched();
    editor.moveElements([{ id: "users", x: 10, y: 10 }]);
    seen.length = 0;
    editor.undo();
    expect(seen.map((entry) => entry.diff.updated)).toEqual([["users"]]);
    editor.redo();
    expect(seen.map((entry) => entry.diff.updated)).toEqual([
      ["users"],
      ["users"],
    ]);
  });

  test("the revision moves once per announcement", () => {
    const { editor, seen } = watched();
    const start = editor.revision;
    editor.moveElements([{ id: "users", x: 10, y: 10 }]);
    editor.moveElements([{ id: "users", x: 20, y: 20 }]);
    expect(seen.map((entry) => entry.revision)).toEqual([start + 1, start + 2]);
  });

  test("closing a batch announces history alone", () => {
    const { editor, seen } = watched();
    editor.beginBatch();
    editor.moveElements([{ id: "users", x: 10, y: 10 }]);
    editor.moveElements([{ id: "users", x: 20, y: 20 }]);
    seen.length = 0;
    editor.endBatch();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.diff.ephemeral).toBe("history");
    expect(seen[0]?.canUndo).toBe(true);
  });

  test("an aborted batch announces the rollback once", () => {
    const { editor, seen } = watched();
    editor.beginBatch();
    editor.moveElements([{ id: "users", x: 10, y: 10 }]);
    seen.length = 0;
    editor.abortBatch();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.diff.updated).toEqual(["users"]);
    expect(editor.store.get("users")?.visual.x).toBe(0);
  });

  test("editor state outside the document is not mistaken for history", () => {
    const { editor, seen } = watched();
    editor.setReadOnly(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.diff.ephemeral).toBeUndefined();
  });

  test("a listener that edits in response is announced separately", () => {
    const { editor, seen } = watched();
    let reacted = false;
    editor.subscribe(() => {
      if (reacted) return;
      reacted = true;
      editor.moveElements([{ id: "orders", x: 500, y: 0 }]);
    });
    editor.moveElements([{ id: "users", x: 10, y: 10 }]);
    expect(seen.map((entry) => entry.diff.updated)).toEqual([
      ["users"],
      ["orders"],
    ]);
  });
});

describe("store diffs", () => {
  test("carry the records a commit replaced or removed", () => {
    const { editor, seen } = watched();
    const before = editor.store.get("users");
    editor.moveElements([{ id: "users", x: 10, y: 10 }]);
    expect(seen[0]?.diff.previous?.get("users")).toBe(before);
    const moved = editor.store.get("users");
    editor.deleteElements(["users"]);
    const removal = seen.at(-1)?.diff;
    expect(removal?.removed).toContain("users");
    expect(removal?.previous?.get("users")).toBe(moved);
  });

  test("the snapshot is reused until the document changes", () => {
    const { editor } = watched();
    const first = editor.getSnapshot();
    expect(editor.getSnapshot()).toBe(first);
    editor.moveElements([{ id: "users", x: 10, y: 10 }]);
    const second = editor.getSnapshot();
    expect(second).not.toBe(first);
    expect(
      second.elements.find((entry) => entry.id === "users")?.visual.x,
    ).toBe(10);
    expect(first.elements.find((entry) => entry.id === "users")?.visual.x).toBe(
      0,
    );
  });
});
