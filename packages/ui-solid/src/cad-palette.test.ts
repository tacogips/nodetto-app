import { expect, test } from "bun:test";
import {
  additionalShapes,
  shapePaletteGroups,
  workspaceShapes,
} from "./shape-palette.ts";
import { searchPaletteShapes } from "./shape-search.ts";
import { creationFor, Tool } from "./tools.ts";
import { WORKSPACES, workspaceById } from "./workspaces.ts";

test("the CAD workspace exposes only select and the six CAD creation tools", () => {
  const cadTools = [
    [Tool.CadSketch, "cad.sketch"],
    [Tool.CadLine, "cad.line"],
    [Tool.CadRect, "cad.line"],
    [Tool.CadArc, "cad.arc"],
    [Tool.CadCircle, "cad.circle"],
    [Tool.CadExtrude, "cad.extrude"],
  ] as const;
  const primary = cadTools.map(([tool]) => tool);
  const all = [Tool.Select, ...primary];
  expect(workspaceById("cad3d").tools.map(({ tool }) => tool)).toEqual(all);
  expect(workspaceShapes("cad3d").map(({ tool }) => tool)).toEqual(primary);
  expect(additionalShapes("cad3d")).toEqual([]);
  expect(
    shapePaletteGroups("cad3d").flatMap(({ items }) =>
      items.map(({ tool }) => tool),
    ),
  ).toEqual(all);
  for (const [tool, type] of cadTools)
    expect(creationFor(tool)).toEqual({ type });

  for (const { id, tools } of WORKSPACES) {
    if (id === "cad3d") continue;
    const items = [
      ...tools,
      ...workspaceShapes(id),
      ...additionalShapes(id),
      ...shapePaletteGroups(id).flatMap(({ items }) => items),
    ];
    expect(items.some(({ tool }) => tool.startsWith("cad:"))).toBe(false);
  }
  expect(
    searchPaletteShapes("rectangle", "cad3d").map(({ tool }) => tool),
  ).toEqual([Tool.CadRect]);
  expect(
    searchPaletteShapes("cad:arc", "cad3d").map(({ tool }) => tool),
  ).toEqual([Tool.CadArc]);
  expect(searchPaletteShapes("artboard", "cad3d")).toEqual([]);
  expect(
    searchPaletteShapes("rectangle", "all").map(({ tool }) => tool),
  ).toContain(Tool.Rectangle);
  expect(
    searchPaletteShapes("rectangle", "all").map(({ tool }) => tool),
  ).not.toContain(Tool.CadRect);
});

test("CAD workspace controls render and work in light and dark themes", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--conditions=browser",
      "--config=./test-dom/bunfig.toml",
      "--preload",
      "./test-dom/setup.ts",
      "./test-dom/cad-workspace.dom.tsx",
    ],
    { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" },
  );
  const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
  expect(result.exitCode, output).toBe(0);
  expect(output).toContain("ok light");
  expect(output).toContain("ok dark");
});
