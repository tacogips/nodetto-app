import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { currentPageFlows, focusPrototypeFlow } from "./FlowsPanel.tsx";

test("flows are listed by name and focusing selects and zooms to their screens", () => {
  const editor = new Editor();
  const first = editor.createElement("frame", {
    semantic: {
      name: "First",
      screenKind: "screen",
      prototypeStart: true,
      prototypeFlowName: "Zebra",
    },
    visual: { x: 0, y: 0, width: 200, height: 400 },
  });
  const second = editor.createElement("frame", {
    semantic: { name: "Second", screenKind: "screen" },
    visual: { x: 500, y: 0, width: 200, height: 400 },
  });
  editor.createElement("frame", {
    semantic: {
      name: "Third",
      screenKind: "screen",
      prototypeStart: true,
      prototypeFlowName: "Alpha",
    },
    visual: { x: 1000, y: 0, width: 200, height: 400 },
  });
  editor.createElement("edge.generic", {
    semantic: { from: first, to: second, prototype: true },
  });
  const flows = currentPageFlows(editor);
  expect(flows.map((flow) => flow.name)).toEqual(["Alpha", "Zebra"]);
  expect(flows.map((flow) => flow.screens.length)).toEqual([1, 2]);
  const before = editor.camera.get();
  focusPrototypeFlow(editor, flows[1]!, { width: 600, height: 400 });
  expect([...editor.selection.ids()]).toEqual([first, second]);
  expect(editor.camera.get()).not.toEqual(before);
});
