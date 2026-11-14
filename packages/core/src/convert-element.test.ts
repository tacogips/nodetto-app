import { expect, test } from "bun:test";
import { CommandError } from "./commands.ts";
import { compareFractional } from "./fractional.ts";
import { makeEditor, TEST_PAGE } from "./test-helpers.ts";

test("conversion preserves identity, accessibility and connected edges through undo and redo", () => {
  const editor = makeEditor();
  const id = editor.createElement("node.generic", {
    semantic: { label: "Widget" },
    visual: { x: 20, y: 30, width: 120, height: 80 },
  });
  const other = editor.createElement("node.generic");
  const edge = editor.connectSmart(id, other) as string;
  editor.apply([
    { type: "replaceAccessibility", id, accessibility: { label: "Widget" } },
  ]);
  const original = editor.store.get(id);
  if (!original) throw new Error("missing original element");
  const originalEdge = editor.store.get(edge);
  const command = {
    type: "convertElement",
    id,
    elementType: "shape.geo",
    semantic: { geo: "rect" },
    visual: { x: 20, y: 30, width: 120, height: 80 },
  } as const;
  editor.apply([command]);
  const converted = editor.store.get(id);
  expect(converted).toEqual({
    ...original,
    type: "shape.geo",
    semantic: command.semantic,
    visual: command.visual,
  });
  expect(editor.store.get(edge)).toEqual(originalEdge);
  editor.undo();
  expect(editor.store.get(id)).toEqual(original);
  expect(editor.store.get(edge)).toEqual(originalEdge);
  editor.redo();
  expect(editor.store.get(id)).toEqual(converted);
  expect(editor.store.get(edge)).toEqual(originalEdge);
});

test("incompatible connector and invalid targets fail atomically", () => {
  const editor = makeEditor();
  const id = editor.createElement("sequence.participant");
  const other = editor.createElement("sequence.participant");
  editor.connectSmart(id, other);
  const before = editor.getSnapshot();
  try {
    editor.apply([
      {
        type: "convertElement",
        id,
        elementType: "node.generic",
        semantic: { label: "Widget" },
        visual: {},
      },
    ]);
    throw new Error("expected conversion failure");
  } catch (error) {
    expect(error).toBeInstanceOf(CommandError);
    expect(
      (error as CommandError).issues.some(
        (issue) => issue.code === "connector.endpointType",
      ),
    ).toBe(true);
  }
  expect(editor.getSnapshot()).toEqual(before);
});

test("invalid semantic and unknown element type fail independently", () => {
  const editor = makeEditor();
  const id = editor.createElement("node.generic");
  for (const target of [
    {
      elementType: "shape.geo",
      semantic: { geo: "invalid" },
      path: "semantic.geo",
    },
    { elementType: "unknown.type", semantic: {}, path: "elementType" },
  ]) {
    const before = editor.getSnapshot();
    try {
      editor.apply([
        {
          type: "convertElement",
          id,
          elementType: target.elementType,
          semantic: target.semantic,
          visual: {},
        },
      ]);
      throw new Error("expected conversion failure");
    } catch (error) {
      expect(error).toBeInstanceOf(CommandError);
      const issues = (error as CommandError).issues;
      expect(
        issues.some(
          (issue) => issue.code === "value.enum" && issue.path === target.path,
        ),
      ).toBe(true);
      expect(
        issues.some((issue) => issue.code === "connector.endpointType"),
      ).toBe(false);
    }
    expect(editor.getSnapshot()).toEqual(before);
  }
});

test("locked elements are not converted", () => {
  const editor = makeEditor();
  const id = editor.createElement("node.generic", { visual: { locked: true } });
  const before = editor.getSnapshot();
  editor.apply([
    {
      type: "convertElement",
      id,
      elementType: "shape.geo",
      semantic: { geo: "rect" },
      visual: {},
    },
  ]);
  expect(editor.getSnapshot()).toEqual(before);
});

test("flow compatibility detects corrected types and participant order follows existing entries", () => {
  const editor = makeEditor();
  const a = editor.createElement("bpmn.task");
  const b = editor.createElement("bpmn.task");
  expect(editor.bpmnFlowIssue("bpmn.sequenceFlow", a, b)).toBeNull();
  expect(
    editor.bpmnFlowIssue("bpmn.sequenceFlow", a, b, {
      id: a,
      type: "bpmn.textAnnotation",
    }),
  ).not.toBeNull();
  const first = editor.createElement("sequence.participant");
  const second = editor.createElement("sequence.participant");
  const next = editor.nextParticipantOrderOn(TEST_PAGE.id);
  for (const id of [first, second]) {
    const order = (editor.store.get(id)?.semantic as { order: string }).order;
    expect(compareFractional(next, order)).toBeGreaterThan(0);
  }
});
