import assert from "node:assert/strict";
import { Editor } from "@nodetto/core";
import { render } from "solid-js/web";
import { installFileDropGuard } from "../../../../apps/desktop/src/shell/file-drop-guard.ts";
import { NodettoCanvas } from "../Canvas.tsx";
import { ExportDialog } from "../ExportDialog.tsx";
import { Inspector } from "../Inspector.tsx";
import { Layers } from "../Layers.tsx";
import { ShapePalette } from "../ShapePalette.tsx";
import { Tool } from "../tools.ts";

Object.assign(globalThis, {
  FileReader: window.FileReader,
  Image: window.Image,
  getComputedStyle: window.getComputedStyle.bind(window),
});

const asciiStl = `solid bracket
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 2 0 0
vertex 0 2 0
endloop
endfacet
endsolid bracket
`;

function drag(
  target: Element,
  type: string,
  transfer: DataTransfer,
): MouseEvent {
  const event = new MouseEvent(type, {
    clientX: 8,
    clientY: 8,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  target.dispatchEvent(event);
  return event;
}

function fileDrop(
  target: Element,
  file: File,
  effect: "copy" | "none" = "copy",
) {
  const transfer = new window.DataTransfer();
  transfer.items.add(file);
  // Happy DOM exposes the file's MIME type here; browsers expose "Files".
  Object.defineProperty(transfer, "types", { value: ["Files"] });
  assert.equal(
    drag(target, "dragover", transfer).defaultPrevented,
    true,
    target.className,
  );
  assert.equal(transfer.dropEffect, effect, target.className);
  assert.equal(
    drag(target, "drop", transfer).defaultPrevented,
    true,
    target.className,
  );
}

function textDrop(target: Element) {
  const url = "https://example.invalid/reference";
  const values = {
    "text/uri-list": url,
    "text/plain": url,
  };
  for (const [type, value] of Object.entries(values)) {
    const transfer = new window.DataTransfer();
    transfer.setData(type, value);
    transfer.dropEffect = "copy";
    const control = target.getAttribute("type") ?? "";
    const label = `${type} on ${target.tagName}[${control}].${target.className}`;
    assert.equal(
      drag(target, "dragover", transfer).defaultPrevented,
      true,
      label,
    );
    assert.equal(transfer.dropEffect, "none", label);
    assert.equal(drag(target, "drop", transfer).defaultPrevented, true, label);
  }
}

const settle = () => Bun.sleep(0);

for (const theme of ["light", "dark"] as const) {
  document.documentElement.dataset.nodettoTheme = theme;
  const editor = new Editor();
  const freeform = editor.currentPageId;
  const cad = editor.createPage({ kind: "cad3d" });
  const host = document.createElement("div");
  document.body.append(host);
  let openPicker: (() => void) | undefined;
  let exports = 0;
  const removeFileDropGuard = installFileDropGuard(window);
  const dispose = render(
    () => (
      <>
        <ShapePalette
          editor={editor}
          workspace="cad3d"
          tool={Tool.Select}
          onToolChange={() => {}}
          onImportStl={() => openPicker?.()}
          context={{
            editor,
            viewport: { width: 800, height: 600 },
            exportSvg: () => {},
            requestEdit: () => {},
          }}
        />
        <Layers editor={editor} simple />
        <NodettoCanvas
          editor={editor}
          tool={Tool.Select}
          snap={{ grid: false, objects: false }}
          showGrid={false}
          canvasBackground={{ diagram: theme, pcb: theme }}
          createCadRenderer={() => null}
          onCadImportPicker={(open) => {
            openPicker = open;
          }}
        />
        <Inspector editor={editor} simple />
        <ExportDialog
          editor={editor}
          exportBpmn={async () => {}}
          exportStl={async () => {
            exports++;
          }}
          onClose={() => {}}
        />
      </>
    ),
    host,
  );
  try {
    const dialog = host.querySelector("dialog");
    assert.ok(dialog?.open);
    const stl = new window.File([asciiStl], "off-target.stl");
    fileDrop(dialog, stl, "none");
    textDrop(dialog);
    dialog.close();
    for (const selector of [
      ".nodetto-shape-palette",
      ".nodetto-layers",
      ".nodetto-inspector",
    ]) {
      const panel = host.querySelector(selector);
      assert.ok(panel, selector);
      fileDrop(panel, stl, "none");
      textDrop(panel);
    }
    const textInput = host.querySelector('input[placeholder="Search shapes"]');
    assert.ok(textInput);

    const fields = document.createElement("div");
    fields.innerHTML =
      '<textarea></textarea><div contenteditable=""><span class="editable-child">Draft</span><span class="non-editable-child" contenteditable="false">Label</span></div>';
    host.append(fields);
    for (const type of [
      "checkbox",
      "color",
      "range",
      "radio",
      "button",
      "date",
    ]) {
      const input = document.createElement("input");
      input.type = type;
      fields.append(input);
      textDrop(input);
    }
    textDrop(textInput);
    fileDrop(textInput, stl, "none");
    const textarea = fields.querySelector("textarea");
    const editableChild = fields.querySelector(".editable-child");
    const nonEditableChild = fields.querySelector(".non-editable-child");
    assert.ok(textarea && editableChild && nonEditableChild);
    textDrop(textarea);
    textDrop(editableChild);
    textDrop(nonEditableChild);
    fileDrop(editableChild, stl, "none");
    fields.remove();
    assert.equal(editor.store.getPageElements(cad).length, 0);

    const cadViewport = host.querySelector(".nodetto-cad-viewport");
    const fileInput =
      host.querySelector<HTMLInputElement>('input[type="file"]');
    const opener = [...host.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === "Import STL...",
    );
    assert.ok(cadViewport && fileInput && opener);
    textDrop(cadViewport);
    textDrop(fileInput);
    assert.equal(fileInput.accept, ".stl");
    let openings = 0;
    fileInput.addEventListener("click", () => {
      openings++;
    });
    opener.click();
    assert.equal(openings, 1, "the palette opens the file picker");
    const transfer = new window.DataTransfer();
    transfer.items.add(new window.File([asciiStl], "bracket.STL"));
    Object.defineProperty(fileInput, "files", { value: transfer.files });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    assert.equal(editor.store.getPageElements(cad).length, 1, "picker import");
    assert.equal(editor.store.getPageElements(cad)[0]?.type, "cad.mesh");
    assert.match(
      cadViewport.textContent ?? "",
      /self-intersections and mixed winding/,
    );
    editor.undo();
    assert.equal(editor.store.getPageElements(cad).length, 0);

    fileDrop(cadViewport, new window.File(["corrupt"], "broken.stl"));
    await settle();
    assert.match(cadViewport.textContent ?? "", /Could not read the STL file/);
    assert.equal(editor.store.getPageElements(cad).length, 0);
    fileDrop(cadViewport, new window.File([asciiStl], "second.stl"));
    await settle();
    assert.equal(editor.store.getPageElements(cad).length, 1, "drop import");

    const mesh = editor.store.getPageElements(cad)[0];
    assert.ok(mesh);
    fileDrop(cadViewport, new window.File([asciiStl], "anchor.stl"));
    await settle();
    const anchor = editor.store
      .getPageElements(cad)
      .find(({ id }) => id !== mesh.id);
    assert.ok(anchor && mesh.index < anchor.index);
    const names = [
      ...host.querySelectorAll<HTMLButtonElement>(".nodetto-layer-name"),
    ];
    const meshName = names.find((item) => item.title.startsWith("second ("));
    const anchorName = names.find((item) => item.title.startsWith("anchor ("));
    const anchorRow = anchorName?.closest(".nodetto-layer-row");
    assert.ok(meshName && anchorRow);
    const layerDrag = new window.DataTransfer();
    drag(meshName, "dragstart", layerDrag);
    assert.equal(drag(anchorRow, "dragover", layerDrag).defaultPrevented, true);
    assert.equal(layerDrag.dropEffect, "move");
    assert.equal(drag(anchorRow, "drop", layerDrag).defaultPrevented, true);
    assert.ok((editor.store.get(mesh.id)?.index ?? "") > anchor.index);
    editor.undo();
    editor.undo();

    dialog.showModal();
    const format = host.querySelector<HTMLSelectElement>(
      '[aria-label="Export format"]',
    );
    assert.ok(format);
    assert.equal(
      format.querySelector('[value="stl"]')?.textContent,
      "STL (3D model)",
    );
    assert.equal(format.value, "stl");
    for (const old of ["svg", "png", "pdf"])
      assert.equal(
        format.querySelector<HTMLOptionElement>(`[value="${old}"]`)?.disabled,
        false,
      );
    const exportButton = [...host.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === "Export STL",
    );
    assert.ok(exportButton);
    exportButton.click();
    await settle();
    assert.equal(exports, 1, "the STL option invokes the export action");
    dialog.close();

    const delayed = new window.File([asciiStl], "delayed.stl");
    let finishRead: ((bytes: ArrayBuffer) => void) | undefined;
    delayed.arrayBuffer = () =>
      new Promise((resolve) => {
        finishRead = resolve;
      });
    fileDrop(cadViewport, delayed);
    assert.ok(finishRead);
    editor.setCurrentPage(freeform);
    finishRead(await new Blob([asciiStl]).arrayBuffer());
    await settle();
    assert.equal(editor.store.getPageElements(cad).length, 1);
    assert.equal(editor.store.getPageElements(freeform).length, 0);
    assert.equal(format.querySelector('[value="stl"]'), null);

    const canvas = host.querySelector(".nodetto-canvas");
    assert.ok(canvas && !canvas.classList.contains("nodetto-cad-viewport"));
    textDrop(canvas);
    // A two-pixel GIF with a black and white palette.
    const gif = Buffer.from(
      "47494638396102000100800000000000ffffff2c0000000002000100000202440a003b",
      "hex",
    );
    fileDrop(
      canvas,
      new window.File([gif], "swatch.gif", { type: "image/gif" }),
    );
    for (
      let i = 0;
      i < 20 && !editor.store.getPageElements(freeform).length;
      i++
    )
      await Bun.sleep(5);
    assert.deepEqual(
      editor.store.getPageElements(freeform).map(({ type }) => type),
      ["image.raster"],
      canvas.textContent ?? "",
    );
  } finally {
    dispose();
    removeFileDropGuard();
    host.remove();
  }
  assert.equal(openPicker, undefined);
  console.log(`ok ${theme}`);
}
