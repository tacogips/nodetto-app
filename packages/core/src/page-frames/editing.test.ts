import { expect, test } from "bun:test";
import { document, element, makeEditor, TEST_PAGE } from "../test-helpers.ts";

const frame = (id: string, x: number, y: number, name: string) =>
  element({
    id,
    type: "frame",
    semantic: {
      name,
      page: { size: "a4", orientation: "portrait" },
      showTitle: false,
      clipContent: true,
    },
    visual: { x, y, width: 794, height: 1123 },
  });
const a = frame("a", 0, 0, "Page 1");
const b = frame("b", 0, 1171, "Page 2");
const child = element({
  id: "child",
  index: "b1",
  type: "text.note",
  semantic: { text: "note" },
  visual: { x: 20, y: 1200, width: 100, height: 60 },
});

test("insert after selected frame moves later page and child in one undo", () => {
  const editor = makeEditor({ document: document([a, b, child]) });
  editor.selection.set(["a"]);
  const before = editor.history.undoSize;
  const id = editor.addPageFrame();
  expect(id).toBeTruthy();
  if (!id) throw new Error("no page");
  expect(editor.store.get(id)?.visual.y).toBe(1171);
  expect((editor.store.get(id)?.semantic as { name: string }).name).toBe(
    "Page 3",
  );
  expect(editor.store.get("b")?.visual.y).toBe(2342);
  expect(editor.store.get("child")?.visual.y).toBe(2371);
  expect([...editor.selection.ids()]).toEqual([id]);
  expect(editor.history.undoSize).toBe(before + 1);
  editor.undo();
  expect(editor.store.get(id)).toBeUndefined();
  expect(editor.store.get("b")?.visual.y).toBe(1171);
  expect(editor.store.get("child")?.visual.y).toBe(1200);
});

test("empty page defaults follow flow", () => {
  for (const flow of ["vertical", "horizontal"] as const) {
    const editor = makeEditor({
      document: document([], [{ ...TEST_PAGE, pageFlow: flow }]),
    });
    const id = editor.addPageFrame();
    if (!id) throw new Error("no page");
    expect(editor.store.get(id)?.visual).toMatchObject(
      flow === "vertical"
        ? { x: 0, y: 0, width: 794, height: 1123 }
        : { x: 0, y: 0, width: 1920, height: 1080 },
    );
  }
});

test("flow changes reflow in one undo and unchanged flow does nothing", () => {
  const editor = makeEditor({ document: document([a, b, child]) });
  expect(editor.setPageFlow(TEST_PAGE.id, "vertical")).toBe(false);
  expect(editor.history.undoSize).toBe(0);
  expect(editor.setPageFlow(TEST_PAGE.id, "horizontal")).toBe(true);
  expect(editor.history.undoSize).toBe(1);
  expect(editor.store.getPage(TEST_PAGE.id)?.pageFlow).toBe("horizontal");
  expect(editor.store.get("b")?.visual).toMatchObject({ x: 842, y: 0 });
  expect(editor.store.get("child")?.visual).toMatchObject({ x: 862, y: 29 });
  editor.undo();
  expect(editor.store.getPage(TEST_PAGE.id)).not.toHaveProperty("pageFlow");
  expect(editor.store.get("b")?.visual).toMatchObject({ x: 0, y: 1171 });
});

for (const flow of ["vertical", "horizontal"] as const)
  test(`navigation uses viewed frame in ${flow} flow`, () => {
    const boxes = [0, 1, 2].map((i) => ({
      x: flow === "horizontal" ? i * 842 : 0,
      y: flow === "vertical" ? i * 1171 : 0,
      width: 794,
      height: 1123,
    }));
    const frames = boxes.map((box, i) =>
      frame(String.fromCharCode(97 + i), box.x, box.y, `Page ${i + 1}`),
    );
    const editor = makeEditor({
      document: document(frames, [{ ...TEST_PAGE, pageFlow: flow }]),
    });
    const size = { width: 1000, height: 800 };
    editor.selection.set(["a"]);
    editor.camera.fitBox(boxes[0]!, size, { maxZoom: 4 });
    const assertCenter = (i: number) => {
      const center = editor.camera.screenToPage({
        x: size.width / 2,
        y: size.height / 2,
      });
      expect(center.x).toBeCloseTo(boxes[i]!.x + 397);
      expect(center.y).toBeCloseTo(boxes[i]!.y + 561.5);
    };
    expect(editor.goToPageFrame("next", size)).toBe(true);
    assertCenter(1);
    expect(editor.goToPageFrame("next", size)).toBe(true);
    assertCenter(2);
    const atEnd = editor.camera.get();
    expect(editor.goToPageFrame("next", size)).toBe(false);
    expect(editor.camera.get()).toEqual(atEnd);
    expect(editor.goToPageFrame("previous", size)).toBe(true);
    assertCenter(1);
    editor.selection.set(["b"]);
    editor.camera.set({ x: 10000, y: 10000, z: 1 });
    expect(editor.goToPageFrame("next", size)).toBe(true);
    assertCenter(2);
    editor.camera.fitBox(boxes[2]!, size, { maxZoom: 4 });
    expect(editor.goToPageFrame("previous", size)).toBe(true);
    assertCenter(1);
    expect([...editor.selection.ids()]).toEqual(["b"]);
    expect(editor.history.undoSize).toBe(0);
  });
