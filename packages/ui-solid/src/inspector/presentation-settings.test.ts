import { expect, test } from "bun:test";
import { DEFAULT_SLIDE_SIZE, Editor } from "@nodetto/core";
import {
  clampSlideDimension,
  slideOriginCommand,
  slideSizeCommand,
} from "./presentation-settings.ts";
test("slide size commands select presets, clear, and avoid no-op", () => {
  const size = { width: 1920, height: 1080 };
  expect(slideSizeCommand(undefined, "16:9")).toEqual({
    type: "updateDocument",
    document: { slideSize: size },
  });
  expect(slideSizeCommand(size, "16:9")).toBeNull();
  expect(slideSizeCommand(size, "none")).toEqual({
    type: "updateDocument",
    document: { slideSize: null },
  });
  expect(slideSizeCommand(undefined, "none")).toBeNull();
  expect(slideSizeCommand(undefined, "custom")).toEqual({
    type: "updateDocument",
    document: { slideSize: DEFAULT_SLIDE_SIZE },
  });
  expect(slideSizeCommand(undefined, "a4-landscape")).toEqual({
    type: "updateDocument",
    document: { slideSize: { width: 1123, height: 794 } },
  });
  expect(clampSlideDimension(0)).toBe(1);
  expect(clampSlideDimension(2e5)).toBe(100000);
  expect(clampSlideDimension(Number.NaN)).toBeNull();
});
test("origin commands and undo restore previous state", () => {
  const editor = new Editor();
  const page = editor.store.getPage(editor.currentPageId)!;
  const origin = { x: 4, y: 5 };
  const withOrigin = { ...page, slideOrigin: origin };
  expect(slideOriginCommand(withOrigin, origin)).toBeNull();
  expect(slideOriginCommand(withOrigin, null)).toEqual({
    type: "updatePage",
    id: page.id,
    page: { slideOrigin: null },
  });
  const before = editor.getSnapshot();
  const size = slideSizeCommand(undefined, "16:9")!;
  editor.apply([size]);
  editor.undo();
  expect(editor.getSnapshot()).toEqual(before);
  const command = slideOriginCommand(page, origin)!;
  editor.apply([command]);
  editor.undo();
  expect(editor.getSnapshot()).toEqual(before);
});
