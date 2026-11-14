// Requests that overlap: writes that outlive their document, opens and
// imports overtaken by newer ones, and handing the editor to a cloud room.
//
// The harness in `session-test-helpers.ts` mocks the backend with an
// in-memory filesystem and drives the autosave timer by hand.

import { describe, expect, test } from "bun:test";
import type { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import {
  addShape,
  createHarness,
  type MockBackend,
} from "./session-test-helpers.ts";

describe("a write that outlives its document", () => {
  /** A document written by an unrelated session, ready to be opened. */
  async function foreignDocument(label: string): Promise<string> {
    const other = createHarness({ seeded: false });
    addShape(other.editor, label);
    other.backend.saveAnswers.push("/docs/b.jsonl");
    await other.session.save();
    const text = other.backend.files.get("/docs/b.jsonl");
    if (text === undefined) {
      throw new Error("the fixture failed to save");
    }
    return text;
  }

  test("a queued write is dropped when the document is replaced", async () => {
    const harness = createHarness();
    harness.backend.saveAnswers.push("/docs/a.jsonl");
    await harness.session.save();
    const documentB = await foreignDocument("belongs to b");
    harness.backend.files.set("/docs/b.jsonl", documentB);

    harness.backend.blockWrites();
    addShape(harness.editor, "one");
    harness.timers.fire();
    await harness.settle();
    addShape(harness.editor, "two");
    harness.timers.fire();
    await harness.settle();

    // One write is stalled in the backend and a second is queued behind it.
    const opened = await harness.session.openPath("/docs/b.jsonl");
    expect(opened).toBe(true);

    harness.backend.releaseWrites();
    await harness.settle();

    const fileA = harness.backend.files.get("/docs/a.jsonl") as string;
    // The queued write would have serialized document B into file A.
    expect(fileA).not.toBe(documentB);
    expect(fileA).not.toContain("belongs to b");
    expect(harness.backend.files.get("/docs/b.jsonl")).toBe(documentB);
    // And the write that was already in flight must not drag the session
    // back to the file the user left.
    expect(harness.session.state().filePath).toBe("/docs/b.jsonl");
    expect(harness.session.state().fileName).toBe("b.jsonl");
  });

  test("a queued write is dropped when the document is emptied", async () => {
    const harness = createHarness();
    harness.backend.saveAnswers.push("/docs/a.jsonl");
    await harness.session.save();
    const saved = harness.backend.files.get("/docs/a.jsonl") as string;

    harness.backend.blockWrites();
    addShape(harness.editor, "one");
    harness.timers.fire();
    await harness.settle();
    addShape(harness.editor, "two");
    harness.timers.fire();
    await harness.settle();

    await harness.session.newDocument();
    harness.backend.releaseWrites();
    await harness.settle();

    // The empty document must not be written into the user's file.
    const fileA = harness.backend.files.get("/docs/a.jsonl") as string;
    expect(fileA).not.toBe(serializeDocument(harness.editor.getSnapshot()));
    expect(fileA.length).toBeGreaterThanOrEqual(saved.length);
    expect(harness.session.state().filePath).toBeNull();
  });
});

describe("handing the editor to another document mode", () => {
  test("a suspended session closes the file and stops autosaving", async () => {
    const harness = createHarness();
    harness.backend.saveAnswers.push("/docs/a.jsonl");
    await harness.session.save();
    const saved = harness.backend.files.get("/docs/a.jsonl");
    expect(harness.session.state().filePath).toBe("/docs/a.jsonl");

    harness.session.suspend();
    expect(harness.session.state().filePath).toBeNull();
    expect(harness.session.state().fileName).toBeNull();
    await harness.settle();
    expect(harness.backend.watched.at(-1)).toBeNull();

    // Everything a cloud room writes into the store arrives as an ordinary
    // store diff. None of it may reach the file the user had open.
    addShape(harness.editor, "written by a peer");
    expect(harness.timers.pendingCount).toBe(0);
    harness.timers.fire();
    await harness.settle();

    expect(harness.session.state().dirty).toBe(false);
    expect(harness.backend.files.get("/docs/a.jsonl")).toBe(saved as string);
  });

  test("resuming tracks edits again, and saving asks for a path", async () => {
    const harness = createHarness();
    harness.backend.saveAnswers.push("/docs/a.jsonl");
    await harness.session.save();
    harness.session.suspend();
    harness.session.resume();

    addShape(harness.editor, "back in file mode");
    await harness.settle();
    expect(harness.session.state().dirty).toBe(true);

    // The editor no longer holds the document that file contained, so the
    // save has to ask rather than overwrite it.
    harness.backend.saveAnswers.push("/docs/b.jsonl");
    expect(await harness.session.save()).toBe(true);
    expect(harness.session.state().filePath).toBe("/docs/b.jsonl");
  });

  test("suspending twice is harmless", () => {
    const harness = createHarness();
    harness.session.suspend();
    harness.session.suspend();
    expect(harness.session.state().filePath).toBeNull();
  });
});

describe("overlapping open requests", () => {
  /** Hold every read of `path` until the returned function is called. */
  function holdReads(backend: MockBackend, path: string): () => void {
    const read = backend.readDocument.bind(backend);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    backend.readDocument = (requested: string) =>
      requested === path ? gate.then(() => read(requested)) : read(requested);
    return release;
  }

  function documentText(editor: Editor, title: string): string {
    return serializeDocument({ ...editor.getSnapshot(), title });
  }

  test("an older open that settles last cannot replace the newer document or its edits", async () => {
    const harness = createHarness();
    const { backend, editor, session } = harness;
    backend.files.set("/docs/a.jsonl", documentText(editor, "A"));
    backend.files.set("/docs/b.jsonl", documentText(editor, "B"));
    const releaseA = holdReads(backend, "/docs/a.jsonl");

    const openingA = session.openPath("/docs/a.jsonl");
    expect(await session.openPath("/docs/b.jsonl")).toBe(true);
    addShape(editor, "edit to B");
    await harness.settle();
    expect(session.state().dirty).toBe(true);
    const watchesBefore = backend.watched.length;

    releaseA();
    expect(await openingA).toBe(false);
    expect(editor.getSnapshot().title).toBe("B");
    expect(session.state().filePath).toBe("/docs/b.jsonl");
    expect(session.state().dirty).toBe(true);
    expect(session.state().recent.map((entry) => entry.path)).toEqual([
      "/docs/b.jsonl",
    ]);
    expect(backend.watched.length).toBe(watchesBefore);
  });

  test("a new document retires an open still reading", async () => {
    const harness = createHarness();
    const { backend, editor, session } = harness;
    backend.files.set("/docs/a.jsonl", documentText(editor, "A"));
    const releaseA = holdReads(backend, "/docs/a.jsonl");

    const openingA = session.openPath("/docs/a.jsonl");
    await session.newDocument();
    releaseA();
    expect(await openingA).toBe(false);
    expect(session.state().filePath).toBeNull();
    expect(editor.getSnapshot().title).not.toBe("A");
  });

  test("an open still reading when the cloud takes the editor never loads", async () => {
    const harness = createHarness();
    const { backend, editor, session } = harness;
    backend.files.set("/docs/a.jsonl", documentText(editor, "A"));
    const releaseA = holdReads(backend, "/docs/a.jsonl");
    const before = editor.getSnapshot().title;

    const openingA = session.openPath("/docs/a.jsonl");
    session.suspend();
    releaseA();
    expect(await openingA).toBe(false);
    expect(editor.getSnapshot().title).toBe(before);
    expect(session.state().filePath).toBeNull();
  });
});

describe("opening while another mode owns the editor", () => {
  test("a suspended session refuses to open a file into the editor", async () => {
    const harness = createHarness();
    const { backend, editor, session } = harness;
    backend.files.set(
      "/docs/a.jsonl",
      serializeDocument({ ...editor.getSnapshot(), title: "A" }),
    );
    session.suspend();
    const before = editor.getSnapshot();

    expect(await session.openPath("/docs/a.jsonl")).toBe(false);
    backend.openAnswers.push("/docs/a.jsonl");
    expect(await session.open()).toBe(false);
    expect(editor.getSnapshot()).toEqual(before);
    expect(session.state().filePath).toBeNull();
    expect(session.state().error).toContain("cloud document");
    // The dialog was never shown either.
    expect(backend.openAnswers).toEqual(["/docs/a.jsonl"]);
  });
});

describe("overlapping imports", () => {
  test("an import overtaken while the old watch stops never loads", async () => {
    const harness = createHarness();
    const { backend, editor, session } = harness;
    backend.files.set(
      "/docs/a.jsonl",
      serializeDocument({ ...editor.getSnapshot(), title: "A" }),
    );
    expect(await session.openPath("/docs/a.jsonl")).toBe(true);
    const imported = { ...editor.getSnapshot(), title: "Imported" };

    const importing = session.importDocument(imported, "diagram.mmd");
    session.suspend();
    expect(await importing).toBe(false);
    expect(editor.getSnapshot().title).toBe("A");
  });

  test("a newer open wins over an import still stopping the old watch", async () => {
    const harness = createHarness();
    const { backend, editor, session } = harness;
    for (const name of ["a", "b"])
      backend.files.set(
        `/docs/${name}.jsonl`,
        serializeDocument({ ...editor.getSnapshot(), title: name }),
      );
    expect(await session.openPath("/docs/a.jsonl")).toBe(true);
    const imported = { ...editor.getSnapshot(), title: "Imported" };

    const importing = session.importDocument(imported, "diagram.mmd");
    const opening = session.openPath("/docs/b.jsonl");
    expect(await importing).toBe(false);
    expect(await opening).toBe(true);
    expect(editor.getSnapshot().title).toBe("b");
    expect(session.state().filePath).toBe("/docs/b.jsonl");
  });
});
