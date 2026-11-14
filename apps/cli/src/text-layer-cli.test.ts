import { expect, test } from "bun:test";
import { normalizeTypography } from "./edit/typography-link.ts";

test("typography edits detach the linked style and normalize alignment", () => {
  expect(
    normalizeTypography(
      "text.note",
      { style: { fontSize: 24, fontWeight: 700, textAlign: "center" } },
      { textStyle: "style-1" },
      0,
    ),
  ).toEqual({
    visual: {
      style: { fontSize: 24, fontWeight: 700, textAlign: "middle" },
      textStyle: null,
    },
    detachedStyle: "style-1",
  });
});
test("color alone retains the style link", () => {
  expect(
    normalizeTypography(
      "text.note",
      { style: { color: "red" } },
      { textStyle: "style-1" },
      0,
    ).detachedStyle,
  ).toBeUndefined();
});

import {
  Editor,
  createTextStyle,
  bindSelectionTextStyle,
  DEFAULT_TYPOGRAPHY_STYLE,
} from "@nodetto/core";
import { Batch } from "./edit/batch.ts";

test("batch add text layer and update plain typography", () => {
  const editor = new Editor();
  const batch = new Batch(editor);
  batch.apply(
    {
      op: "add",
      shape: "text:layer",
      label: "Settings",
      visual: { style: { textAlign: "center" } },
    },
    0,
  );
  const id = batch.created[0]!.id;
  expect(editor.store.get(id)?.visual).toMatchObject({
    textPadding: 0,
    textResize: "auto-width",
    style: { textAlign: "middle" },
  });
  batch.apply(
    { op: "update", id, visual: { style: { fontSize: 24, fontWeight: 700 } } },
    1,
  );
  expect(editor.exportPageSvg()).toContain('font-size="24"');
  expect(editor.exportPageSvg()).toContain('font-weight="700"');
});

test("batch update detaches linked typography and warns", () => {
  const editor = new Editor();
  const id = editor.createElement("text.note", { semantic: { text: "Title" } });
  const style = createTextStyle(
    editor,
    "Heading",
    DEFAULT_TYPOGRAPHY_STYLE,
  ) as string;
  editor.selection.set([id]);
  bindSelectionTextStyle(editor, style);
  const batch = new Batch(editor);
  batch.apply(
    { op: "update", id, visual: { style: { fontSize: 24, fontWeight: 700 } } },
    0,
  );
  expect(editor.store.get(id)?.visual.textStyle).toBeUndefined();
  expect(editor.store.get(id)?.visual.style).toMatchObject({
    fontSize: 24,
    fontWeight: 700,
  });
  expect(batch.convertWarnings[0]?.message).toContain(
    `detached text style ${style} from ${id}`,
  );
  expect(editor.exportPageSvg()).toContain('font-size="24"');
});

import { parseDocument, serializeDocument } from "@nodetto/io";
import { runCli, type CommandIo } from "./commands.ts";

test("CLI update detaches style and quiet suppresses warning", () => {
  const editor = new Editor();
  const id = editor.createElement("text.note", { semantic: { text: "Title" } });
  const style = createTextStyle(
    editor,
    "Heading",
    DEFAULT_TYPOGRAPHY_STYLE,
  ) as string;
  editor.selection.set([id]);
  bindSelectionTextStyle(editor, style);
  const source = serializeDocument(editor.store.getSnapshot());
  for (const quiet of [false, true]) {
    const files = new Map([
      ["doc", source],
      [
        "ops",
        JSON.stringify([
          {
            op: "update",
            id,
            visual: { style: { fontSize: 24, fontWeight: 700 } },
          },
        ]),
      ],
    ]);
    const io: CommandIo = {
      readText: (path) => {
        const value = files.get(path);
        if (value === undefined) throw Error("missing");
        return value;
      },
      writeText: (path, text) => {
        files.set(path, text);
      },
    };
    const result = runCli(
      ["edit", "doc", "--ops", "ops", ...(quiet ? ["--quiet"] : [])],
      io,
      "test",
    );
    expect(result.exitCode).toBe(0);
    if (quiet)
      expect(result.stdout + result.stderr).not.toContain(
        "detached text style",
      );
    else
      expect(result.stdout + result.stderr).toContain(
        `detached text style ${style} from ${id}`,
      );
    const updated = parseDocument(files.get("doc")!).elements.find(
      (item) => item.id === id,
    )!;
    expect(updated.visual.textStyle).toBeUndefined();
    expect(updated.visual.style).toMatchObject({
      fontSize: 24,
      fontWeight: 700,
    });
  }
});

test("explicit text style wins over a typography update", () => {
  const editor = new Editor();
  const id = editor.createElement("text.note", { semantic: { text: "Title" } });
  const style = createTextStyle(
    editor,
    "Heading",
    DEFAULT_TYPOGRAPHY_STYLE,
  ) as string;
  editor.selection.set([id]);
  bindSelectionTextStyle(editor, style);
  const batch = new Batch(editor);
  batch.apply(
    { op: "update", id, visual: { textStyle: style, style: { fontSize: 24 } } },
    0,
  );
  expect(editor.store.get(id)?.visual.textStyle).toBe(style);
  expect(batch.convertWarnings).toHaveLength(0);
});

test("vertical alignment keeps a note's text style binding", () => {
  const editor = new Editor();
  const id = editor.createElement("text.note", { semantic: { text: "Title" } });
  const style = createTextStyle(
    editor,
    "Heading",
    DEFAULT_TYPOGRAPHY_STYLE,
  ) as string;
  editor.selection.set([id]);
  bindSelectionTextStyle(editor, style);
  const batch = new Batch(editor);
  batch.apply(
    { op: "update", id, visual: { style: { verticalAlign: "top" } } },
    0,
  );
  expect(editor.store.get(id)?.visual.textStyle).toBe(style);
  expect(batch.convertWarnings).toHaveLength(0);
});
