import type { Editor } from "../editor.ts";
import { expandContainers, frameParents } from "../frame-tree.ts";
import { createShapeContext } from "../hit-test.ts";
import { isPageFrame } from "../page-frames/order.ts";
import { documentPageSequence } from "../page-frames/sequence.ts";
import { renderSelectionSvg } from "../svg-export/document.ts";

export interface MarkdownDocumentExport {
  markdown: string;
  assets: { name: string; svg: string }[];
}
function base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    result +=
      chars[a >> 2] +
      chars[((a & 3) << 4) | (b >> 4)] +
      (i + 1 < bytes.length ? chars[((b & 15) << 2) | (c >> 6)] : "=") +
      (i + 2 < bytes.length ? chars[c & 63] : "=");
  }
  return result;
}
export function exportMarkdownDocument(
  editor: Editor,
  options: {
    assetDir: string;
    embed?: boolean;
    resolveAsset?: (source: string) => string;
  },
): MarkdownDocumentExport {
  const { store, registry } = editor;
  const context = createShapeContext(store, registry, 1);
  const assets: MarkdownDocumentExport["assets"] = [];
  const blocks: string[] = [];
  const seen = new Set<string>();
  for (const [index, ref] of documentPageSequence(store, registry).entries()) {
    const parents = frameParents(store, ref.pageId, context);
    const candidates = store.getPageElements(ref.pageId).flatMap((element) => {
      if (
        seen.has(element.id) ||
        isPageFrame(element) ||
        context.isHidden?.(element.id) ||
        context.isMaskSource?.(element.id)
      )
        return [];
      const parent = parents.get(element.id);
      const box = registry
        .getOrFallback(element.type)
        .getBounds(element, context);
      if (!box) return [];
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      if (
        ref.frameId
          ? parent !== ref.frameId &&
            (parent !== undefined ||
              cx < ref.rect.x ||
              cx > ref.rect.x + ref.rect.width ||
              cy < ref.rect.y ||
              cy > ref.rect.y + ref.rect.height)
          : parent !== undefined
      )
        return [];
      return [{ element, box }];
    });
    const children = new Set<string>();
    for (const { element } of candidates)
      for (const id of expandContainers(store, [element.id], context))
        if (id !== element.id) children.add(id);
    const members = candidates
      .filter(({ element }) => !children.has(element.id))
      .sort(
        (a, b) =>
          a.box.y - b.box.y ||
          a.box.x - b.box.x ||
          (a.element.id < b.element.id
            ? -1
            : a.element.id > b.element.id
              ? 1
              : 0),
      );
    let group: string[] = [];
    let groupIndex = 0;
    const flush = () => {
      if (!group.length) return;
      const svg = renderSelectionSvg(
        store,
        registry,
        ref.pageId,
        new Set(group),
        { padding: 16, background: null, resolveAsset: options.resolveAsset },
      );
      group = [];
      if (!svg) return;
      const stem = `page-${index + 1}-${++groupIndex}`;
      const name = `${stem}.svg`;
      const url = options.embed
        ? `data:image/svg+xml;base64,${base64(svg)}`
        : `${options.assetDir}/${name}`;
      if (!options.embed) assets.push({ name, svg });
      blocks.push(`![Diagram ${stem}](${url})`);
    };
    for (const { element } of members) {
      for (const id of expandContainers(store, [element.id], context))
        seen.add(id);
      const semantic = element.semantic as {
        markdown?: unknown;
        code?: unknown;
        language?: unknown;
      };
      if (element.type === "text.markdown") {
        flush();
        blocks.push(
          (typeof semantic.markdown === "string"
            ? semantic.markdown
            : ""
          ).replace(/\n+$/, ""),
        );
      } else if (element.type === "text.code") {
        flush();
        const code = typeof semantic.code === "string" ? semantic.code : "";
        const longest = Math.max(
          0,
          ...Array.from(code.matchAll(/`+/g), (match) => match[0].length),
        );
        const fence = "`".repeat(Math.max(3, longest + 1));
        const language =
          typeof semantic.language === "string" && semantic.language !== "plain"
            ? semantic.language
            : "";
        blocks.push(
          `${fence}${language}\n${code}${code.endsWith("\n") ? "" : "\n"}${fence}`,
        );
      } else group.push(element.id);
    }
    flush();
  }
  return { markdown: `${blocks.join("\n\n").replace(/\n+$/, "")}\n`, assets };
}
