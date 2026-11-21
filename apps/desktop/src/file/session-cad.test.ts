import { expect, test } from "bun:test";
import { parseDocument } from "@nodetto/io";
import { createHarness } from "./session-test-helpers.ts";

test("an untitled document with only a CAD model autosaves", async () => {
  const { backend, editor, session, timers } = createHarness({ seeded: false });
  try {
    backend.autosavePath = async () => "managed-cad.jsonl";
    const page = editor.createPage({ kind: "cad3d", name: "Bracket" });
    editor.setCurrentPage(page);
    const sketch = editor.createElement("cad.sketch");
    const circle = editor.createElement("cad.circle", {
      semantic: { sketch, c: [0, 0], r: 4 },
    });
    const solid = editor.createElement("cad.extrude", {
      semantic: { name: "Boss", sketch, distance: 4, op: "new" },
    });
    expect(session.state().filePath).toBeNull();
    expect(timers.pendingCount).toBe(1);
    expect(await session.flush()).toBe(true);
    expect(session.state().filePath).toBe("managed-cad.jsonl");
    expect(session.state().dirty).toBe(false);
    expect(backend.writes).toHaveLength(1);
    const saved = parseDocument(backend.files.get("managed-cad.jsonl") ?? "");
    expect(saved.elements.map(({ id }) => id).sort()).toEqual(
      [sketch, circle, solid].sort(),
    );
    expect(saved.pages.find(({ id }) => id === page)?.kind).toBe("cad3d");
  } finally {
    session.dispose();
  }
});
