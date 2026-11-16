import { expect, test } from "bun:test";
import {
  documentExportFormats,
  EXPORT_FORMAT_GROUPS,
} from "./ExportDialog.tsx";

test("export format groups retain their labels and order", () => {
  expect(EXPORT_FORMAT_GROUPS).toEqual([
    { label: "Document", ids: ["document-pdf", "document-markdown"] },
    { label: "Artwork", ids: ["svg", "png", "pdf", "artboards"] },
    {
      label: "Diagram source",
      ids: ["mermaid", "d2", "drawio", "sql", "bpmn", "breadboard", "gerber"],
    },
    { label: "Fabrication", ids: ["pcb"] },
    { label: "Web & developer", ids: ["html", "prototype", "code"] },
  ]);
});

test("document formats preserve labels, order and callback availability", () => {
  const expected = [
    { id: "document-pdf", label: "Document as PDF...", enabled: false },
    {
      id: "document-markdown",
      label: "Document as Markdown (ZIP)...",
      enabled: false,
    },
  ] as const;
  expect(documentExportFormats({})).toEqual(expected);
  const exportDocumentPdf = async () => {};
  const exportDocumentMarkdown = async () => {};
  expect(
    documentExportFormats({ exportDocumentPdf, exportDocumentMarkdown }),
  ).toEqual(expected.map((entry) => ({ ...entry, enabled: true })));
  expect(documentExportFormats({ exportDocumentPdf })).toEqual([
    { ...expected[0], enabled: true },
    expected[1],
  ]);
});
