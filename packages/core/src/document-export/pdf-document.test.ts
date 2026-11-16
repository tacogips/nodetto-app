import { expect, test } from "bun:test";
import { document, element, makeEditor } from "../test-helpers.ts";
import { documentPdfPlan } from "./pdf-document.ts";
test("plans artwork size and collects text runs", () => {
  const editor = makeEditor({
    document: document([
      element({
        id: "a",
        type: "node.generic",
        semantic: {},
        visual: { x: 0, y: 0, width: 100, height: 50 },
      }),
    ]),
  });
  const pages = documentPdfPlan(editor, {
    background: null,
    extractors: {
      "node.generic": (_el, box) => [
        { x: box.x, y: box.y, size: 10, text: "text", font: "sans" },
      ],
    },
  });
  expect(pages).toHaveLength(1);
  expect(pages[0].spec.layout.pageWidth).toBe(pages[0].ref.rect.width * 0.75);
  expect(pages[0].spec.textRuns[0].text).toBe("text");
  expect(() =>
    documentPdfPlan(makeEditor({ document: document() }), { background: null }),
  ).toThrow("Document has nothing to export.");
});

test("rejects documents above 500 page frames", () => {
  const frames = Array.from({ length: 501 }, (_, i) =>
    element({
      id: `f${i}`,
      type: "frame",
      semantic: { name: "Page", page: { size: "a4", orientation: "portrait" } },
      visual: { x: i * 200, y: 0, width: 100, height: 100 },
    }),
  );
  expect(() =>
    documentPdfPlan(makeEditor({ document: document(frames) }), {
      background: null,
    }),
  ).toThrow("Document has 501 pages; PDF export supports at most 500.");
});

test("plans one page per frame", () => {
  const frames = Array.from({ length: 3 }, (_, i) =>
    element({
      id: `page-${i}`,
      type: "frame",
      semantic: { name: "Page", page: { size: "a4", orientation: "portrait" } },
      visual: { x: i * 200, y: 0, width: 100, height: 120 },
    }),
  );
  const plans = documentPdfPlan(makeEditor({ document: document(frames) }), {
    background: null,
  });
  expect(plans).toHaveLength(3);
  for (const plan of plans) {
    expect(plan.spec.layout.pageWidth).toBe(75);
    expect(plan.spec.layout.pageHeight).toBe(90);
  }
});
