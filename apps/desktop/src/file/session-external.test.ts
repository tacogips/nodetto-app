// Changes made to the open file by another writer: conflicts, the
// banner, and live merges of outside changes.
//
// The harness in `session-test-helpers.ts` mocks the backend with an
// in-memory filesystem and drives the autosave timer by hand.

import { describe, expect, test } from "bun:test";
import { Editor, mergeDocuments } from "@nodetto/core";
import { isPlainObject, validateDocument } from "@nodetto/ir";
import { planOutsideChange } from "./session-reconcile.ts";
import { parseDocument, serializeDocument } from "@nodetto/io";
import {
  addShape,
  createHarness,
  type Harness,
} from "./session-test-helpers.ts";

describe("external changes", () => {
  async function openedHarness(): Promise<Harness> {
    const harness = createHarness();
    harness.backend.saveAnswers.push("/docs/a.jsonl");
    await harness.session.save();
    return harness;
  }

  test("our own write echoing back raises no conflict", async () => {
    const harness = await openedHarness();

    harness.backend.emitFileChanged("/docs/a.jsonl");
    await harness.settle();

    expect(harness.session.state().conflict).toBeNull();
  });

  test("a change to another file is ignored", async () => {
    const harness = await openedHarness();
    harness.backend.files.set("/docs/other.jsonl", "irrelevant\n");

    harness.backend.emitFileChanged("/docs/other.jsonl");
    await harness.settle();

    expect(harness.session.state().conflict).toBeNull();
  });

  test("a read that fails mid-write raises no conflict", async () => {
    const harness = await openedHarness();
    harness.backend.failNextRead("resource temporarily unavailable");

    harness.backend.emitFileChanged("/docs/a.jsonl");
    await harness.settle();

    // Catching the file between the temp write and the rename must not put
    // a banner in front of the user; the next event carries settled bytes.
    expect(harness.session.state().conflict).toBeNull();
    expect(harness.session.state().error).toBeNull();
  });

  test("a change to the same document is shown live without a banner", async () => {
    const harness = await openedHarness();
    const external = `${harness.backend.files.get("/docs/a.jsonl")}`.replace(
      '"title":"Untitled"',
      '"title":"Edited elsewhere"',
    );
    harness.backend.files.set("/docs/a.jsonl", external);

    harness.backend.emitFileChanged("/docs/a.jsonl");
    await harness.settle();

    expect(harness.session.state().conflict).toBeNull();
    expect(harness.session.state().dirty).toBe(false);
    expect(harness.editor.store.getMeta().title).toBe("Edited elsewhere");
  });

  test("a different document on disk raises a conflict", async () => {
    const harness = await openedHarness();
    const external =
      '{"kind":"document","schemaVersion":1,"id":"x","title":"Elsewhere"}\n';
    harness.backend.files.set("/docs/a.jsonl", external);

    harness.backend.emitFileChanged("/docs/a.jsonl");
    await harness.settle();

    expect(harness.session.state().conflict?.diskText).toBe(external);
  });

  test("reload takes the file and clears the conflict", async () => {
    const harness = await openedHarness();
    const other = createHarness();
    addShape(other.editor, "written elsewhere");
    const external = serializeDocument(other.editor.getSnapshot());
    harness.backend.files.set("/docs/a.jsonl", external);
    harness.backend.emitFileChanged("/docs/a.jsonl");
    await harness.settle();

    const reloaded = await harness.session.resolveConflict("reload");

    expect(reloaded).toBe(true);
    expect(harness.session.state().conflict).toBeNull();
    expect(harness.session.state().dirty).toBe(false);
    expect(serializeDocument(harness.editor.getSnapshot())).toBe(external);
  });

  test("keeping mine re-dirties the document and the next save overwrites", async () => {
    const harness = await openedHarness();
    const mine = serializeDocument(harness.editor.getSnapshot());
    harness.backend.files.set("/docs/a.jsonl", '{"kind":"document"}\n');
    harness.backend.emitFileChanged("/docs/a.jsonl");
    await harness.settle();

    const kept = await harness.session.resolveConflict("keep");

    expect(kept).toBe(true);
    expect(harness.session.state().conflict).toBeNull();
    expect(harness.session.state().dirty).toBe(true);

    harness.timers.fire();
    await harness.settle();

    expect(harness.backend.files.get("/docs/a.jsonl")).toBe(mine);
  });

  test("an edit made while the banner is up is not written to disk", async () => {
    const harness = await openedHarness();
    const external =
      '{"kind":"document","schemaVersion":1,"id":"x","title":"Elsewhere"}\n';
    harness.backend.files.set("/docs/a.jsonl", external);
    harness.backend.emitFileChanged("/docs/a.jsonl");
    await harness.settle();
    expect(harness.session.state().conflict).not.toBeNull();

    addShape(harness.editor, "while deciding");
    harness.timers.fire();
    await harness.settle();

    // The banner is the question "which version wins?". Autosaving over the
    // external change would answer it for the user.
    expect(harness.session.state().dirty).toBe(true);
    expect(harness.backend.files.get("/docs/a.jsonl")).toBe(external);
  });

  test("an autosave armed before the event does not land once the banner is up", async () => {
    const harness = await openedHarness();
    addShape(harness.editor, "edited just before");
    expect(harness.timers.pendingCount).toBe(1);

    const external =
      '{"kind":"document","schemaVersion":1,"id":"x","title":"Elsewhere"}\n';
    harness.backend.files.set("/docs/a.jsonl", external);
    harness.backend.emitFileChanged("/docs/a.jsonl");
    await harness.settle();

    expect(harness.session.state().conflict).not.toBeNull();
    expect(harness.timers.pendingCount).toBe(0);
    harness.timers.fire();
    await harness.settle();
    expect(harness.backend.files.get("/docs/a.jsonl")).toBe(external);
  });

  test("an explicit save while the banner is up keeps mine and clears it", async () => {
    const harness = await openedHarness();
    const external =
      '{"kind":"document","schemaVersion":1,"id":"x","title":"Elsewhere"}\n';
    harness.backend.files.set("/docs/a.jsonl", external);
    harness.backend.emitFileChanged("/docs/a.jsonl");
    await harness.settle();

    const saved = await harness.session.save();

    expect(saved).toBe(true);
    expect(harness.backend.files.get("/docs/a.jsonl")).toBe(
      serializeDocument(harness.editor.getSnapshot()),
    );
    // Disk now holds our document, so the banner's `diskText` is stale and
    // the question it asked is answered.
    expect(harness.session.state().conflict).toBeNull();
  });

  test("a conflict raised during a write survives that write", async () => {
    const harness = await openedHarness();
    const external =
      '{"kind":"document","schemaVersion":1,"id":"x","title":"Elsewhere"}\n';

    harness.backend.blockWrites();
    addShape(harness.editor, "one");
    harness.timers.fire();
    await harness.settle();

    // The external change lands while our bytes are still in flight; our
    // write will overwrite it, so the banner is the only way back to it.
    harness.backend.files.set("/docs/a.jsonl", external);
    harness.backend.emitFileChanged("/docs/a.jsonl");
    await harness.settle();
    expect(harness.session.state().conflict?.diskText).toBe(external);

    harness.backend.releaseWrites();
    await harness.settle();

    expect(harness.session.state().conflict?.diskText).toBe(external);
    // Still actionable: reloading is how the user gets the overwritten
    // version back.
    expect(await harness.session.resolveConflict("reload")).toBe(true);
    expect(harness.editor.store.getMeta().title).toBe("Elsewhere");
  });

  test("an unparseable file on disk keeps the banner up", async () => {
    const harness = await openedHarness();
    harness.backend.files.set("/docs/a.jsonl", "garbage\n");
    harness.backend.emitFileChanged("/docs/a.jsonl");
    await harness.settle();

    const reloaded = await harness.session.resolveConflict("reload");

    expect(reloaded).toBe(false);
    expect(harness.session.state().conflict).not.toBeNull();
    expect(harness.session.state().error).toContain("could not parse");
  });

  test("a disposed session stops reacting to file changes", async () => {
    const harness = await openedHarness();
    harness.backend.files.set("/docs/a.jsonl", "garbage\n");

    harness.session.dispose();
    harness.backend.emitFileChanged("/docs/a.jsonl");
    await harness.settle();

    expect(harness.session.state().conflict).toBeNull();
  });
});

describe("live outside changes (nodetto-cli and other writers)", () => {
  async function opened(): Promise<Harness> {
    const harness = createHarness({ seeded: false });
    addShape(harness.editor, "first");
    harness.backend.saveAnswers.push("/docs/live.jsonl");
    await harness.session.save();
    return harness;
  }

  /** What another writer would save: the disk document plus `change`. */
  function writeElsewhere(
    harness: Harness,
    change: (editor: Editor) => void,
  ): string {
    const other = new Editor({
      document: parseDocument(
        `${harness.backend.files.get("/docs/live.jsonl")}`,
      ),
    });
    change(other);
    const text = serializeDocument(other.getSnapshot());
    harness.backend.files.set("/docs/live.jsonl", text);
    return text;
  }

  test("a clean document takes an outside change in place and keeps the camera", async () => {
    const harness = await opened();
    harness.editor.camera.set({ x: 120, y: -40, z: 1.5 });
    const external = writeElsewhere(harness, (editor) =>
      addShape(editor, "drawn by the CLI"),
    );

    harness.backend.emitFileChanged("/docs/live.jsonl");
    await harness.settle();

    expect(harness.session.state().conflict).toBeNull();
    expect(harness.session.state().dirty).toBe(false);
    expect(serializeDocument(harness.editor.getSnapshot())).toBe(external);
    expect(harness.editor.camera.get()).toEqual({ x: 120, y: -40, z: 1.5 });
    expect(harness.timers.pendingCount).toBe(0);
    expect(harness.session.state().outsideChange).toEqual({
      added: 1,
      updated: 0,
      removed: 0,
      merged: false,
    });

    // The note is about the last outside change; a local edit retires it.
    addShape(harness.editor, "the person draws");
    expect(harness.session.state().outsideChange).toBeNull();
  });

  test("unsaved local edits merge with a disjoint outside change and autosave the result", async () => {
    const harness = await opened();
    addShape(harness.editor, "drawn by the person");
    writeElsewhere(harness, (editor) => addShape(editor, "drawn by the CLI"));

    harness.backend.emitFileChanged("/docs/live.jsonl");
    await harness.settle();

    const labels = () =>
      harness.editor.store
        .listElements()
        .map((element) => (element.semantic as { label?: string }).label)
        .sort();
    expect(harness.session.state().conflict).toBeNull();
    expect(labels()).toEqual([
      "drawn by the CLI",
      "drawn by the person",
      "first",
    ]);
    expect(harness.session.state().dirty).toBe(true);
    expect(harness.session.state().outsideChange?.merged).toBe(true);

    harness.timers.fire();
    await harness.settle();
    const saved = parseDocument(
      `${harness.backend.files.get("/docs/live.jsonl")}`,
    );
    expect(saved.elements).toHaveLength(3);
  });

  test("the same field changed on both sides keeps mine and asks", async () => {
    const harness = await opened();
    const id = harness.editor.store.listElements()[0]?.id ?? "";
    harness.editor.apply([
      { type: "updateSemantic", id, semantic: { geo: "rect", label: "mine" } },
    ]);
    const external = writeElsewhere(harness, (editor) =>
      editor.apply([
        {
          type: "updateSemantic",
          id,
          semantic: { geo: "rect", label: "theirs" },
        },
      ]),
    );

    harness.backend.emitFileChanged("/docs/live.jsonl");
    await harness.settle();

    expect(harness.session.state().conflict?.mergedConflicts).toEqual([id]);
    expect(
      (harness.editor.store.get(id)?.semantic as { label?: string }).label,
    ).toBe("mine");
    expect(harness.timers.pendingCount).toBe(0);
    expect(await harness.session.resolveConflict("reload")).toBe(true);
    expect(serializeDocument(harness.editor.getSnapshot())).toBe(external);
  });

  test("a move and a rename of the same element both survive", async () => {
    const harness = await opened();
    const id = harness.editor.store.listElements()[0]?.id ?? "";
    harness.editor.moveElements([{ id, x: 300, y: 200 }]);
    writeElsewhere(harness, (editor) =>
      editor.apply([
        {
          type: "updateSemantic",
          id,
          semantic: { geo: "rect", label: "renamed" },
        },
      ]),
    );

    harness.backend.emitFileChanged("/docs/live.jsonl");
    await harness.settle();

    const element = harness.editor.store.get(id);
    expect(harness.session.state().conflict).toBeNull();
    expect(element?.visual.x).toBe(300);
    expect((element?.semantic as { label?: string }).label).toBe("renamed");
  });

  async function conversionFixture(kind: "sequence" | "bpmn" = "sequence") {
    const harness = createHarness({ seeded: false });
    const widget =
      kind === "sequence"
        ? harness.editor.createSequenceParticipant("service", { x: 40, y: 40 })
        : harness.editor.createElement("bpmn.task", {
            visual: { x: 40, y: 40 },
          });
    const orders =
      kind === "sequence"
        ? harness.editor.createSequenceParticipant("service", { x: 340, y: 40 })
        : harness.editor.createElement("bpmn.task", {
            visual: { x: 340, y: 40 },
          });
    harness.backend.saveAnswers.push("/docs/live.jsonl");
    await harness.session.save();
    return { harness, widget, orders };
  }

  function convert(editor: Editor, id: string, type = "state.node") {
    const visual = editor.store.get(id)?.visual;
    if (!visual) throw new Error("missing conversion target");
    editor.apply([
      {
        type: "convertElement",
        id,
        elementType: type,
        semantic:
          type === "state.node"
            ? { kind: "state", name: "Widget" }
            : type === "bpmn.event"
              ? { position: "intermediateCatch", definitions: [] }
              : { text: "" },
        visual,
      },
    ]);
  }

  function actor(editor: Editor, id: string) {
    const element = editor.store.get(id);
    if (!element) throw new Error("missing participant");
    if (!isPlainObject(element.semantic))
      throw new Error("invalid participant");
    editor.apply([
      {
        type: "updateSemantic",
        id,
        semantic: { ...element.semantic, kind: "actor" },
      },
    ]);
  }

  async function assertBanner(harness: Harness, external: string) {
    const before = harness.editor.getSnapshot();
    harness.backend.emitFileChanged("/docs/live.jsonl");
    await harness.settle();
    expect(harness.session.state().conflict?.diskText).toBe(external);
    expect(harness.session.state().conflict?.mergedConflicts).toBeUndefined();
    expect(harness.editor.getSnapshot()).toEqual(before);
    expect(harness.timers.pendingCount).toBe(0);
  }

  for (const localConverts of [false, true]) {
    test(`concurrent semantic edit and conversion raises banner (local converts: ${localConverts})`, async () => {
      const { harness, widget } = await conversionFixture();
      if (localConverts) convert(harness.editor, widget);
      else actor(harness.editor, widget);
      const external = writeElsewhere(harness, (editor) => {
        if (localConverts) actor(editor, widget);
        else convert(editor, widget);
      });
      await assertBanner(harness, external);
    });

    test(`new message and conversion raises banner (local converts: ${localConverts})`, async () => {
      const { harness, widget, orders } = await conversionFixture();
      const baseText = `${harness.backend.files.get("/docs/live.jsonl")}`;
      if (localConverts) convert(harness.editor, widget);
      else harness.editor.connectSmart(widget, orders);
      const external = writeElsewhere(harness, (editor) => {
        if (localConverts) editor.connectSmart(widget, orders);
        else convert(editor, widget);
      });
      const local = harness.editor.getSnapshot();
      const remote = parseDocument(external);
      const merged = mergeDocuments(parseDocument(baseText), local, remote);
      expect(merged.conflicts).toEqual([]);
      const issues = validateDocument(merged.document);
      expect(issues.filter((issue) => issue.severity === "error")).toHaveLength(
        0,
      );
      expect(
        issues.filter((issue) => issue.code === "connector.endpointType"),
      ).toHaveLength(1);
      expect(planOutsideChange(local, remote, baseText, true)).toBeNull();
      await assertBanner(harness, external);
    });

    test(`new BPMN flow and conversion raises banner (local converts: ${localConverts})`, async () => {
      const { harness, widget, orders } = await conversionFixture("bpmn");
      const baseText = `${harness.backend.files.get("/docs/live.jsonl")}`;
      if (localConverts) convert(harness.editor, widget, "bpmn.textAnnotation");
      else harness.editor.connectSmart(widget, orders);
      const external = writeElsewhere(harness, (editor) => {
        if (localConverts) editor.connectSmart(widget, orders);
        else convert(editor, widget, "bpmn.textAnnotation");
      });
      const local = harness.editor.getSnapshot();
      const remote = parseDocument(external);
      const merged = mergeDocuments(parseDocument(baseText), local, remote);
      expect(merged.conflicts).toEqual([]);
      expect(
        validateDocument(merged.document).filter(
          (issue) => issue.severity === "error",
        ),
      ).toHaveLength(0);
      expect(
        merged.document.elements.some(
          (element) => element.type === "bpmn.sequenceFlow",
        ),
      ).toBe(true);
      expect(planOutsideChange(local, remote, baseText, true)).toBeNull();
      await assertBanner(harness, external);
    });
  }

  test("clean session takes a conversion in place", async () => {
    const { harness, widget } = await conversionFixture();
    writeElsewhere(harness, (editor) => convert(editor, widget));
    harness.backend.emitFileChanged("/docs/live.jsonl");
    await harness.settle();
    expect(harness.session.state().conflict).toBeNull();
    expect(harness.editor.store.get(widget)?.type).toBe("state.node");
  });

  test("local move merges with remote conversion", async () => {
    const { harness, widget } = await conversionFixture();
    harness.editor.moveElements([{ id: widget, x: 200, y: 160 }]);
    writeElsewhere(harness, (editor) => convert(editor, widget));
    harness.backend.emitFileChanged("/docs/live.jsonl");
    await harness.settle();
    expect(harness.session.state().conflict).toBeNull();
    expect(harness.editor.store.get(widget)?.type).toBe("state.node");
    expect(harness.editor.store.get(widget)?.visual.x).toBe(200);
    expect(harness.editor.store.get(widget)?.visual.y).toBe(160);
  });

  test("new activation and remote conversion raises banner", async () => {
    const { harness, widget } = await conversionFixture();
    harness.editor.createSequenceActivation(widget);
    const external = writeElsewhere(harness, (editor) =>
      convert(editor, widget),
    );
    await assertBanner(harness, external);
  });

  test("unchanged BPMN flow and conversion merge with a local move", async () => {
    const { harness, widget, orders } = await conversionFixture("bpmn");
    harness.editor.connectSmart(widget, orders);
    await harness.session.save();
    harness.editor.moveElements([{ id: widget, x: 200, y: 160 }]);
    writeElsewhere(harness, (editor) => convert(editor, widget, "bpmn.event"));
    harness.backend.emitFileChanged("/docs/live.jsonl");
    await harness.settle();
    expect(harness.session.state().conflict).toBeNull();
    expect(harness.editor.store.get(widget)?.type).toBe("bpmn.event");
    expect(harness.editor.store.get(widget)?.visual.x).toBe(200);
  });

  test("existing endpoint warning on an unconverted element does not block a conversion", async () => {
    const { harness, widget, orders } = await conversionFixture();
    harness.editor.connectSmart(widget, orders);
    const converted = harness.editor.createElement("node.generic");
    const invalid = harness.editor.store.get(orders);
    if (!invalid) throw new Error("missing endpoint");
    harness.editor.store.commit({
      update: [
        { ...invalid, type: "node.generic", semantic: { label: "Orders" } },
      ],
    });
    await harness.session.save();
    const beforeIssues = validateDocument(harness.editor.getSnapshot()).filter(
      (issue) => issue.code === "connector.endpointType",
    );
    expect(beforeIssues).toHaveLength(1);
    harness.editor.moveElements([{ id: widget, x: 200, y: 160 }]);
    writeElsewhere(harness, (editor) =>
      convert(editor, converted, "state.node"),
    );
    harness.backend.emitFileChanged("/docs/live.jsonl");
    await harness.settle();
    expect(harness.session.state().conflict).toBeNull();
    expect(harness.editor.store.get(converted)?.type).toBe("state.node");
    expect(
      validateDocument(harness.editor.getSnapshot()).filter(
        (issue) => issue.code === "connector.endpointType",
      ),
    ).toEqual(beforeIssues);
  });
});
