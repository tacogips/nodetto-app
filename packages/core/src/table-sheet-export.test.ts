import { expect, test } from "bun:test";
import { Editor } from "./editor.ts";
import { createDefaultRegistry } from "./shapes/index.ts";
import { shapeCreation } from "./shape-catalogue.ts";
import { Tool } from "./tools.ts";

test("registered sheet has default bounds and renders typed cells in page SVG", () => {
  expect(createDefaultRegistry().get("table.sheet")).toBeDefined();
  expect(shapeCreation(Tool.Sheet)?.type).toBe("table.sheet");
  const editor = new Editor();
  const id = editor.createElement("table.sheet");
  expect(editor.getBounds(id)).toMatchObject({ width: 360, height: 116 });
  const typed = editor.createElement("table.sheet", {
    semantic: {
      columns: [
        { id: "a", name: "Name", width: 120, type: "text" },
        { id: "b", name: "Done", width: 120, type: "checkbox" },
        {
          id: "c",
          name: "Status",
          width: 120,
          type: "select",
          options: ["Ready"],
        },
      ],
      rows: [
        {
          id: "r",
          cells: {
            a: { value: "Item" },
            b: { value: true },
            c: { value: "Ready" },
          },
        },
      ],
    },
  });
  expect(editor.getBounds(typed)).not.toBeNull();
  const svg = editor.exportPageSvg() ?? "";
  expect(svg).toContain("nodetto-table-sheet");
  for (const name of ["Name", "Done", "Status", "Ready"])
    expect(svg).toContain(`>${name}<`);
  expect(svg).toContain("nodetto-table-sheet-checkbox");
  expect(svg).toContain("nodetto-table-sheet-pill");
});
