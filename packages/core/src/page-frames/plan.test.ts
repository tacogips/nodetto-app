import { expect, test } from "bun:test";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { document, element, TEST_PAGE } from "../test-helpers.ts";
import {
  documentPageSequence,
  neighbourPageFrame,
  pageFramePresetOf,
  pageFrameSize,
  pageFramesInFlowOrder,
  planAddPageFrameGeometry,
  planReflowPageFrames,
  planShiftPageFrames,
  referencePageFrame,
} from "./index.ts";
const registry = createDefaultRegistry();
const frame = (
  id: string,
  x: number,
  y: number,
  index = "a1",
  members?: string[],
) =>
  element({
    id,
    type: "frame",
    index,
    semantic: {
      name: id,
      page: { size: "a4", orientation: "portrait" },
      ...(members ? { memberIds: members } : {}),
    },
    visual: { x, y, width: 794, height: 1123 },
  });
const a = frame("a", 0, 0);
const b = frame("b", 0, 1171);
const c = frame("c", 0, 2342);
const geometry = (id: string, x: number, y: number) => ({
  id,
  x,
  y,
  width: 794,
  height: 1123,
  page: { size: "a4", orientation: "portrait" as const },
});
test("preset dimensions, custom, and tolerance", () => {
  expect(pageFrameSize("a4", "landscape")).toEqual({
    width: 1123,
    height: 794,
  });
  expect(pageFrameSize("slide-16-9", "landscape")).toEqual({
    width: 1920,
    height: 1080,
  });
  expect(
    pageFrameSize("custom", "portrait", { width: 500, height: 400 }),
  ).toEqual({ width: 500, height: 400 });
  expect(
    pageFramePresetOf(
      { width: 794.5, height: 1123 },
      { size: "a4", orientation: "portrait" },
    ),
  ).toBe("a4");
  expect(
    pageFramePresetOf(
      { width: 795, height: 1123 },
      { size: "a4", orientation: "portrait" },
    ),
  ).toBe("custom");
});
test("flow order excludes nested frames and uses axis and id ties", () => {
  const nested = {
    ...frame("nested", 10, 10, "a2"),
    visual: { x: 10, y: 10, width: 100, height: 100 },
  };
  const store = new Store(document([c, nested, b, a]));
  expect(
    pageFramesInFlowOrder(store, registry, TEST_PAGE.id).map((f) => f.id),
  ).toEqual(["a", "b", "c"]);
  const horizontal = new Store(
    document(
      [frame("z", 0, 0), frame("a", 0, 0), frame("r", 1000, -5)],
      [{ ...TEST_PAGE, pageFlow: "horizontal" }],
    ),
  );
  expect(
    pageFramesInFlowOrder(horizontal, registry, TEST_PAGE.id).map((f) => f.id),
  ).toEqual(["a", "z", "r"]);
});
test("add geometry shifts later frames and handles empty or occupied pages", () => {
  const frames = [geometry("a", 0, 0), geometry("b", 0, 1171)];
  expect(
    planAddPageFrameGeometry({
      flow: "vertical",
      frames,
      anchorId: "a",
      contentBounds: null,
    }),
  ).toEqual({
    x: 0,
    y: 1171,
    width: 794,
    height: 1123,
    size: "a4",
    orientation: "portrait",
    shifted: [{ id: "b", dx: 0, dy: 1171 }],
  });
  expect(
    planAddPageFrameGeometry({
      flow: "horizontal",
      frames,
      anchorId: "a",
      contentBounds: null,
    }).shifted,
  ).toEqual([{ id: "b", dx: 842, dy: 0 }]);
  expect(
    planAddPageFrameGeometry({
      flow: "vertical",
      frames: [],
      anchorId: null,
      contentBounds: null,
    }).x,
  ).toBe(0);
  expect(
    planAddPageFrameGeometry({
      flow: "vertical",
      frames: [],
      anchorId: null,
      contentBounds: { x: 10, y: 10, width: 100, height: 100 },
    }).y,
  ).toBe(158);
  expect(planReflowPageFrames(frames, "horizontal")).toEqual([
    { id: "b", dx: 842, dy: -1171 },
  ]);
});
test("shifts carry and deduplicate descendants", () => {
  const child = element({
    id: "child",
    type: "text.note",
    index: "a2",
    semantic: { text: "hello" },
    visual: { x: 20, y: 20, width: 100, height: 40 },
  });
  const store = new Store(document([frame("a", 0, 0, "a1", ["child"]), child]));
  const moves = planShiftPageFrames(store, registry, [
    { id: "a", dx: 10, dy: 20 },
    { id: "a", dx: 10, dy: 20 },
  ]);
  expect(
    moves.filter(
      (command) => command.type === "updateVisual" && command.id === "child",
    ),
  ).toEqual([{ type: "updateVisual", id: "child", visual: { x: 30, y: 40 } }]);
});
test("navigation prefers viewport, then selection, then nearest and stops at ends", () => {
  const frames = [a, b, c];
  const boxes = new Map(
    frames.map((f) => [
      f.id,
      { x: f.visual.x ?? 0, y: f.visual.y ?? 0, width: 794, height: 1123 },
    ]),
  );
  expect(referencePageFrame(frames, boxes, { x: 0, y: 1171 }, "a")).toBe("b");
  expect(referencePageFrame(frames, boxes, { x: 2000, y: 1200 }, "b")).toBe(
    "b",
  );
  expect(referencePageFrame(frames, boxes, { x: 2000, y: 1200 }, null)).toBe(
    "b",
  );
  expect(neighbourPageFrame(frames, "a", "previous")).toBeNull();
  expect(neighbourPageFrame(frames, "c", "next")).toBeNull();
  expect(neighbourPageFrame(frames, "b", "next")).toBe("c");
});
test("sequence follows tab and flow order, includes hidden pages and skips empty pages", () => {
  const shape = element({
    id: "shape",
    page: "second",
    type: "shape.geo",
    semantic: { geo: "rect", label: "" },
    visual: { x: 10, y: 20, width: 100, height: 50 },
  });
  const store = new Store(
    document(
      [b, a, shape],
      [
        TEST_PAGE,
        {
          id: "second",
          name: "Second",
          kind: "freeform",
          hiddenInPresentation: true,
        },
        { id: "empty", name: "Empty", kind: "freeform" },
      ],
    ),
  );
  expect(documentPageSequence(store, registry)).toEqual([
    {
      pageId: TEST_PAGE.id,
      frameId: "a",
      rect: { x: 0, y: 0, width: 794, height: 1123 },
    },
    {
      pageId: TEST_PAGE.id,
      frameId: "b",
      rect: { x: 0, y: 1171, width: 794, height: 1123 },
    },
    { pageId: "second", rect: { x: -6, y: 4, width: 132, height: 82 } },
  ]);
});
