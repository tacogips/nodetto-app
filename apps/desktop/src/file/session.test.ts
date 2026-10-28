// The document lifecycle, headless: new documents, saving and autosave.
// Opening, outside changes and overlapping requests have their own
// `session-*.test.ts` files.
//
// The backend is mocked with an in-memory filesystem and the autosave timer
// is driven by hand (see `session-test-helpers.ts`), so every branch —
// debounce, conflict, failed open — runs without a Tauri runtime and without
// waiting on wall-clock time.

import { describe, expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { DocumentSession } from "./session.ts";
import {
  addShape,
  createHarness,
  type Harness,
} from "./session-test-helpers.ts";

describe("a new session", () => {
  test("import detaches the old file and never autosaves imported content over it", async () => {
    const { editor, backend, session, timers } = createHarness();
    const original = serializeDocument(editor.getSnapshot());
    backend.files.set("old.jsonl", original);
    await session.openPath("old.jsonl");
    addShape(editor, "pending old edit");
    const imported = {
      ...editor.getSnapshot(),
      title: "Imported",
      elements: [],
    };
    await session.importDocument(imported, "design.jsonl");
    expect(session.state().filePath).toBeNull();
    expect(session.state().fileName).toBe("design.jsonl");
    expect(session.state().dirty).toBe(true);
    expect(timers.pendingCount).toBe(0);
    expect(backend.files.get("old.jsonl")).toBe(original);
    expect(editor.getSnapshot().title).toBe("Imported");
  });

  test("invalid imports leave the open document and file association untouched", async () => {
    const { editor, backend, session } = createHarness();
    const before = editor.getSnapshot();
    backend.files.set("old.jsonl", serializeDocument(before));
    await session.openPath("old.jsonl");
    await expect(
      session.importDocument({ ...before, schemaVersion: -1 }, "broken.jsonl"),
    ).rejects.toThrow();
    expect(editor.getSnapshot()).toEqual(before);
    expect(session.state().filePath).toBe("old.jsonl");
  });
  test("starts untitled, clean and without a conflict", () => {
    const { session } = createHarness();
    const state = session.state();

    expect(state.filePath).toBeNull();
    expect(state.fileName).toBeNull();
    expect(state.dirty).toBe(false);
    expect(state.conflict).toBeNull();
    expect(state.status).toBe("idle");
  });

  test("marks the document dirty when the editor changes", () => {
    const { editor, session } = createHarness();

    addShape(editor, "one");

    expect(session.state().dirty).toBe(true);
  });

  test("does not autosave an untitled document", () => {
    const { editor, timers } = createHarness();

    addShape(editor, "one");

    expect(timers.pendingCount).toBe(0);
  });

  test("newDocument empties the editor and stays clean", async () => {
    const { editor, session } = createHarness();

    await session.newDocument();

    expect(editor.store.listElements()).toEqual([]);
    expect(session.state().dirty).toBe(false);
    expect(session.state().filePath).toBeNull();
  });
});

describe("saving", () => {
  test("save without a path asks for one and writes there", async () => {
    const { session, backend } = createHarness();
    backend.saveAnswers.push("/docs/a.jsonl");

    const saved = await session.save();

    expect(saved).toBe(true);
    expect(backend.files.has("/docs/a.jsonl")).toBe(true);
    expect(session.state().filePath).toBe("/docs/a.jsonl");
    expect(session.state().fileName).toBe("a.jsonl");
    expect(session.state().dirty).toBe(false);
  });

  test("a cancelled save-as writes nothing", async () => {
    const { session, backend } = createHarness();
    backend.saveAnswers.push(null);

    const saved = await session.save();

    expect(saved).toBe(false);
    expect(backend.writes).toEqual([]);
    expect(session.state().filePath).toBeNull();
  });

  test("save-as records the file as recent and watches it", async () => {
    const { session, backend } = createHarness();
    backend.saveAnswers.push("/docs/a.jsonl");

    await session.save();

    expect(session.state().recent.map((entry) => entry.path)).toEqual([
      "/docs/a.jsonl",
    ]);
    expect(backend.watched).toEqual(["/docs/a.jsonl"]);
  });

  test("a failed write leaves the document dirty and reports it", async () => {
    const { session, backend } = createHarness();
    backend.saveAnswers.push("/docs/a.jsonl");
    backend.failNextWrite("disk full");

    const saved = await session.save();

    expect(saved).toBe(false);
    expect(session.state().error).toContain("disk full");
    expect(session.state().filePath).toBeNull();
  });

  test("concurrent saves are serialized and the last one wins", async () => {
    const { editor, session, backend } = createHarness();
    backend.saveAnswers.push("/docs/a.jsonl");
    await session.save();

    addShape(editor, "one");
    const first = session.save();
    addShape(editor, "two");
    const second = session.save();
    await Promise.all([first, second]);

    expect(backend.writes).toHaveLength(3);
    expect(backend.files.get("/docs/a.jsonl")).toBe(
      serializeDocument(editor.getSnapshot()),
    );
  });
});

describe("autosave", () => {
  async function fileBackedHarness(): Promise<Harness> {
    const harness = createHarness();
    harness.backend.saveAnswers.push("/docs/a.jsonl");
    await harness.session.save();
    return harness;
  }

  test("coalesces rapid edits into a single write", async () => {
    const harness = await fileBackedHarness();
    const before = harness.backend.writes.length;

    addShape(harness.editor, "one");
    addShape(harness.editor, "two");
    addShape(harness.editor, "three");

    expect(harness.timers.pendingCount).toBe(1);
    harness.timers.fire();
    await harness.settle();

    expect(harness.backend.writes.length - before).toBe(1);
    expect(harness.session.state().dirty).toBe(false);
  });

  test("writes the state as of the moment it fires", async () => {
    const harness = await fileBackedHarness();

    addShape(harness.editor, "one");
    harness.timers.fire();
    await harness.settle();

    expect(harness.backend.files.get("/docs/a.jsonl")).toBe(
      serializeDocument(harness.editor.getSnapshot()),
    );
  });

  test("an explicit save cancels the pending autosave", async () => {
    const harness = await fileBackedHarness();
    const before = harness.backend.writes.length;

    addShape(harness.editor, "one");
    await harness.session.save();
    harness.timers.fire();
    await harness.settle();

    expect(harness.backend.writes.length - before).toBe(1);
  });

  test("flush writes a pending autosave immediately", async () => {
    const harness = await fileBackedHarness();
    const before = harness.backend.writes.length;

    addShape(harness.editor, "one");
    const flushed = await harness.session.flush();

    expect(flushed).toBe(true);
    expect(harness.backend.writes.length - before).toBe(1);
    expect(await harness.session.flush()).toBe(false);
  });
});

describe("the save/open round trip", () => {
  test("reopening a saved document reproduces the file byte for byte", async () => {
    const author = createHarness();
    addShape(author.editor, "a rectangle");
    author.backend.saveAnswers.push("/docs/roundtrip.jsonl");
    await author.session.save();
    const onDisk = author.backend.files.get("/docs/roundtrip.jsonl");
    expect(onDisk).toBeDefined();

    const reader = createHarness({ seeded: false });
    reader.backend.files.set("/docs/roundtrip.jsonl", onDisk as string);
    const opened = await reader.session.openPath("/docs/roundtrip.jsonl");
    expect(opened).toBe(true);

    // The document the reader holds must serialize to the same bytes, and
    // saving it again must not rewrite the file differently.
    expect(serializeDocument(reader.editor.getSnapshot())).toBe(
      onDisk as string,
    );
    await reader.session.save();
    expect(reader.backend.files.get("/docs/roundtrip.jsonl")).toBe(
      onDisk as string,
    );
  });
});

test("page-only edits autosave their names and order, while changing the active page stays clean", async () => {
  const h = createHarness({ seeded: false });
  try {
    h.backend.saveAnswers.push("/docs/pages.jsonl");
    await h.session.save();
    const first = h.editor.currentPageId;
    const second = h.editor.createPage({ name: "Second" });
    expect(h.session.state().dirty).toBe(true);
    expect(h.timers.pendingCount).toBe(1);
    h.timers.fire();
    await h.settle();
    expect(h.session.state().dirty).toBe(false);
    h.editor.setCurrentPage(first);
    expect(h.session.state().dirty).toBe(false);
    expect(h.timers.pendingCount).toBe(0);
    h.editor.renamePage(first, "Renamed first");
    h.editor.reorderPageTo(first, 1);
    h.timers.fire();
    await h.settle();
    const reopened = parseDocument(
      h.backend.files.get("/docs/pages.jsonl") ?? "",
    );
    expect(
      new Editor({ document: reopened }).store.listPages().map((p) => p.id),
    ).toEqual([second, first]);
    expect(reopened.pages.find((p) => p.id === first)?.name).toBe(
      "Renamed first",
    );
    expect(h.session.state().dirty).toBe(false);
  } finally {
    h.session.dispose();
  }
});

describe("saving modes and first-shape autosave", () => {
  test("empty documents and page-only changes create no file", async () => {
    const h = createHarness({ seeded: false });
    let allocations = 0;
    h.backend.autosavePath = async () => {
      allocations += 1;
      return "managed.jsonl";
    };
    await h.session.flush();
    h.editor.createPage({ kind: "freeform", name: "Extra" });
    h.timers.fire();
    await h.session.flush();
    expect(allocations).toBe(0);
    expect(h.backend.writes).toHaveLength(0);
    h.session.dispose();
  });

  test("first shape saves without a dialog and is watched and listed in Recent", async () => {
    const h = createHarness({ seeded: false });
    h.backend.autosavePath = async () => "managed.jsonl";
    addShape(h.editor, "first");
    expect(h.backend.writes).toHaveLength(0);
    expect(await h.session.flush()).toBe(true);
    expect(h.session.state().filePath).toBe("managed.jsonl");
    expect(h.session.state().dirty).toBe(false);
    expect(
      parseDocument(h.backend.files.get("managed.jsonl") ?? "").elements,
    ).toHaveLength(1);
    expect(h.backend.watched).toContain("managed.jsonl");
    expect(h.session.state().recent[0]?.path).toBe("managed.jsonl");
    h.session.dispose();
  });

  test("an imported document autosaves under a name from its source file", async () => {
    const h = createHarness({ seeded: false });
    const names: (string | null | undefined)[] = [];
    h.backend.autosavePath = async (name) => {
      names.push(name);
      return "board.jsonl";
    };
    await h.session.importDocument(
      { ...h.editor.getSnapshot(), title: "Board", elements: [] },
      "/boards/board.kicad_pcb",
    );
    addShape(h.editor, "edit");
    expect(await h.session.flush()).toBe(true);
    expect(names).toEqual(["board.kicad_pcb"]);
    expect(h.session.state().filePath).toBe("board.jsonl");
    h.session.dispose();
  });

  test("undoing the first shape before autosave leaves no file", async () => {
    const h = createHarness({ seeded: false });
    let allocations = 0;
    h.backend.autosavePath = async () => {
      allocations += 1;
      return "managed.jsonl";
    };
    addShape(h.editor, "first");
    h.editor.undo();
    h.timers.fire();
    await h.settle();
    expect(allocations).toBe(0);
    expect(h.backend.writes).toHaveLength(0);
    h.session.dispose();
  });

  test("manual cancels pending autosave and flush, but explicit Save still works", async () => {
    const h = createHarness({ seeded: false });
    h.backend.autosavePath = async () => "managed.jsonl";
    addShape(h.editor, "first");
    expect(h.timers.pendingCount).toBe(1);
    h.session.setSaveMode("manual");
    expect(h.timers.pendingCount).toBe(0);
    expect(await h.session.flush()).toBe(false);
    expect(h.backend.writes).toHaveLength(0);
    expect(h.session.state().dirty).toBe(true);
    h.backend.saveAnswers.push("chosen.jsonl");
    expect(await h.session.save()).toBe(true);
    addShape(h.editor, "second");
    h.timers.fire();
    await h.settle();
    expect(h.backend.writes).toHaveLength(1);
    h.session.setSaveMode("automatic");
    expect(h.timers.pendingCount).toBe(1);
    await h.session.flush();
    expect(h.backend.writes).toHaveLength(2);
    expect(h.session.state().dirty).toBe(false);
    h.session.dispose();
  });

  test("overlapping first saves allocate one file and flush preserves edits during a write", async () => {
    const h = createHarness({ seeded: false });
    let allocations = 0;
    h.backend.autosavePath = async () => {
      allocations += 1;
      return "managed.jsonl";
    };
    h.backend.blockWrites();
    addShape(h.editor, "first");
    h.timers.fire();
    await h.settle();
    addShape(h.editor, "second");
    h.timers.fire();
    const flush = h.session.flush();
    h.backend.releaseWrites();
    await flush;
    expect(allocations).toBe(1);
    expect(
      parseDocument(h.backend.files.get("managed.jsonl") ?? "").elements,
    ).toHaveLength(2);
    expect(h.session.state().dirty).toBe(false);
    h.session.dispose();
  });

  for (const action of ["manual", "new"] as const) {
    test(`pending path allocation is retired by ${action}`, async () => {
      const h = createHarness({ seeded: false });
      let release: (path: string) => void = () => {};
      h.backend.autosavePath = () =>
        new Promise((resolve) => {
          release = resolve;
        });
      addShape(h.editor, "first");
      h.timers.fire();
      if (action === "manual") h.session.setSaveMode("manual");
      else await h.session.newDocument();
      release("managed.jsonl");
      await h.settle();
      expect(h.backend.writes).toHaveLength(0);
      expect(h.session.state().filePath).toBeNull();
      h.session.dispose();
    });
  }

  test("switching to manual during a write keeps later edits dirty", async () => {
    const h = createHarness({ seeded: false });
    h.backend.autosavePath = async () => "managed.jsonl";
    h.backend.blockWrites();
    addShape(h.editor, "first");
    h.timers.fire();
    await h.settle();
    addShape(h.editor, "later");
    h.session.setSaveMode("manual");
    h.backend.releaseWrites();
    await h.session.flush();
    expect(h.session.state().dirty).toBe(true);
    expect(h.backend.writes).toHaveLength(1);
    expect(h.timers.pendingCount).toBe(0);
    h.session.dispose();
  });
});

test("explicit Save As wins over a pending first automatic save", async () => {
  const h = createHarness({ seeded: false });
  let release: (path: string) => void = () => {};
  h.backend.autosavePath = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  addShape(h.editor, "first");
  h.timers.fire();
  h.backend.saveAnswers.push("chosen.jsonl");
  expect(await h.session.saveAs()).toBe(true);
  release("managed.jsonl");
  await h.settle();
  expect(h.session.state().filePath).toBe("chosen.jsonl");
  expect(h.backend.files.has("managed.jsonl")).toBe(false);
  expect(h.backend.writes).toHaveLength(1);
  h.session.dispose();
});

test("changing autosave delay re-arms pending edits and respects manual mode", async () => {
  const h = createHarness({ seeded: false });
  h.session.dispose();
  h.backend.files.set("delay.jsonl", serializeDocument(h.editor.getSnapshot()));
  const delays: number[] = [];
  const cancelled: unknown[] = [];
  const session = new DocumentSession({
    editor: h.editor,
    backend: h.backend,
    scheduleTimer: (_callback, delay) => {
      delays.push(delay);
      return delays.length;
    },
    cancelTimer: (handle) => {
      cancelled.push(handle);
    },
  });
  await session.openPath("delay.jsonl");
  addShape(h.editor, "pending");
  session.setAutosaveDelayMs(3000);
  expect(delays).toEqual([1000, 3000]);
  expect(cancelled).toContain(1);
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1, 50, 60001])
    session.setAutosaveDelayMs(invalid);
  expect(delays).toHaveLength(2);
  session.setSaveMode("manual");
  session.setAutosaveDelayMs(500);
  expect(delays).toHaveLength(2);
  session.setSaveMode("automatic");
  expect(delays.at(-1)).toBe(500);
  session.dispose();
});
