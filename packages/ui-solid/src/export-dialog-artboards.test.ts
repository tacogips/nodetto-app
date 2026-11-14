import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import {
  exportArtboardsZip,
  exportSelectedPrototype,
} from "./ExportDialog.tsx";

test("artboard ZIP uses numbered reading-order filenames", async () => {
  const editor = new Editor();
  for (const [name, x] of [
    ["Right", 400],
    ["Left", 0],
    ["Middle", 200],
  ] as const) {
    editor.createElement("frame", {
      semantic: { name },
      visual: { x, y: 0, width: 100, height: 100 },
    });
  }
  const zip = await exportArtboardsZip(editor, "svg", 2);
  const text = new TextDecoder().decode(zip);
  const names = ["01-left.svg", "02-middle.svg", "03-right.svg"];
  for (const name of names) expect(text).toContain(name);
  expect(text.indexOf(names[0])).toBeLessThan(text.indexOf(names[1]));
  expect(text.indexOf(names[1])).toBeLessThan(text.indexOf(names[2]));
});

test("prototype export uses the selected flow", () => {
  const editor = new Editor();
  editor.createElement("frame", {
    semantic: {
      name: "First",
      screenKind: "screen",
      prototypeStart: true,
      prototypeFlowName: "First flow",
    },
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const selected = editor.createElement("frame", {
    semantic: {
      name: "Second",
      screenKind: "screen",
      prototypeStart: true,
      prototypeFlowName: "Second flow",
    },
    visual: { x: 200, y: 0, width: 100, height: 100 },
  });
  const html = exportSelectedPrototype(editor, "Second flow", false);
  expect(html).toContain(`"start":"${selected}"`);
  expect(html).not.toContain('class="viewport bezel"');
});
