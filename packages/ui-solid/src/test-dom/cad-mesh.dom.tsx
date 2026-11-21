import assert from "node:assert/strict";
import { Editor } from "@nodetto/core";
import { render } from "solid-js/web";
import { CadViewport } from "../cad/CadViewport.tsx";
import { ExportDialog } from "../ExportDialog.tsx";
import { ShapePalette } from "../ShapePalette.tsx";
import { Tool } from "../tools.ts";

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

function drop(target: Element, file: File): void {
  const transfer = new window.DataTransfer();
  transfer.items.add(file);
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  target.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
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
        <CadViewport
          editor={editor}
          engine={undefined}
          pageId={cad}
          canvasMode={theme}
          createRenderer={() => null}
          onImportPicker={(open) => {
            openPicker = open;
          }}
        />
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
    const cadViewport = host.querySelector(".nodetto-cad-viewport");
    const fileInput =
      host.querySelector<HTMLInputElement>('input[type="file"]');
    const opener = [...host.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === "Import STL...",
    );
    assert.ok(cadViewport && fileInput && opener);
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

    drop(cadViewport, new window.File(["corrupt"], "broken.stl"));
    await settle();
    assert.match(cadViewport.textContent ?? "", /Could not read the STL file/);
    assert.equal(editor.store.getPageElements(cad).length, 0);
    drop(cadViewport, new window.File([asciiStl], "second.stl"));
    await settle();
    assert.equal(editor.store.getPageElements(cad).length, 1, "drop import");

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

    const delayed = new window.File([asciiStl], "delayed.stl");
    let finishRead: ((bytes: ArrayBuffer) => void) | undefined;
    delayed.arrayBuffer = () =>
      new Promise((resolve) => {
        finishRead = resolve;
      });
    drop(cadViewport, delayed);
    assert.ok(finishRead);
    editor.setCurrentPage(freeform);
    finishRead(await new Blob([asciiStl]).arrayBuffer());
    await settle();
    assert.equal(editor.store.getPageElements(cad).length, 1);
    assert.equal(editor.store.getPageElements(freeform).length, 0);
    assert.equal(format.querySelector('[value="stl"]'), null);
  } finally {
    dispose();
    host.remove();
  }
  assert.equal(openPicker, undefined);
  console.log(`ok ${theme}`);
}
