import assert from "node:assert/strict";
import { Editor, type CaptureCameraRequest } from "@nodetto/core";
import { render } from "solid-js/web";
import { ExportDialog } from "../ExportDialog.tsx";

const settle = () => Bun.sleep(0);
const camera = {
  target: [1, 2, 3] as const,
  yaw: Math.PI / 4,
  pitch: Math.PI / 6,
  distance: 100,
  ortho: true,
};
for (const theme of ["light", "dark"] as const) {
  const editor = new Editor();
  const freeform = editor.currentPageId;
  const cad = editor.createPage({ kind: "cad3d" });
  const host = document.createElement("div");
  document.body.append(host);
  const calls: {
    camera: CaptureCameraRequest;
    format: string;
    theme: string;
    width: number;
    height: number;
  }[] = [];
  const dispose = render(
    () => (
      <ExportDialog
        editor={editor}
        exportBpmn={async () => {}}
        exportStl={async () => {}}
        captureCadImage={async (options) => {
          calls.push(options);
        }}
        cadCurrentView={() => camera}
        canvasMode={theme}
        onClose={() => {}}
      />
    ),
    host,
  );
  await settle();
  const select = host.querySelector<HTMLSelectElement>(
    '[aria-label="Export format"]',
  );
  assert.ok(select);
  assert.equal(select.value, "stl");
  assert.equal(
    select.querySelector<HTMLOptionElement>('[value="image3d"]')?.disabled,
    false,
  );
  select.value = "image3d";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
  const view = host.querySelector<HTMLSelectElement>(
    '[aria-label="CAD image view"]',
  );
  assert.ok(view);
  assert.equal(view.value, "current");
  const format = host.querySelector<HTMLSelectElement>(
    '[aria-label="CAD image format"]',
  );
  assert.ok(format);
  format.value = "jpg";
  format.dispatchEvent(new Event("change", { bubbles: true }));
  const size = host.querySelector<HTMLSelectElement>(
    '[aria-label="CAD image size"]',
  );
  assert.ok(size);
  size.value = "1600x1200";
  size.dispatchEvent(new Event("change", { bubbles: true }));
  const section = view.closest("section");
  assert.ok(section);
  assert.equal(section.querySelector("[style]"), null);
  section.querySelector("button")?.click();
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.format, "jpg");
  assert.equal(calls[0]?.theme, theme);
  assert.equal(calls[0]?.width, 1600);
  assert.equal(calls[0]?.height, 1200);
  assert.ok(calls[0]?.camera.direction);
  editor.setCurrentPage(freeform);
  await settle();
  assert.equal(
    select.querySelector<HTMLOptionElement>('[value="image3d"]')?.disabled,
    true,
  );
  dispose();
  host.remove();
  const host2 = document.createElement("div");
  document.body.append(host2);
  editor.setCurrentPage(cad);
  const dispose2 = render(
    () => (
      <ExportDialog
        editor={editor}
        exportBpmn={async () => {}}
        onClose={() => {}}
      />
    ),
    host2,
  );
  await settle();
  assert.equal(
    host2.querySelector<HTMLOptionElement>('[value="image3d"]')?.disabled,
    true,
  );
  assert.ok(host2.textContent?.includes("Available in the desktop app."));
  dispose2();
  host2.remove();
  const host3 = document.createElement("div");
  document.body.append(host3);
  const dispose3 = render(
    () => (
      <ExportDialog
        editor={editor}
        exportBpmn={async () => {}}
        captureCadImage={async () => {}}
        onClose={() => {}}
      />
    ),
    host3,
  );
  await settle();
  const select3 = host3.querySelector<HTMLSelectElement>(
    '[aria-label="Export format"]',
  );
  assert.ok(select3);
  select3.value = "image3d";
  select3.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
  const view3 = host3.querySelector<HTMLSelectElement>(
    '[aria-label="CAD image view"]',
  );
  assert.ok(view3);
  assert.equal(view3.value, "iso");
  assert.equal(view3.querySelector('[value="current"]'), null);
  dispose3();
  host3.remove();
  console.log(`ok ${theme}`);
}

// Exercise the actual artwork dialog through rasterization and the save callback.
{
  const editor = new Editor();
  editor.createElement("shape.geo", {
    visual: { x: 0, y: 0, width: 20, height: 20 },
  });
  const host = document.createElement("div");
  document.body.append(host);
  let svgBlob: Blob | undefined;
  let encoding: [string | undefined, number | undefined] | undefined;
  let saved: { name: string; blob: Blob; format: string } | undefined;
  const originalCreate = document.createElement.bind(document);
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: function ImageDouble() {
      return { src: "", decode: async () => {} };
    },
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      svgBlob = blob;
      return "blob:test";
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(document, "createElement", {
    configurable: true,
    value: (tag: string) =>
      tag === "canvas"
        ? {
            width: 0,
            height: 0,
            getContext: () => ({ drawImage: () => {} }),
            toBlob: (
              callback: (blob: Blob) => void,
              type?: string,
              quality?: number,
            ) => {
              encoding = [type, quality];
              callback(new Blob(["jpeg"], { type }));
            },
          }
        : originalCreate(tag),
  });
  const dispose = render(
    () => (
      <ExportDialog
        editor={editor}
        exportBpmn={async () => {}}
        onClose={() => {}}
        saveArtwork={async (name, blob, format) => {
          saved = { name, blob, format };
          return true;
        }}
      />
    ),
    host,
  );
  await settle();
  const choice = host.querySelector<HTMLSelectElement>(
    '[aria-label="Export format"]',
  );
  assert.ok(choice);
  choice.value = "png";
  choice.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
  const format = host.querySelector<HTMLSelectElement>(
    '[aria-label="Artwork image format"]',
  );
  assert.ok(format);
  format.value = "jpg";
  format.dispatchEvent(new Event("change", { bubbles: true }));
  assert.ok(host.textContent?.includes("JPG uses an opaque background."));
  const button = [...host.querySelectorAll("button")].find(
    (item) => item.textContent === "Export JPG",
  );
  assert.ok(button);
  button.click();
  await settle();
  await settle();
  assert.deepEqual(encoding, ["image/jpeg", 0.9]);
  assert.ok(svgBlob);
  assert.match(await svgBlob.text(), /fill="#ffffff"/);
  assert.ok(saved);
  assert.match(saved.name, /\.jpg$/);
  assert.equal(saved.format, "jpg");
  assert.equal(saved.blob.type, "image/jpeg");
  dispose();
  host.remove();
  console.log("ok artwork jpg");
}
