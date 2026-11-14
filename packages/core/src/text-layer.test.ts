import { expect, test } from "bun:test";
import { element, makeEditor } from "./test-helpers.ts";
import { measureTextNote, textNoteLines } from "./text-layout.ts";
import { measureTextWidth } from "./text-measure.ts";

test("proportional text sizes through transactions and distinguishes weight", () => {
  const editor = makeEditor();
  const note = editor.buildElement("text.note", {
    semantic: { text: "Inbox" },
    visual: {
      textPadding: 0,
      textResize: "auto-width",
      textMeasure: "proportional",
      style: { fontSize: 17, lineHeight: 1.29 },
    },
  });
  editor.apply([{ type: "createElement", element: note }]);
  expect(editor.getBounds(note.id)?.width).toBe(
    measureTextWidth("Inbox", { fontSize: 17 }, "proportional"),
  );
  expect(editor.getBounds(note.id)?.height).toBe(17 * 1.29);
  expect(
    measureTextNote(
      {
        ...note,
        visual: { ...note.visual, style: { fontSize: 17, fontWeight: 700 } },
      },
      "auto-width",
    ).width,
  ).toBeGreaterThan(measureTextNote(note, "auto-width").width);
});
test("fixed text truncates to one SVG line", () => {
  const editor = makeEditor();
  const note = editor.buildElement("text.note", {
    semantic: { text: "Direct messages and more" },
    visual: {
      width: 60,
      height: 30,
      textPadding: 0,
      textMeasure: "proportional",
      textTruncate: "ellipsis",
      style: { fontSize: 17 },
    },
  });
  editor.apply([{ type: "createElement", element: note }]);
  expect(textNoteLines(note).truncated).toBe(true);
  expect(editor.exportPageSvg()).toContain("…</text>");
});
test("ellipsis auto-width joins lines without truncation", () => {
  const note = element({
    id: "n",
    type: "text.note",
    semantic: { text: "A\nB" },
    visual: {
      textResize: "auto-width",
      textTruncate: "ellipsis",
      textMeasure: "proportional",
    },
  });
  expect(textNoteLines(note).lines).toEqual(["A B"]);
  expect(textNoteLines(note).truncated).toBe(false);
});

test("rich ellipsis clips after joined CRLF and styles the cut", () => {
  const editor = makeEditor();
  const width =
    measureTextWidth("AB C…", { fontSize: 17 }, "proportional") + 0.01;
  const note = editor.buildElement("text.note", {
    semantic: {
      text: "AB\r\nCDEFG",
      marks: [
        { start: 0, end: 5, kind: "bold" },
        { start: 5, end: 9, kind: "link", href: "https://nodetto.app" },
      ],
    },
    visual: {
      width,
      height: 30,
      textPadding: 0,
      textMeasure: "proportional",
      textTruncate: "ellipsis",
      style: { fontSize: 17 },
    },
  });
  editor.apply([{ type: "createElement", element: note }]);
  expect(textNoteLines(note).lines).toEqual(["AB C…"]);
  const svg = editor.exportPageSvg() ?? "";
  expect(svg).toContain('<tspan font-weight="700">AB C</tspan>');
  expect(svg).toContain(
    '<a href="https://nodetto.app" rel="noopener noreferrer"><tspan fill="#335c67" text-decoration="underline"',
  );
  expect(svg).toContain(">…</tspan></a>");
});
test("rich auto-width ellipsis joins LF and retains marks", () => {
  const editor = makeEditor();
  const note = editor.buildElement("text.note", {
    semantic: { text: "AB\nCD", marks: [{ start: 3, end: 5, kind: "bold" }] },
    visual: {
      textPadding: 0,
      textResize: "auto-width",
      textMeasure: "proportional",
      textTruncate: "ellipsis",
      style: { fontSize: 17 },
    },
  });
  editor.apply([{ type: "createElement", element: note }]);
  const svg = editor.exportPageSvg() ?? "";
  expect(svg).toContain(
    '<tspan>AB </tspan><tspan font-weight="700">CD</tspan>',
  );
});

test("proportional auto-width keeps explicit lines despite fractional spacing", () => {
  for (const sample of [
    {
      text: "meA",
      padding: 8,
      fontSize: 15,
      fontWeight: 600,
      letterSpacing: -0.3,
    },
    {
      text: "e J",
      padding: 1,
      fontSize: 11,
      fontWeight: 400,
      letterSpacing: 0.1,
    },
  ]) {
    const editor = makeEditor();
    const note = editor.buildElement("text.note", {
      semantic: { text: sample.text },
      visual: {
        textResize: "auto-width",
        textMeasure: "proportional",
        textPadding: sample.padding,
        style: {
          fontSize: sample.fontSize,
          fontWeight: sample.fontWeight,
          letterSpacing: sample.letterSpacing,
        },
      },
    });
    editor.apply([{ type: "createElement", element: note }]);
    const sized = editor.store.get(note.id)!;
    expect(textNoteLines(sized).lines).toEqual([sample.text]);
    const svg = editor.exportPageSvg() ?? "";
    expect(svg).toContain(`>${sample.text}<`);
    expect((svg.match(/<text\b/g) ?? []).length).toBe(1);
  }
  const multiline = element({
    id: "multiline",
    type: "text.note",
    semantic: { text: "one\r\ntwo" },
    visual: { textResize: "auto-width", textMeasure: "proportional", width: 1 },
  });
  expect(textNoteLines(multiline).lines).toEqual(["one", "two"]);
});
