import { describe, expect, test } from "bun:test";
import { Editor } from "../editor.ts";
import { lintTextLayoutPage } from "./engine.ts";

const label = "Payment gateway authorisation service";
function example() {
  const editor = new Editor();
  const elements = [
    editor.buildElement("node.generic", {
      id: "wrapped",
      visual: { x: 0, y: 0, width: 140, height: 80 },
      semantic: { label },
    }),
    editor.buildElement("node.generic", {
      id: "clipped",
      visual: { x: 200, y: 0, width: 140, height: 30 },
      semantic: { label },
    }),
    editor.buildElement("node.generic", {
      id: "narrow",
      visual: { x: 400, y: 0, width: 24, height: 60 },
      semantic: { label: "Payment gateway" },
    }),
    editor.buildElement("shape.geo", {
      id: "geo",
      visual: { x: 480, y: 0, width: 140, height: 30 },
      semantic: { label, geo: "rect" },
    }),
    editor.buildElement("edge.generic", {
      id: "first",
      semantic: {
        fromPoint: { x: 0, y: 400 },
        toPoint: { x: 400, y: 400 },
        label: "HTTPS",
      },
    }),
    editor.buildElement("edge.generic", {
      id: "second",
      semantic: {
        fromPoint: { x: 200, y: 250 },
        toPoint: { x: 200, y: 550 },
        label: "gRPC",
      },
    }),
    editor.buildElement("text.note", {
      id: "note",
      visual: { x: 0, y: 800, width: 200, height: 30, textResize: "fixed" },
      semantic: {
        text: "Retry policy: retry each failed request three times with exponential backoff, then move it to the dead letter queue.",
      },
    }),
  ];
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  return editor;
}
describe("text layout rules", () => {
  test("reports clipped and spilling labels, collisions and dropped note lines", () => {
    const editor = example();
    const results = lintTextLayoutPage(
      editor.getSnapshot(),
      editor.currentPageId,
    );
    expect(results.map((f) => [f.elementId, f.ruleId])).toEqual([
      ["clipped", "label-overflow"],
      ["narrow", "label-overflow"],
      ["narrow", "label-overflow"],
      ["geo", "label-overflow"],
      ["second", "label-collision"],
      ["note", "note-overflow"],
    ]);
    expect(results[0]?.message).toBe(
      "Label needs 3 lines (46.8 high) but the box is 30 high at 13px; export clips 2 lines.",
    );
    expect(results[3]?.message).toContain("the text spills outside the shape.");
    expect(results[5]?.message).toContain("export drops 4 lines.");
  });
  test("renderer wraps the fitting label and clips the overflowing label", () => {
    const editor = example();
    const svg = editor.exportPageSvg()!;
    const results = lintTextLayoutPage(
      editor.getSnapshot(),
      editor.currentPageId,
    );
    for (const [id, height] of [
      ["wrapped", 80],
      ["clipped", 30],
    ] as const) {
      const group =
        svg.match(new RegExp(`<g[^>]*data-id="${id}"[\\s\\S]*?</g>`))?.[0] ??
        "";
      const ys = [...group.matchAll(/<text[^>]*\sy="([\d.]+)"/g)].map((m) =>
        Number(m[1]),
      );
      expect(ys.length).toBe(3);
      expect(ys.some((y) => y + 7.8 > height)).toBe(id === "clipped");
      expect(results.some((f) => f.elementId === id)).toBe(id === "clipped");
    }
  });
});

function findings(editor: Editor) {
  return lintTextLayoutPage(editor.getSnapshot(), editor.currentPageId);
}

test("edge label collides with unrelated body but not a zone or rotated body", () => {
  const editor = new Editor();
  const elements = [
    editor.buildElement("edge.generic", {
      id: "edge",
      semantic: {
        fromPoint: { x: 0, y: 100 },
        toPoint: { x: 400, y: 100 },
        label: "HTTPS",
      },
    }),
    editor.buildElement("node.generic", {
      id: "body",
      visual: { x: 170, y: 70, width: 60, height: 60 },
      semantic: { label: "" },
    }),
    editor.buildElement("node.generic", {
      id: "rotated",
      visual: { x: 170, y: 70, width: 60, height: 60, rotation: 45 },
      semantic: { label: "" },
    }),
    editor.buildElement("shape.geo", {
      id: "zone",
      visual: { x: -20, y: 0, width: 440, height: 200 },
      semantic: { geo: "rect", label: "" },
    }),
  ];
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  const results = findings(editor);
  expect(results).toHaveLength(1);
  expect(results[0]?.message).toContain("node.generic body");
});

test("edge label collisions include attached endpoint nodes", () => {
  const editor = new Editor();
  const elements = [
    editor.buildElement("node.generic", {
      id: "left",
      visual: { x: 0, y: 0, width: 100, height: 60 },
      semantic: { label: "" },
    }),
    editor.buildElement("node.generic", {
      id: "right",
      visual: { x: 120, y: 0, width: 100, height: 60 },
      semantic: { label: "" },
    }),
    editor.buildElement("edge.generic", {
      id: "edge",
      semantic: { from: "left", to: "right", label: "Payment gateway" },
    }),
  ];
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  const results = findings(editor).filter((f) => f.elementId === "edge");
  expect(results.map((f) => f.message)).toEqual([
    expect.stringContaining("node.generic left"),
    expect.stringContaining("node.generic right"),
  ]);
});

test("note clearance distinguishes overlap, close, exact padding and enclosing body", () => {
  const editor = new Editor();
  const elements = [
    editor.buildElement("text.note", {
      id: "note",
      visual: { x: 0, y: 0, width: 200, height: 60, textResize: "fixed" },
      semantic: { text: "Cache invalidation runs after every deploy" },
    }),
    editor.buildElement("node.generic", {
      id: "inside",
      visual: { x: 0, y: 35, width: 40, height: 30 },
      semantic: { label: "" },
    }),
    editor.buildElement("node.generic", {
      id: "close",
      visual: { x: 50, y: 41, width: 40, height: 30 },
      semantic: { label: "" },
    }),
    editor.buildElement("node.generic", {
      id: "exact",
      visual: { x: 100, y: 43.2, width: 40, height: 30 },
      semantic: { label: "" },
    }),
    editor.buildElement("shape.geo", {
      id: "container",
      visual: { x: 0, y: -10, width: 200, height: 100 },
      semantic: { geo: "rect", label: "" },
    }),
  ];
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  const messages = findings(editor)
    .filter((f) => f.elementId === "note")
    .map((f) => f.message);
  expect(messages).toEqual([
    "Text ends 3.8 above node.generic close; keep 6 clear.",
    "Text runs 2.2 into node.generic inside below; keep 6 clear.",
  ]);
});

describe("wide characters", () => {
  const wideLabel = "在庫照会サービス（試験運用中）";
  const wideText = "在庫照会サービスの再試行ポリシー";
  const lineMessage =
    "Text line 1 of 2 is 182 wide but the text area is 104 wide at 13px; export draws it past the note padding.";
  const heightMessage =
    "Text needs 3 lines with wide characters at 1 em (58.8 high with padding) but the box is 44 high; real fonts overflow it.";

  function single(
    type: string,
    visual: Record<string, unknown>,
    semantic: Record<string, unknown>,
  ) {
    const editor = new Editor();
    const element = editor.buildElement(type, {
      id: "node-wide",
      visual: { x: 0, y: 0, ...visual },
      semantic,
    });
    editor.apply([{ type: "createElement", element }]);
    return editor;
  }
  test("reports wide node and shape labels but not fitting ASCII", () => {
    const node = single(
      "node.generic",
      { width: 140, height: 60 },
      { label: wideLabel },
    );
    expect(findings(node).map((f) => [f.ruleId, f.message])).toEqual([
      [
        "label-overflow",
        "Label line 1 of 1 is 195 wide but the text area is 120 wide at 13px; export clips it.",
      ],
    ]);
    expect(
      findings(
        single(
          "node.generic",
          { width: 140, height: 60 },
          { label: "Payment gateway" },
        ),
      ),
    ).toEqual([]);
    expect(
      findings(
        single(
          "shape.geo",
          { width: 140, height: 60 },
          { label: wideLabel, geo: "rect" },
        ),
      ).map((f) => [f.ruleId, f.message]),
    ).toEqual([
      [
        "label-overflow",
        "Label line 1 of 1 is 195 wide but the text area is 124 wide at 13px; export draws it past the label padding.",
      ],
    ]);
    const group =
      node
        .exportPageSvg()!
        .match(/<g[^>]*data-id="node-wide"[\s\S]*?<\/g>/)?.[0] ?? "";
    const ys = [...group.matchAll(/<text[^>]*\sy="([\d.]+)"/g)].map((m) =>
      Number(m[1]),
    );
    expect(ys).toHaveLength(1);
    expect(ys[0]! + 7.8).toBeLessThanOrEqual(60);
  });
  test("reports wide note lines and height across alignments", () => {
    for (const verticalAlign of ["top", "middle", "bottom"]) {
      for (const height of [44, 60, 80]) {
        const editor = single(
          "text.note",
          { width: 120, height, textResize: "fixed", style: { verticalAlign } },
          { text: wideText },
        );
        expect(findings(editor).map((f) => [f.ruleId, f.message])).toEqual(
          (height === 44 ? [lineMessage, heightMessage] : [lineMessage]).map(
            (message) => ["note-overflow", message],
          ),
        );
      }
    }
  });
  test("does not report an exactly fitting ASCII note", () => {
    expect(
      findings(
        single(
          "text.note",
          { width: 200, height: 21.6, textResize: "fixed" },
          { text: "Retry three times" },
        ),
      ),
    ).toEqual([]);
  });
});
