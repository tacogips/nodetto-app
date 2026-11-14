import { expect, test } from "bun:test";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { document, element, TEST_PAGE } from "../test-helpers.ts";
import { resolveSlideRect } from "./slide-rect.ts";

const registry = createDefaultRegistry();
const frame = (id: string, x = 0) =>
  element({
    id,
    type: "frame",
    semantic: { name: id },
    visual: { x, y: 0, width: 100, height: 100 },
  });
const rect = element({
  id: "rect",
  type: "shape.geo",
  semantic: { geo: "rect", label: "" },
  visual: { x: 300, y: 300, width: 100, height: 100 },
});
const resolve = (
  store: Store,
  input: Parameters<typeof resolveSlideRect>[3] = {},
) => resolveSlideRect(store, registry, TEST_PAGE.id, input);

test("explicit size overrides frames and defaults or overrides origin", () => {
  const store = new Store(document([frame("frame")]));
  const slideSize = { width: 1920, height: 1080 };
  expect(resolve(store, { slideSize })).toEqual({
    kind: "explicit",
    x: 0,
    y: 0,
    ...slideSize,
  });
  expect(
    resolve(store, { slideSize, slideOrigin: { x: 100, y: -50 } }),
  ).toEqual({ kind: "explicit", x: 100, y: -50, ...slideSize });
  expect(resolve(new Store(document([])), { slideSize })).toEqual({
    kind: "explicit",
    x: 0,
    y: 0,
    ...slideSize,
  });
  expect(resolve(new Store(document([])))).toBeNull();
});
test("fallback uses single frame or page content bounds", () => {
  expect(resolve(new Store(document([frame("one")])))).toEqual({
    kind: "artboard",
    frameId: "one",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  expect(
    resolve(new Store(document([frame("one"), frame("two", 200)]))),
  ).toEqual({ kind: "content", x: 0, y: 0, width: 300, height: 100 });
  expect(resolve(new Store(document([rect])))).toEqual({
    kind: "content",
    x: 300,
    y: 300,
    width: 100,
    height: 100,
  });
});
test("frame in hidden group does not become an artboard", () => {
  const group = element({
    id: "group",
    type: "group",
    semantic: { memberIds: ["frame"] },
    visual: { hidden: true },
  });
  expect(resolve(new Store(document([group, frame("frame"), rect])))).toEqual({
    kind: "content",
    x: 300,
    y: 300,
    width: 100,
    height: 100,
  });
});
