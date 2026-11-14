import { expect, test } from "bun:test";
import { Editor } from "../editor.ts";
import { estimatedTextWidth } from "../text-layout.ts";
import { lintTextLayoutPage } from "./engine.ts";
import {
  TEXT_LAYOUT_LINT_PAGE_KINDS,
  TEXT_LAYOUT_LINT_RULE_IDS,
} from "./rules.ts";

test("public constants and grapheme measurement", () => {
  expect(TEXT_LAYOUT_LINT_RULE_IDS).toEqual([
    "label-overflow",
    "label-collision",
    "note-overflow",
  ]);
  expect(TEXT_LAYOUT_LINT_PAGE_KINDS).toEqual([
    "architecture",
    "freeform",
    "flowchart",
  ]);
  expect(estimatedTextWidth("abc", 10)).toBe(16.5);
  expect(estimatedTextWidth("👩‍💻", 10)).toBe(5.5);
});
test("hidden elements and other pages are skipped", () => {
  const editor = new Editor();
  const hidden = editor.buildElement("node.generic", {
    id: "hidden",
    visual: { x: 0, y: 0, width: 24, height: 30, hidden: true },
    semantic: { label: "Payment gateway" },
  });
  editor.apply([{ type: "createElement", element: hidden }]);
  expect(
    lintTextLayoutPage(editor.getSnapshot(), editor.currentPageId),
  ).toEqual([]);
  expect(lintTextLayoutPage(editor.getSnapshot(), "missing")).toEqual([]);
});
test("dense page produces deterministic findings", () => {
  const editor = new Editor();
  const elements = [];
  for (let i = 0; i < 300; i++) {
    const x = (i % 20) * 250;
    const y = Math.floor(i / 20) * 200;
    elements.push(
      editor.buildElement("node.generic", {
        id: `node-${i}`,
        visual: { x, y, width: 160, height: 60 },
        semantic: { label: `Service ${i}` },
      }),
    );
    elements.push(
      editor.buildElement("edge.generic", {
        id: `edge-${i}`,
        semantic: {
          fromPoint: { x: x + 160, y: y + 30 },
          toPoint: { x: x + 250, y: y + 30 },
          label: `call ${i}`,
        },
      }),
    );
  }
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  const doc = editor.getSnapshot();
  expect(lintTextLayoutPage(doc, editor.currentPageId)).toEqual(
    lintTextLayoutPage(doc, editor.currentPageId),
  );
}, 10000);

test("group children are linted and unlabelled or BPMN edges are skipped", () => {
  const editor = new Editor();
  const child = editor.buildElement("node.generic", {
    id: "child",
    visual: { x: 0, y: 0, width: 24, height: 30 },
    semantic: { label: "Payment gateway" },
  });
  const group = editor.buildElement("group", {
    id: "group",
    semantic: { memberIds: ["child"] },
  });
  const unlabelled = editor.buildElement("edge.generic", {
    id: "unlabelled",
    semantic: { fromPoint: { x: 0, y: 100 }, toPoint: { x: 200, y: 100 } },
  });
  const start = editor.buildElement("bpmn.event", {
    id: "start",
    visual: { x: 0, y: 200 },
    semantic: { position: "start", definitions: [] },
  });
  const task = editor.buildElement("bpmn.task", {
    id: "task",
    visual: { x: 200, y: 200 },
    semantic: { name: "Task", taskType: "user", loop: "none" },
  });
  const flow = editor.buildElement("bpmn.sequenceFlow", {
    id: "flow",
    semantic: { from: "start", to: "task", name: "HTTPS" },
  });
  editor.apply(
    [child, group, unlabelled, start, task, flow].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const result = lintTextLayoutPage(editor.getSnapshot(), editor.currentPageId);
  expect(result.map((f) => f.elementId)).toEqual(["child", "child"]);
});

test("findings follow element order, rule order, message order and are unique", () => {
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
      id: "z",
      visual: { x: 170, y: 70, width: 60, height: 60 },
      semantic: { label: "" },
    }),
    editor.buildElement("node.generic", {
      id: "a",
      visual: { x: 170, y: 70, width: 60, height: 60 },
      semantic: { label: "" },
    }),
    editor.buildElement("node.generic", {
      id: "narrow",
      visual: { x: 500, y: 0, width: 24, height: 30 },
      semantic: { label: "Payment gateway" },
    }),
  ];
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  const result = lintTextLayoutPage(editor.getSnapshot(), editor.currentPageId);
  expect(result.map((f) => f.elementId)).toEqual([
    "edge",
    "edge",
    "narrow",
    "narrow",
  ]);
  expect(result[0]?.message).toContain("node.generic a");
  expect(result[1]?.message).toContain("node.generic z");
  expect(result[2]?.message).toStartWith("Label line");
  expect(result[3]?.message).toStartWith("Label needs");
  expect(
    new Set(
      result.map((f) => JSON.stringify([f.ruleId, f.elementId, f.message])),
    ).size,
  ).toBe(result.length);
});
