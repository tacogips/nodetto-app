import { expect, test } from "bun:test";
import {
  expandSlides,
  slideLabel,
  slideList,
  startSlideIndex,
  createPresentationState,
  reducePresentation,
} from "@nodetto/core";
import {
  document,
  element,
  makeEditor,
} from "../../../core/src/test-helpers.ts";
import { createPresentationController } from "./controller.ts";
import { renderSlide } from "./slide-render.ts";

const pages = [
  { id: "p1", name: "One", kind: "freeform" as const },
  { id: "p2", name: "Two", kind: "freeform" as const },
  {
    id: "hidden",
    name: "Hidden",
    kind: "freeform" as const,
    hiddenInPresentation: true,
  },
];
const frame = (id: string, x: number, y: number) =>
  element({
    id,
    page: "p1",
    type: "frame",
    semantic: { name: id, page: { size: "a4", orientation: "portrait" } },
    visual: { x, y, width: 300, height: 200 },
  });

test("page frames expand, clip, reconcile and navigate", () => {
  const editor = makeEditor({
    document: {
      ...document([frame("later", 500, 400), frame("first", 0, 0)], pages),
      slideSize: { width: 1920, height: 1080 },
    },
  });
  const refs = expandSlides(editor.store, editor.registry, slideList(pages));
  expect(refs).toEqual([
    { page: "p1", frame: "first" },
    { page: "p1", frame: "later" },
    { page: "p2" },
  ]);
  expect(
    startSlideIndex(
      pages.map((p) => p.id),
      refs,
      "p2",
    ),
  ).toBe(2);
  expect(
    slideLabel(
      pages,
      "p1",
      new Map([
        ["p1", 2],
        ["p2", 1],
      ]),
    ),
  ).toBe("Slides 1-2 / 3");
  expect(
    slideLabel(
      pages,
      "p2",
      new Map([
        ["p1", 2],
        ["p2", 1],
      ]),
    ),
  ).toBe("Slide 3 / 3");
  const reconciled = reducePresentation(createPresentationState(refs, 1), {
    type: "reconcile",
    slides: refs.slice(1),
  });
  expect(reconciled?.index).toBe(0);
  const rendered = renderSlide(editor, refs[0]!);
  expect(rendered.rect).toEqual({ x: 0, y: 0, width: 300, height: 200 });
  expect(rendered.svg).toContain('overflow="hidden"');
  const exits: string[] = [];
  const controller = createPresentationController({
    editor,
    from: "p1",
    onExit: (p) => exits.push(p),
  });
  expect(controller.counterText()).toBe("1 / 3");
  expect(controller.slide().size).toEqual({ width: 300, height: 200 });
  controller.dispatch({ type: "next" });
  expect(controller.transition()).toBeNull();
  controller.dispatch("exit");
  expect(exits).toEqual(["p1"]);
});
