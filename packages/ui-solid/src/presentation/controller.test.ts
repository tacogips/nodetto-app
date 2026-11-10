import { expect, test } from "bun:test";
import {
  document,
  element,
  makeEditor,
} from "../../../core/src/test-helpers.ts";
import { createPresentationController } from "./controller.ts";
const pages = [
  { id: "p1", name: "One", kind: "freeform" as const },
  {
    id: "p2",
    name: "Two",
    kind: "freeform" as const,
    hiddenInPresentation: true,
  },
  { id: "p3", name: "Three", kind: "freeform" as const },
];
const rect = element({
  id: "rect",
  page: "p1",
  type: "shape.geo",
  semantic: { geo: "rect", label: "" },
  visual: { x: 10, y: 10, width: 100, height: 100 },
});
test("renders, navigates, isolates keys and exits without editing", () => {
  const editor = makeEditor({ document: document([rect], pages) });
  const exits: string[] = [];
  const controller = createPresentationController({
    editor,
    from: null,
    onExit: (p) => exits.push(p),
  });
  const src = controller.slide().src;
  expect(src?.startsWith("data:image/svg+xml")).toBe(true);
  expect(decodeURIComponent(src ?? "")).toContain('data-id="rect"');
  expect(controller.counterText()).toBe("1 / 2");
  const revision = editor.revision;
  let prevented = 0;
  let stopped = 0;
  const press = (key: string) =>
    controller.handleKeyDown({
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: () => prevented++,
      stopImmediatePropagation: () => stopped++,
    });
  press("ArrowRight");
  expect(controller.counterText()).toBe("2 / 2");
  press("Home");
  press("2");
  expect(controller.counterText()).toBe("Go to: 2");
  press("Enter");
  expect(controller.state()?.index).toBe(1);
  press("B");
  expect(controller.state()?.black).toBe(true);
  press("Backspace");
  press("q");
  expect(prevented).toBe(7);
  expect(stopped).toBe(7);
  expect(editor.revision).toBe(revision);
  press("2");
  press("Escape");
  expect(exits).toEqual([]);
  press("Escape");
  press("Escape");
  expect(exits).toEqual(["p1"]);
  const box = controller.layout({ width: 800, height: 600 });
  expect(Object.values(box).every(Number.isFinite)).toBe(true);
});
test("reconciles hidden pages and renders inherited hidden frame fallback", () => {
  const group = element({
    id: "group",
    page: "p1",
    type: "group",
    semantic: { memberIds: ["frame"] },
    visual: { hidden: true },
  });
  const frame = element({
    id: "frame",
    page: "p1",
    type: "frame",
    semantic: { name: "frame" },
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const editor = makeEditor({
    document: document([group, frame, rect], pages),
  });
  const controller = createPresentationController({
    editor,
    from: "p1",
    onExit: () => {},
  });
  expect(decodeURIComponent(controller.slide().src ?? "")).toContain(
    'data-id="rect"',
  );
  editor.setPageHiddenInPresentation("p1", true);
  controller.refresh();
  expect(controller.state()?.slides).toEqual(["p3"]);
  expect(controller.counterText()).toBe("1 / 1");
});
