import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import type { FrameSemantic } from "@nodetto/ir";
import { shapePaletteGroups } from "./shape-palette.ts";
import { searchPaletteShapes } from "./shape-search.ts";
import { Tool } from "./tools.ts";

test("app palette exposes iOS kit, text, icons and device presets", () => {
  const groups = shapePaletteGroups("app");
  const items = groups.flatMap((group) => group.items);
  expect(
    groups.find((group) => group.label === "iOS kit")?.items.length,
  ).toBeGreaterThanOrEqual(6);
  expect(items.some((item) => item.tool === Tool.TextLayer)).toBe(true);
  expect(items.some((item) => item.action === "icon-picker")).toBe(true);
  for (const tool of [
    Tool.IPhone393Frame,
    Tool.IPhone402Frame,
    Tool.IPhone430Frame,
    Tool.IPhone440Frame,
    Tool.IPhone375Frame,
  ])
    expect(items.some((item) => item.tool === tool)).toBe(true);
  expect(
    shapePaletteGroups("web")
      .flatMap((group) => group.items)
      .some((item) => item.tool === Tool.TextLayer),
  ).toBe(true);
  expect(
    shapePaletteGroups("web").some((group) => group.label === "iOS kit"),
  ).toBe(false);
  expect(
    searchPaletteShapes("segmented").some(
      (item) => item.kitId === "ios:segmented",
    ),
  ).toBe(true);
});

test("palette insertion selects kit and icon and batches the kit definition for undo", async () => {
  const { createRequire } = await import("node:module");
  const root = process.cwd();
  const require = createRequire(`${root}/apps/desktop/package.json`);
  const { createServer } = require("vite");
  const solid = require("vite-plugin-solid");
  const server = await createServer({
    configFile: false,
    root: `${root}/apps/desktop`,
    cacheDir: `${root}/tmp/ipd-s772/ipd-17-desktop-palette/test-agent/vite-cache`,
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [solid({ ssr: true })],
    server: { middlewareMode: true, watch: null },
    appType: "custom",
  });
  try {
    const { insertPaletteKit, insertPaletteIcon } = await server.ssrLoadModule(
      `${root}/packages/ui-solid/src/ShapePalette.tsx`,
    );
    const editor = new Editor();
    const page = editor.currentPageId;
    const frame = editor.createElement("frame", {
      semantic: { name: "Phone", memberIds: [], platform: "ios" },
      visual: { x: 0, y: 0, width: 390, height: 844 },
    });
    const before = editor.getSnapshot();
    const instance = insertPaletteKit(editor, "ios:nav-bar", {
      x: 195,
      y: 422,
    });
    expect(editor.currentPageId).toBe(page);
    expect(
      (editor.store.get(frame)?.semantic as FrameSemantic).memberIds,
    ).toContain(instance);
    expect([...editor.selection.ids()]).toEqual([instance]);
    editor.undo();
    expect(editor.getSnapshot()).toEqual(before);
    expect(editor.store.listPages().some((p) => p.name === "iOS kit")).toBe(
      false,
    );
    const icon = insertPaletteIcon(editor, "bell", { x: 195, y: 422 });
    expect(editor.store.get(icon)).toMatchObject({
      type: "ui.icon",
      semantic: { icon: "bell" },
      visual: { width: 24, height: 24, style: { stroke: "#000000" } },
    });
    expect(
      (editor.store.get(frame)?.semantic as FrameSemantic).memberIds,
    ).toContain(icon);
    expect([...editor.selection.ids()]).toEqual([icon]);
  } finally {
    await server.close();
  }
});
