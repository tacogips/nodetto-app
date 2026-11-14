import { expect, test } from "bun:test";
import { frameFileStem, orderedTopLevelFrames } from "./frame-order.ts";
import { document, element, makeEditor } from "./test-helpers.ts";

test("top-level visible frames follow row-major reading order", () => {
  const frames = [
    ["b", 100, 0],
    ["a", 0, 4],
    ["c", 200, 8],
    ["e", 100, 110],
    ["d", 0, 105],
    ["f", 200, 112],
  ] as const;
  const editor = makeEditor({
    document: document(
      frames.map(([id, x, y], i) =>
        element({
          id,
          index: `a${i + 1}`,
          type: "frame",
          semantic: { name: id, memberIds: [] },
          visual: { x, y, width: 80, height: 100 },
        }),
      ),
    ),
  });
  expect(
    orderedTopLevelFrames(
      editor.store,
      editor.currentPageId,
      editor.createShapeContext(),
    ),
  ).toEqual(["a", "b", "c", "d", "e", "f"]);
});

test("frame stems are stable and safe", () => {
  expect(frameFileStem(0, "Home / Feed")).toBe("01-home-feed");
  expect(frameFileStem(0, "!!!")).toBe("01-frame");
  expect(frameFileStem(99, "Hello")).toBe("100-hello");
});
