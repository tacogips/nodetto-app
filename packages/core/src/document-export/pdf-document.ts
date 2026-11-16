import type { Editor } from "../editor.ts";
import { pdfLayout } from "../export-geometry.ts";
import {
  documentPageSequence,
  type DocumentPageRef,
} from "../page-frames/sequence.ts";
import { PDF_TEXT_RUN_EXTRACTORS } from "./extractors.ts";
import type { PdfPageSpec } from "./pdf-pages.ts";
import { collectTextRuns, type TextRunExtractor } from "./text-runs.ts";

export interface DocumentPdfPagePlan {
  ref: DocumentPageRef;
  svg: string;
  spec: PdfPageSpec;
}
export const MAX_DOCUMENT_PDF_PAGES = 500;
export function documentPdfPlan(
  editor: Editor,
  options: {
    background: string | null;
    extractors?: Readonly<Record<string, TextRunExtractor>>;
    resolveAsset?: (source: string) => string;
  },
): DocumentPdfPagePlan[] {
  const refs = documentPageSequence(editor.store, editor.registry);
  if (!refs.length) throw new Error("Document has nothing to export.");
  if (refs.length > MAX_DOCUMENT_PDF_PAGES)
    throw new Error(
      `Document has ${refs.length} pages; PDF export supports at most 500.`,
    );
  return refs.map((ref) => {
    const { width, height } = ref.rect;
    const svg = editor.exportPageSvgOf(ref.pageId, {
      viewport: ref.rect,
      background: options.background,
      ...(options.resolveAsset ? { resolveAsset: options.resolveAsset } : {}),
    });
    if (svg === null) throw new Error("Document has nothing to export.");
    return {
      ref,
      svg,
      spec: {
        width,
        height,
        layout: pdfLayout(width, height, {
          pageSize: "artwork",
          orientation: "portrait",
          marginMm: 0,
        }),
        textRuns: collectTextRuns(
          editor.store,
          editor.registry,
          ref.pageId,
          ref.rect,
          options.extractors ?? PDF_TEXT_RUN_EXTRACTORS,
        ),
      },
    };
  });
}
