import assert from "node:assert/strict";
import { Editor } from "@nodetto/core";
import { hasErrors, SLIDE_SETTINGS_TYPE, validateDocument } from "@nodetto/ir";
import { seed } from "../../../../apps/desktop/src/seed.ts";
import { insertPaletteIcon, insertPaletteKit } from "../ShapePalette.tsx";
import { importRasterFiles, insertRasterAssets } from "../image-import.ts";
import { planSlideSettingsEdit } from "../inspector/slide-transition-edits.ts";
import { interactionFor, pointer } from "../interaction-test-helpers.ts";
import { Tool } from "../tools.ts";

const at = { x: 20, y: 30 };
const raster = {
  // One opaque pixel.
  src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAkQBADs=",
  alt: "Pixel",
  width: 1,
  height: 1,
};

function drawConnector(editor: Editor): void {
  const { interaction } = interactionFor(editor, Tool.Connector);
  try {
    interaction.onPointerDown(pointer({ clientX: 320, clientY: 320 }));
    interaction.onPointerMove(pointer({ clientX: 420, clientY: 440 }));
    interaction.onPointerUp(pointer({ clientX: 420, clientY: 440 }));
  } finally {
    interaction.dispose();
  }
}

for (const theme of ["light", "dark"]) {
  document.documentElement.dataset.nodettoTheme = theme;
  const editor = new Editor();
  const freeform = editor.currentPageId;
  const cad = editor.createPage({ kind: "cad3d" });
  const before = editor.getSnapshot();
  seed(editor);
  assert.equal(insertPaletteIcon(editor, "circle", at), null);
  assert.equal(insertPaletteKit(editor, "ios:list-row", at), "");
  assert.deepEqual(insertRasterAssets(editor, [raster], at), []);
  // The guard must run before reading files or using a browser decoder.
  assert.deepEqual(
    await importRasterFiles(editor, [new File([""], "not-an-image.gif")], at),
    [],
  );
  const { interaction } = interactionFor(editor, Tool.Rectangle);
  try {
    interaction.placeTool(Tool.Rectangle, at);
  } finally {
    interaction.dispose();
  }
  drawConnector(editor);
  assert.equal(editor.getSnapshot(), before);
  assert.deepEqual([...editor.selection.ids()], []);

  editor.apply(planSlideSettingsEdit(editor, cad, { stagger: false }));
  assert.deepEqual(
    editor.store.getPageElements(cad).map(({ type }) => type),
    [SLIDE_SETTINGS_TYPE],
  );
  assert.equal(hasErrors(validateDocument(editor.getSnapshot())), false);

  editor.setCurrentPage(freeform);
  drawConnector(editor);
  assert.equal(editor.store.getPageElements(freeform)[0]?.type, "edge.generic");
  const placement = interactionFor(editor, Tool.Rectangle);
  try {
    placement.interaction.placeTool(Tool.Rectangle, { x: -100, y: -100 });
  } finally {
    placement.interaction.dispose();
  }
  assert.ok(
    editor.store
      .getPageElements(freeform)
      .some(({ type }) => type === "shape.geo"),
  );
  seed(editor);
  assert.ok(
    editor.store
      .getPageElements(freeform)
      .some(({ type }) => type === "erd.table"),
  );
  const icon = insertPaletteIcon(editor, "circle", at);
  assert.ok(icon);
  assert.equal(editor.store.get(icon)?.type, "ui.icon");
  assert.deepEqual([...editor.selection.ids()], [icon]);
  const kit = insertPaletteKit(editor, "ios:list-row", at);
  assert.equal(editor.store.get(kit)?.type, "frame");
  const [image] = insertRasterAssets(editor, [raster], at);
  assert.ok(image);
  assert.equal(editor.store.get(image)?.type, "image.raster");
  assert.equal(hasErrors(validateDocument(editor.getSnapshot())), false);

  console.log(`ok ${theme}`);
}
