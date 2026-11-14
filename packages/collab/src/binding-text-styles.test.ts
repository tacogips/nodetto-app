import { expect, test } from "bun:test";
import {
  measureTextNote,
  bindSelectionColor,
  createColorToken,
  createReviewComment,
  moveReviewComment,
  createTextStyle,
  replyToReviewComment,
  setReviewCommentResolved,
  bindSelectionTextStyle,
  updateTextStyle,
  updateColorToken,
} from "@nodetto/core";
import type { TypographyStyleValue } from "@nodetto/ir";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { erdDocument, freeformDocument } from "./test-fixtures.ts";
import {
  Wire,
  peer,
  elementIn,
  expectConverged,
} from "./binding-test-helpers.ts";

test("multilingual auto-sized text converges with concurrent typography and preserves peer edits on undo", () => {
  for (const textResize of ["auto-width", "auto-height"] as const) {
    const wire = new Wire();
    const a = peer(wire, freeformDocument());
    const note = a.editor.createElement("text.note", {
      semantic: { text: "Original" },
      visual: {
        x: 0,
        y: 0,
        width: 80,
        height: 40,
        textResize,
        style: { fontSize: 10 },
      },
    });
    a.binding.attach();
    const b = peer(wire);
    b.binding.attach();
    wire.flush();
    const text =
      "  e\u0301  \u{1f469}\u200d\u{1f4bb}\n\u304b\u3099  \u{1f1ef}\u{1f1f5}  ";
    try {
      a.editor.setText(note, text);
      b.editor.apply([
        {
          type: "updateVisual",
          id: note,
          visual: { style: { fontSize: 20, color: "#123456" } },
        },
      ]);
      wire.flush();
      expectConverged(a, b, wire);
      for (const client of [a, b]) {
        expect(client.editor.getText(note)).toBe(text);
        expect(client.editor.store.get(note)?.visual.style?.fontSize).toBe(20);
        const current = client.editor.store.get(note);
        if (!current) throw new Error("missing text note");
        const measured = measureTextNote(current, textResize);
        expect(current.visual.width).toBe(measured.width);
        expect(current.visual.height).toBe(measured.height);
        const saved = client.editor.getSnapshot();
        expect(parseDocument(serializeDocument(saved))).toEqual(saved);
      }
      expect(a.editor.exportPageSvg()).toBe(b.editor.exportPageSvg());
      expect(a.binding.undo()).toBe(true);
      wire.flush();
      expectConverged(a, b, wire);
      expect(a.editor.getText(note)).toBe("Original");
      expect(a.editor.store.get(note)?.visual.style?.fontSize).toBe(20);
      expect(a.editor.store.get(note)?.visual.style?.color).toBe("#123456");
      expect(a.binding.redo()).toBe(true);
      wire.flush();
      expectConverged(a, b, wire);
      expect(a.editor.getText(note)).toBe(text);
    } finally {
      a.binding.detach();
      b.binding.detach();
    }
  }
});

test("automatic text geometry converges alongside database edits", () => {
  const wire = new Wire();
  const a = peer(wire, erdDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const note = a.editor.buildElement("text.note", {
    semantic: { text: "Short" },
    visual: {
      x: 100,
      y: 300,
      width: 90,
      height: 80,
      textResize: "auto-height",
      style: { fontSize: 10 },
    },
  });
  a.editor.apply([{ type: "createElement", element: note }]);
  wire.flush();

  a.editor.setText(note.id, "one two three four five six seven eight nine");
  const orders = b.editor.store.get("t-orders");
  b.editor.apply([
    {
      type: "updateSemantic",
      id: "t-orders",
      semantic: {
        ...(orders?.semantic as object),
        tableName: "mobile_orders",
      },
    },
  ]);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.getText(note.id)).toBe(
      "one two three four five six seven eight nine",
    );
    expect(client.editor.getBounds(note.id)?.height).toBe(60);
    expect(
      (client.editor.store.get("t-orders")?.semantic as { tableName: string })
        .tableName,
    ).toBe("mobile_orders");
  }
  expectConverged(a, b, wire);
});

test("rich-text marks converge with remote geometry and undo stays isolated", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const note = a.editor.buildElement("text.note", {
    semantic: { text: "Shared rich label" },
    visual: { x: 20, y: 30, width: 180, height: 40 },
  });
  a.editor.apply([{ type: "createElement", element: note }]);
  wire.flush();

  a.editor.toggleTextMark(note.id, 0, 6, "bold");
  b.editor.apply([
    { type: "updateVisual", id: note.id, visual: { x: 120, y: 140 } },
  ]);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.get(note.id)?.semantic).toEqual({
      text: "Shared rich label",
      marks: [{ start: 0, end: 6, kind: "bold" }],
    });
    expect(client.editor.getBounds(note.id)?.x).toBe(120);
  }

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(client.editor.store.get(note.id)?.semantic).toEqual({
      text: "Shared rich label",
    });
    expect(client.editor.getBounds(note.id)?.x).toBe(120);
  }
  expectConverged(a, b, wire);
});

test("review threads, replies and resolution converge with isolated undo", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const target = a.editor.getSnapshot().elements[0]?.id;
  const id = createReviewComment(
    a.editor,
    { x: 80, y: 90 },
    {
      author: "Ada",
      body: "Does this meet contrast requirements?",
      createdAt: "2026-09-07T00:00:00.000Z",
      id: "message-a",
    },
    target,
  );
  if (!id) throw new Error("comment was not created");
  wire.flush();

  expect(
    replyToReviewComment(b.editor, id, {
      author: "Grace",
      body: "Yes, it passes AA.",
      createdAt: "2026-09-07T00:01:00.000Z",
      id: "message-b",
    }),
  ).toBe(true);
  expect(moveReviewComment(a.editor, id, { x: 100, y: 110 })).toBe(true);
  wire.flush();
  expect(elementIn(a, id).semantic).toEqual(elementIn(b, id).semantic);
  expect(elementIn(b, id).visual).toMatchObject({ x: 100, y: 110 });

  expect(setReviewCommentResolved(b.editor, id, true)).toBe(true);
  wire.flush();
  expect((elementIn(a, id).semantic as { resolved?: boolean }).resolved).toBe(
    true,
  );
  expect(b.binding.undo()).toBe(true);
  wire.flush();
  expect(
    (elementIn(a, id).semantic as { resolved?: boolean }).resolved,
  ).toBeUndefined();
  expect(elementIn(a, id).visual).toMatchObject({ x: 100, y: 110 });
  expectConverged(a, b, wire);
});

test("reusable typography propagates and converges with peer-local undo", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const note = a.editor.createElement("text.note", {
    semantic: { text: "Shared title" },
    visual: { x: 10, y: 20, width: 180, height: 50 },
  });
  const style = createTextStyle(a.editor, "Heading", {
    fontFamily: "Inter",
    fontSize: 32,
    fontWeight: 700,
    fontStyle: "normal",
    lineHeight: 1.2,
    letterSpacing: -0.5,
    textAlign: "start",
    textDecoration: "none",
    verticalAlign: "top",
  });
  if (!style) throw new Error("text style was not created");
  a.editor.selection.set([note]);
  bindSelectionTextStyle(a.editor, style);
  wire.flush();

  const semantic = elementIn(b, style).semantic as {
    name: string;
    value: TypographyStyleValue;
  };
  updateTextStyle(b.editor, style, semantic.name, {
    ...semantic.value,
    fontSize: 40,
  });
  a.editor.apply([{ type: "updateVisual", id: note, visual: { x: 100 } }]);
  wire.flush();
  for (const client of [a, b]) {
    expect(elementIn(client, note).visual.textStyle).toBe(style);
    expect(elementIn(client, note).visual.style?.fontSize).toBe(40);
    expect(elementIn(client, note).visual.x).toBe(100);
  }
  expect(b.binding.undo()).toBe(true);
  wire.flush();
  for (const client of [a, b]) {
    expect(elementIn(client, note).visual.style?.fontSize).toBe(32);
    expect(elementIn(client, note).visual.x).toBe(100);
  }
  expectConverged(a, b, wire);
});

test("linked palette edits and undo converge in one collaborative transaction", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  const id = a.editor.getSnapshot().elements[0]?.id;
  const token = createColorToken(a.editor, "Brand", "#123456");
  if (!id || !token) throw new Error("missing fixture");
  a.editor.selection.set([id]);
  bindSelectionColor(a.editor, "fill", token);
  wire.flush();
  updateColorToken(b.editor, token, "Brand", "#abcdef");
  wire.flush();
  expect(elementIn(a, id).visual.style?.fill).toBe("#abcdef");
  expectConverged(a, b, wire);
  expect(b.binding.undo()).toBe(true);
  wire.flush();
  expect(elementIn(a, id).visual.style?.fill).toBe("#123456");
  expect(elementIn(a, id).visual.colorTokens?.fill).toBe(token);
  expectConverged(a, b, wire);
});

test("undoing a new binding restores its prior literal after concurrent palette repair", () => {
  const wire = new Wire();
  const a = peer(wire, freeformDocument());
  a.binding.attach();
  const token = createColorToken(a.editor, "Brand", "#123456");
  const id = a.editor
    .getSnapshot()
    .elements.find((item) => item.type !== "design.token")?.id;
  if (!id || !token) throw new Error("missing fixture");
  a.editor.selection.set([id]);
  a.editor.setSelectionStyle({ fill: "#fedcba" });
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  updateColorToken(a.editor, token, "Brand", "#abcdef");
  b.editor.selection.set([id]);
  bindSelectionColor(b.editor, "fill", token);
  wire.flush();
  expect(elementIn(b, id).visual.style?.fill).toBe("#abcdef");
  expect(b.binding.undo()).toBe(true);
  wire.flush();
  expect(elementIn(b, id).visual.colorTokens?.fill).toBeUndefined();
  expect(elementIn(b, id).visual.style?.fill).toBe("#fedcba");
  expectConverged(a, b, wire);
  for (let round = 0; round < 2; round++) {
    expect(b.binding.redo()).toBe(true);
    wire.flush();
    expect(elementIn(b, id).visual.colorTokens?.fill).toBe(token);
    expect(elementIn(b, id).visual.style?.fill).toBe("#abcdef");
    expect(b.binding.undo()).toBe(true);
    wire.flush();
    expect(elementIn(b, id).visual.style?.fill).toBe("#fedcba");
    expectConverged(a, b, wire);
  }
  b.binding.redo();
  wire.flush();
  a.editor.setSelectionStyle({ fill: "#001122" });
  wire.flush();
  b.binding.undo();
  wire.flush();
  expect(elementIn(b, id).visual.style?.fill).toBe("#001122");
  expect(elementIn(b, id).visual.colorTokens?.fill).toBeUndefined();
  expectConverged(a, b, wire);
});

for (const field of ["fill", "stroke", "color"] as const) {
  for (const initial of [undefined, "#fedcba"]) {
    test(`captured ${field} edits undo to ${initial ?? "no literal"} after palette repair`, () => {
      const wire = new Wire();
      const a = peer(wire, freeformDocument());
      a.binding.attach();
      const id = a.editor.getSnapshot().elements[0]?.id;
      const token = createColorToken(a.editor, "Brand", "#123456");
      if (!id || !token) throw new Error("missing fixture");
      a.editor.selection.set([id]);
      a.editor.setSelectionStyle({ [field]: initial ?? null });
      const b = peer(wire, undefined, 60_000);
      wire.flush();
      b.binding.attach();
      wire.flush();
      b.editor.selection.set([id]);
      // Both operations should be captured in one real Yjs undo entry.
      b.editor.setSelectionStyle({ [field]: "#334455" });
      bindSelectionColor(b.editor, field, token);
      updateColorToken(a.editor, token, "Brand", "#abcdef");
      wire.flush();
      expect(elementIn(b, id).visual.style?.[field]).toBe("#abcdef");
      expect(b.binding.undo()).toBe(true);
      wire.flush();
      expect(elementIn(b, id).visual.style?.[field]).toBe(initial);
      expect(elementIn(b, id).visual.colorTokens?.[field]).toBeUndefined();
      expect(b.binding.canUndo()).toBe(false);
      expectConverged(a, b, wire);
      expect(b.binding.redo()).toBe(true);
      wire.flush();
      expect(elementIn(b, id).visual.style?.[field]).toBe("#abcdef");
      expect(elementIn(b, id).visual.colorTokens?.[field]).toBe(token);
      expectConverged(a, b, wire);
    });
  }
}
