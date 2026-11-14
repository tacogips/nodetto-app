import { expect, test } from "bun:test";
import { Editor } from "./editor.ts";
import { shapeCreation, connectShape } from "./shape-catalogue.ts";
import { connectPrototypeBack } from "./screen-transition.ts";
import { frameTitleBox, resolveTitlePlacement } from "./shapes/frame.ts";
import { Tool } from "./tools.ts";

test("text and device creation defaults", () => {
  expect(shapeCreation(Tool.TextLayer)?.visual).toMatchObject({
    textMeasure: "proportional",
    textPadding: 0,
  });
  const editor = new Editor();
  const creation = shapeCreation(Tool.IPhone402Frame)!;
  const id = editor.createElement(creation.type, creation);
  expect(editor.store.get(id)).toMatchObject({
    visual: { width: 402, height: 874 },
    semantic: { safeArea: { top: 62 } },
  });
});
test("frame title placement and hit testing", () => {
  expect(resolveTitlePlacement({ name: "i", platform: "ios" })).toBe("outside");
  expect(resolveTitlePlacement({ name: "d" })).toBe("inside");
  expect(
    resolveTitlePlacement({
      name: "i",
      platform: "ios",
      titlePlacement: "inside",
    }),
  ).toBe("inside");
  expect(resolveTitlePlacement({ name: "p", screenKind: "popup" })).toBe(
    "outside",
  );
  expect(
    frameTitleBox(
      { x: 0, y: 100, width: 200, height: 300 },
      { name: "i", platform: "ios" },
    )?.y,
  ).toBe(78);
  expect(
    frameTitleBox(
      { x: 0, y: 100, width: 200, height: 300 },
      { name: "i", showTitle: false },
    ),
  ).toBeUndefined();
  const editor = new Editor();
  const util = editor.getShapeUtil("frame");
  const device = editor.buildElement("frame", {
    semantic: { name: "i", platform: "ios" },
    visual: { x: 0, y: 100, width: 200, height: 300 },
  });
  const diagram = editor.buildElement("frame", {
    semantic: { name: "d" },
    visual: { x: 0, y: 100, width: 200, height: 300 },
  });
  expect(
    util.hitTest(device, { x: 50, y: 115 }, editor.createShapeContext()),
  ).toBe(false);
  expect(
    util.hitTest(diagram, { x: 50, y: 115 }, editor.createShapeContext()),
  ).toBe(true);
});
test("back links target the source screen", () => {
  const editor = new Editor();
  const screen = editor.createElement("frame", {
    semantic: { name: "Home", platform: "ios" },
    visual: { x: 0, y: 0, width: 400, height: 800 },
  });
  const child = editor.createElement("ui.control", {
    semantic: { control: "button", label: "Back" },
    visual: { x: 20, y: 60, width: 100, height: 44 },
  });
  const orphan = editor.createElement("text.note", {
    visual: { x: 1000, y: 1000 },
  });
  expect(connectPrototypeBack(editor, orphan)).toBeNull();
  const edge = connectShape(editor, Tool.PrototypeBack, child, orphan);
  expect(editor.store.get(edge ?? "")?.semantic).toMatchObject({
    from: child,
    to: screen,
    prototype: true,
    prototypeAction: "back",
    prototypeTransition: "instant",
  });
});
