import { expect, test } from "bun:test";
import { hasErrors, SLIDE_SETTINGS_TYPE, validateDocument } from "@nodetto/ir";
import { addPageGuide } from "../page-guides.ts";
import { createColorToken } from "../color-tokens.ts";
import { createReviewComment } from "../comments.ts";
import type { Editor } from "../editor.ts";
import { createNumberToken } from "../number-tokens.ts";
import { document, element, makeEditor, TEST_PAGE } from "../test-helpers.ts";
import { createTextStyle } from "../text-styles.ts";

function expectValid(editor: Editor): void {
  expect(hasErrors(validateDocument(editor.getSnapshot()))).toBe(false);
}

function setup() {
  const editor = makeEditor();
  const freeform = editor.currentPageId;
  editor.createElement("shape.geo");
  const cad = editor.createPage({ kind: "cad3d" });
  const sketch = editor.createElement("cad.sketch");
  const circle = editor.createElement("cad.circle", {
    semantic: { sketch, c: [10, 10], r: 5 },
  });
  expectValid(editor);
  return { editor, freeform, cad, sketch, circle };
}

test("copyPageElements and setPageKind reject incompatible page pairs", () => {
  const { editor, freeform, cad } = setup();
  const before = editor.getSnapshot();
  expect(editor.copyPageElements(freeform, cad)).toBeNull();
  expectValid(editor);
  expect(editor.copyPageElements(cad, freeform)).toBeNull();
  expectValid(editor);
  expect(editor.setPageKind(freeform, "cad3d")).toBe(false);
  expectValid(editor);
  expect(editor.setPageKind(cad, "freeform")).toBe(false);
  expectValid(editor);
  expect(editor.getSnapshot()).toBe(before);
  expect(editor.currentPageId).toBe(cad);
});

test("setPageKind can restore a mislabeled CAD page without recording an undo", () => {
  const editor = makeEditor({
    document: document([
      element({
        id: "sketch",
        type: "cad.sketch",
        semantic: { name: "Outline", plane: { base: "xy" } },
      }),
    ]),
  });
  expect(editor.setPageKind(TEST_PAGE.id, "cad3d")).toBe(true);
  expect(editor.canUndo()).toBe(false);
  expectValid(editor);
});

test("duplicatePage keeps CAD kind, remaps references and retains carriers", () => {
  const { editor, cad, sketch } = setup();
  const comment = createReviewComment(
    editor,
    { x: 0, y: 0 },
    {
      id: "comment",
      author: "Engineer",
      body: "Check fit",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    sketch,
  );
  expect(comment).not.toBeNull();
  editor.createElement(SLIDE_SETTINGS_TYPE, {
    semantic: {},
    visual: { animation: { slide: { stagger: false } } },
  });
  expectValid(editor);
  const copy = editor.duplicatePage(cad);
  if (!copy) throw new Error("Expected a CAD page copy");
  expect(editor.store.getPage(copy)?.kind).toBe("cad3d");
  const elements = editor.store.getPageElements(copy);
  expect(elements).toHaveLength(4);
  const newSketch = elements.find(({ type }) => type === "cad.sketch");
  expect(newSketch?.id).toBeDefined();
  expect(newSketch?.id).not.toBe(sketch);
  expect(
    elements.find(({ type }) => type === "cad.circle")?.semantic,
  ).toMatchObject({ sketch: newSketch?.id });
  expect(
    elements.find(({ type }) => type === "review.comment")?.semantic,
  ).toMatchObject({ target: newSketch?.id });
  expect(
    elements.find(({ type }) => type === SLIDE_SETTINGS_TYPE)?.visual,
  ).toMatchObject({ animation: { slide: { stagger: false } } });
  expectValid(editor);
});

test("breadboard and PCB creators leave a CAD page alone", () => {
  const { editor, cad } = setup();
  const before = editor.getSnapshot();
  expect(
    editor.createBreadboardPart("breadboard.resistor", { x: 0, y: 0 }),
  ).toBeNull();
  expectValid(editor);
  expect(
    editor.addPcbTrack(cad, {
      layer: "F.Cu",
      width: 0.25,
      net: "",
      points: [
        [0, 0],
        [10, 0],
      ],
    }),
  ).toBe("");
  expectValid(editor);
  expect(
    editor.addPcbVia(cad, { at: [0, 0], diameter: 0.6, drill: 0.3, net: "" }),
  ).toBe("");
  expectValid(editor);
  expect(editor.getSnapshot()).toBe(before);
});

test("group, frame, boolean, component and connection helpers leave CAD selections alone", () => {
  const { editor, cad, freeform, sketch, circle } = setup();
  const frame = editor.createElement("frame", { page: freeform });
  expect(editor.makeComponent(frame)).toBe(true);
  editor.selection.set([sketch, circle]);
  const before = editor.getSnapshot();
  expect(editor.groupSelection()).toBeNull();
  expectValid(editor);
  expect(editor.canFrameSelection()).toBe(false);
  expect(editor.frameSelection()).toBeNull();
  expectValid(editor);
  expect(editor.booleanSelection("union")).toBeNull();
  expectValid(editor);
  expect(editor.makeComponent(sketch)).toBe(false);
  expect(editor.createComponentInstance(sketch)).toBeNull();
  expect(editor.createComponentInstance(frame)).toBeNull();
  expectValid(editor);
  expect(editor.connect(sketch, circle, cad)).toBeNull();
  expect(editor.connectSmart(sketch, circle)).toBeNull();
  expectValid(editor);
  expect(editor.getSnapshot()).toBe(before);
  expect([...editor.selection.ids()]).toEqual([sketch, circle]);
});

test("resource creators work on a CAD page", () => {
  const { editor, cad, sketch } = setup();
  const assertResource = (id: string | null, type: string) => {
    if (!id) throw new Error(`Expected ${type}`);
    expect(editor.store.get(id)).toMatchObject({ page: cad, type });
    expectValid(editor);
  };
  assertResource(createColorToken(editor, "Plate", "#345678"), "design.token");
  assertResource(createNumberToken(editor, "Spacing", 12), "design.token");
  assertResource(createTextStyle(editor, "Caption"), "design.text-style");
  assertResource(addPageGuide(editor, cad, "x", 25), "design.guide");
  assertResource(
    createReviewComment(
      editor,
      { x: 0, y: 0 },
      {
        id: "review",
        author: "Engineer",
        body: "Check clearance",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      sketch,
    ),
    "review.comment",
  );
  assertResource(
    editor.createElement(SLIDE_SETTINGS_TYPE, {
      semantic: {},
      visual: { animation: { slide: { stagger: false } } },
    }),
    SLIDE_SETTINGS_TYPE,
  );
});
