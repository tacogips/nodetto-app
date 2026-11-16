import { expect, test } from "bun:test";
import { collectTextRuns, extractPdfText } from "@nodetto/core";
import { document, element, makeEditor } from "../../core/src/test-helpers.ts";
import { pngToPdf } from "./pdf-export.ts";
import { rasterExportSnapshot } from "./raster-export.ts";

const png = new Blob(
  [
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=",
      "base64",
    ),
  ],
  { type: "image/png" },
);
const code = 'const label = "日本語"; // 𠮷 é\tend';
const markdown = "# Ünïcode **太字** 😀";

test("individual PDF scopes extract only their snippet text", async () => {
  const editor = makeEditor({
    document: document([
      element({
        id: "frame",
        type: "frame",
        semantic: { name: "Frame" },
        visual: { x: 100, y: 100, width: 400, height: 300 },
      }),
      element({
        id: "code",
        index: "a2",
        type: "text.code",
        semantic: { code, language: "javascript" },
        visual: { x: 0, y: 120, width: 250, height: 100 },
      }),
      element({
        id: "markdown",
        index: "a3",
        type: "text.markdown",
        semantic: { markdown },
        visual: { x: 120, y: 130, width: 200, height: 100 },
      }),
    ]),
  });
  editor.selection.set(["code"]);
  const page = rasterExportSnapshot(editor, { wholePage: true, padding: 17 });
  const selection = rasterExportSnapshot(editor);
  const artboard = rasterExportSnapshot(editor, { artboardId: "frame" });
  const viewBox = /^<svg\s[^>]*\bviewBox="([^"]+)"/
    .exec(page.svg)?.[1]
    .split(/\s+/)
    .map(Number);
  if (!viewBox) throw new Error("Missing viewBox");
  expect(page.textRuns).toEqual(
    collectTextRuns(editor.store, editor.registry, editor.currentPageId, {
      x: viewBox[0],
      y: viewBox[1],
      width: viewBox[2],
      height: viewBox[3],
    }),
  );
  expect(selection.textRuns.map((run) => run.text)).toEqual([code]);
  expect(artboard.textRuns.map((run) => run.text)).toEqual(
    page.textRuns.filter((run) => run.text !== code).map((run) => run.text),
  );
  expect(artboard.textRuns.length).toBeGreaterThan(0);
  expect(artboard.textRuns.map((run) => run.text).join("")).toContain("太字");
  expect(artboard.textRuns.map((run) => run.text)).not.toContain(code);
  expect(page.textRuns.map((run) => run.text)).toContain(code);
  for (const snapshot of [page, selection, artboard]) {
    const pdf = await pngToPdf(
      png,
      snapshot.width,
      snapshot.height,
      { pageSize: "artwork", orientation: "portrait", marginMm: 0 },
      undefined,
      snapshot.textRuns,
    );
    expect(
      (await extractPdfText(new Uint8Array(await pdf.arrayBuffer()))).pages,
    ).toEqual([snapshot.textRuns.map((run) => run.text).join("\n")]);
  }
});

test("page without snippets has no text runs", () => {
  const editor = makeEditor({
    document: document([
      element({
        id: "shape",
        type: "node.generic",
        semantic: {},
        visual: { x: 0, y: 0, width: 100, height: 100 },
      }),
    ]),
  });
  expect(rasterExportSnapshot(editor, { wholePage: true }).textRuns).toEqual(
    [],
  );
});
