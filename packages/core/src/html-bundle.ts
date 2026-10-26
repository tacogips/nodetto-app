import { decodeRasterDataUrl } from "@nodetto/ir";
import type { ElementId, FrameSemantic, ImageSemantic } from "@nodetto/ir";
import type { Editor } from "./editor.ts";
import { generateInterfaceCode } from "./interface-code.ts";
import { frameParents } from "./frame-tree.ts";
import { collectInterfaceTree } from "./interface-tree.ts";
import { encodeStoredZip } from "./zip.ts";

export interface HtmlBundleFile {
  readonly path: string;
  readonly contents: Uint8Array;
}
export interface HtmlBundle {
  readonly files: readonly HtmlBundleFile[];
  readonly notes: readonly string[];
}
const encoder = new TextEncoder();
const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c,
  );

/** Each artboard becomes a standalone page and stylesheet; raster assets are copied once. */
export function exportHtmlBundle(
  editor: Editor,
  rootIds?: readonly ElementId[],
  resolveAsset?: (source: string) => string,
): HtmlBundle {
  const parents = frameParents(
    editor.store,
    editor.currentPageId,
    editor.createShapeContext(),
  );
  const frames = rootIds
    ? rootIds.map((id) => editor.store.get(id)).filter((e) => e !== undefined)
    : editor.store
        .getPageElements(editor.currentPageId)
        .filter((e) => e.type === "frame" && !parents.has(e.id));
  if (!frames.length) throw new Error("Create an artboard to export HTML.");
  if (frames.some((e) => e.type !== "frame"))
    throw new Error("HTML pages must be frames or artboards.");
  const files: HtmlBundleFile[] = [];
  const notes = new Set<string>();
  const assets = new Map<string, string>();
  const used = new Set<string>();
  const pages: { name: string; title: string }[] = [];
  const addText = (path: string, text: string): void => {
    files.push({ path, contents: encoder.encode(text) });
  };
  for (const frame of frames) {
    const semantic = frame.semantic as FrameSemantic;
    const title = semantic.name || "Page";
    const base =
      title
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-|-$/g, "") || "page";
    let name = base === "index" ? "page-index" : base;
    for (let i = 2; used.has(name); i++) name = `${base}-${i}`;
    used.add(name);
    pages.push({ name, title });
    const code = generateInterfaceCode(editor, frame.id);
    if (!code) throw new Error("Cannot export frame");
    let html = code.html;
    for (const element of collectInterfaceTree(editor, frame.id)?.included ??
      []) {
      if (element.type !== "image.raster") continue;
      const source = (element.semantic as ImageSemantic).src;
      let target = assets.get(source);
      if (!target) {
        const resolved =
          editor.assets.resolve(source) ?? resolveAsset?.(source);
        if (!resolved)
          throw new Error(`Cannot export missing image: ${source}`);
        const decoded = decodeRasterDataUrl(resolved);
        if (!decoded) throw new Error(`Cannot decode image: ${source}`);
        target = `artifacts/image-${assets.size + 1}.${decoded.extension}`;
        assets.set(source, target);
        files.push({ path: target, contents: decoded.bytes });
      }
      html = html.replaceAll(`src="${escapeHtml(source)}"`, `src="${target}"`);
    }
    addText(
      `${name}.html`,
      `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="${name}.css"></head><body>\n${html}\n</body></html>\n`,
    );
    addText(
      `${name}.css`,
      `body { margin: 0; }\nbutton, input, textarea, select { font: inherit; }\n${code.linkedCss}\n`,
    );
    for (const note of code.notes) notes.add(note);
  }
  addText(
    "index.html",
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Pages</title><body><nav><ul>${pages.map((p) => `<li><a href="${p.name}.html">${escapeHtml(p.title)}</a></li>`).join("")}</ul></nav></body></html>\n`,
  );
  addText(
    "README.txt",
    `Open index.html to browse the exported pages.\n\n${[...notes].join("\n")}\n`,
  );
  return { files, notes: [...notes] };
}

/** Portable ZIP (stored entries), usable by both browser and desktop without a filesystem API. */
export function encodeHtmlBundleZip(bundle: HtmlBundle): Uint8Array {
  return encodeStoredZip(bundle.files, "Website bundle");
}
