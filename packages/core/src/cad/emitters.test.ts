import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { hasErrors, validateDocument } from "@nodetto/ir";
import ts from "typescript";
import { addBpmnLaneCommands } from "../bpmn/containment.ts";
import { FreehandGesture } from "../freehand-gesture.ts";
import { importHtmlLayout } from "../html-layout.ts";
import { insertKitComponent } from "../kits/ios/insert.ts";
import { connectScreenTransition } from "../screen-transition.ts";
import { connectShape } from "../shape-catalogue.ts";
import { createDesignTemplate } from "../templates/design-templates.ts";
import { makeEditor } from "../test-helpers.ts";
import { Tool } from "../tools.ts";
import { insertUiBlock } from "../ui-blocks.ts";

const point = { x: 10, y: 10 };

test("canCreateOn uses the target page and shares the IR content rule", () => {
  const editor = makeEditor();
  const freeform = editor.currentPageId;
  const cad = editor.createPage({ kind: "cad3d" });
  expect(editor.canCreateOn("missing", "frame")).toBe(false);
  expect(editor.canCreateOn(freeform, "frame")).toBe(true);
  expect(editor.canCreateOn(freeform, "cad.sketch")).toBe(false);
  expect(editor.canCreateOn(cad, "frame")).toBe(false);
  expect(editor.canCreateOn(cad, "cad.future")).toBe(true);
  expect(editor.canCreateOn(cad, "design.guide")).toBe(true);
});

test("page, block, sequence and kit creators leave a CAD page and its selection alone", () => {
  const editor = makeEditor();
  const freeform = editor.currentPageId;
  // An unrelated CAD page may have the same name as the kit definition page.
  const cad = editor.createPage({ kind: "cad3d", name: "iOS kit" });
  const sketch = editor.createElement("cad.sketch");
  editor.selection.set([sketch]);
  const before = editor.getSnapshot();
  expect(editor.addPageFrame()).toBeNull();
  expect(editor.createSequenceParticipant("actor", point)).toBe("");
  expect(insertUiBlock(editor, "button", point)).toBe("");
  expect(insertKitComponent(editor, "ios:list-row", { page: cad })).toBe("");
  expect(editor.getSnapshot()).toBe(before);
  expect([...editor.selection.ids()]).toEqual([sketch]);

  const kit = insertKitComponent(editor, "ios:list-row", { page: freeform });
  expect(editor.store.get(kit)).toMatchObject({
    page: freeform,
    type: "frame",
  });
  expect(editor.currentPageId).toBe(cad);
  editor.setCurrentPage(freeform);
  const frame = editor.addPageFrame();
  expect(frame && editor.store.get(frame)?.type).toBe("frame");
  const participant = editor.createSequenceParticipant("actor", point);
  expect(editor.store.get(participant)?.type).toBe("sequence.participant");
  const block = insertUiBlock(editor, "button", point);
  expect(editor.store.get(block)?.type).toBe("frame");
  expect(hasErrors(validateDocument(editor.getSnapshot()))).toBe(false);
});

test("catalogue connectors use the endpoints' page even when another page is current", () => {
  const editor = makeEditor();
  const first = editor.createElement("shape.geo");
  const second = editor.createElement("shape.geo");
  const cad = editor.createPage({ kind: "cad3d" });
  const sketch = editor.createElement("cad.sketch");
  const other = editor.createElement("cad.sketch");
  const before = editor.getSnapshot();
  expect(connectShape(editor, Tool.Connector, sketch, other)).toBeNull();
  expect(editor.getSnapshot()).toBe(before);

  const edge = connectShape(editor, Tool.Connector, first, second);
  expect(edge && editor.store.get(edge)).toMatchObject({
    type: "edge.generic",
  });
  expect(editor.store.getPageElements(cad).map(({ id }) => id)).toEqual([
    sketch,
    other,
  ]);
  expect(hasErrors(validateDocument(editor.getSnapshot()))).toBe(false);
});

test("freehand starts and commits only on a compatible page", () => {
  const editor = makeEditor();
  const freeform = editor.currentPageId;
  editor.createPage({ kind: "cad3d" });
  const gesture = new FreehandGesture(editor, () => {});
  try {
    const before = editor.getSnapshot();
    expect(gesture.start(1, point)).toBe(false);
    gesture.finish(1, { x: 50, y: 50 });
    expect(editor.getSnapshot()).toBe(before);

    editor.setCurrentPage(freeform);
    expect(gesture.start(1, point)).toBe(true);
    gesture.finish(1, { x: 50, y: 50 });
    expect(editor.store.getPageElements(freeform)).toMatchObject([
      { type: "draw.freehand" },
    ]);
  } finally {
    gesture.dispose();
  }
});

test("dependent notation helpers ignore a CAD-only selection", () => {
  const editor = makeEditor();
  editor.createPage({ kind: "cad3d" });
  const sketch = editor.createElement("cad.sketch");
  const other = editor.createElement("cad.sketch");
  editor.selection.set([sketch, other]);
  const before = editor.getSnapshot();
  expect(editor.createSequenceActivation(sketch)).toBeNull();
  expect(editor.addBpmnLane(sketch).ok).toBe(false);
  expect(addBpmnLaneCommands(before, sketch, "new-lane", "a0")).toEqual([]);
  expect(connectScreenTransition(editor, sketch, other)).toBeNull();
  expect(editor.getSnapshot()).toBe(before);
  expect([...editor.selection.ids()]).toEqual([sketch, other]);
});

test("template and HTML layout build separate freeform documents", () => {
  const docs = [
    createDesignTemplate("web-workspace"),
    importHtmlLayout(
      [
        {
          name: "Caption",
          box: { ...point, width: 100, height: 30 },
          text: "Workshop",
        },
      ],
      { title: "Layout", width: 160, height: 120 },
    ),
  ];
  for (const doc of docs) {
    expect(doc.pages).toMatchObject([{ kind: "freeform" }]);
    expect(doc.elements.some(({ type }) => type === "frame")).toBe(true);
    expect(hasErrors(validateDocument(doc))).toBe(false);
  }
});

// Keep these file classifications in sync with design section 4.
const classifiedEmitters = {
  "apps/desktop/src/seed.ts": "A",
  "packages/core/src/editor/facade/notation-editing.ts": "A",
  "packages/core/src/freehand-gesture.ts": "A",
  "packages/core/src/html-layout.ts": "A",
  "packages/core/src/kits/ios/insert.ts": "A",
  "packages/core/src/page-frames/editing.ts": "A",
  "packages/core/src/shape-catalogue.ts": "A",
  "packages/core/src/templates/design-templates.ts": "A",
  "packages/core/src/ui-blocks.ts": "A",
  "packages/ui-solid/src/ShapePalette.tsx": "A",
  "packages/ui-solid/src/image-import.ts": "A",
  "apps/cli/src/edit/operations/add.ts": "A0",
  "packages/core/src/editor/facade/core.ts": "A0",
  "packages/core/src/editor/facade/element-editing.ts": "A0",
  "packages/core/src/boolean-operations.ts": "B",
  "packages/core/src/bpmn/containment.ts": "B",
  "packages/core/src/editor/bpmn.ts": "B",
  "packages/core/src/editor/components.ts": "B",
  "packages/core/src/editor/connections.ts": "B",
  "packages/core/src/editor/sequence.ts": "B",
  "packages/core/src/frame-selection.ts": "B",
  "packages/core/src/group.ts": "B",
  "packages/core/src/screen-transition.ts": "B",
  "packages/core/src/schematic/target-card.ts": "B",
  "packages/ui-solid/src/interaction/circuit.ts": "C",
  "packages/ui-solid/src/interaction/connectors.ts": "C",
  "packages/ui-solid/src/interaction/creation.ts": "C",
  "packages/ui-solid/src/cad/mesh-io.ts": "C",
  "packages/core/src/cad/authoring.ts": "C",
  "packages/core/src/color-tokens.ts": "D",
  "packages/core/src/comments.ts": "D",
  "packages/core/src/number-tokens.ts": "D",
  "packages/core/src/page-guides.ts": "D",
  "packages/core/src/text-styles.ts": "D",
  "packages/ui-solid/src/inspector/slide-transition-edits.ts": "D",
  "apps/cli/src/__fixtures__/bpmn-layered.ts": "E",
  "apps/cli/src/__fixtures__/connector-arrange.ts": "E",
  "apps/cli/src/__fixtures__/dense-relations.ts": "E",
  "apps/cli/src/__fixtures__/obstacle-routing-batch.ts": "E",
  "apps/cli/src/__fixtures__/sequence-self-timing.ts": "E",
  "apps/cli/src/__fixtures__/text-layout.ts": "E",
  "apps/desktop/src/file/session-test-helpers.ts": "E",
  "packages/core/src/clipboard.ts": "E",
  "packages/core/src/commands.ts": "E",
  "packages/ui-solid/src/interaction-test-helpers.ts": "E",
  "packages/ui-solid/src/test-dom/cad-image.dom.tsx": "E",
  "packages/ui-solid/src/test-dom/cad-inspector.dom.tsx": "E",
  "packages/ui-solid/src/test-dom/cad-sketch.dom.tsx": "E",
  "packages/ui-solid/src/test-dom/text-editor.dom.tsx": "E",
};

function isCreateElement(node: ts.Node): boolean {
  if (ts.isPropertyAssignment(node) && node.name.getText() === "type") {
    const value = ts.isAsExpression(node.initializer)
      ? node.initializer.expression
      : node.initializer;
    if (ts.isStringLiteral(value) && value.text === "createElement")
      return true;
  }
  if (
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression)
  )
    return false;
  const { expression: receiver, name } = node.expression;
  return (
    name.text === "createElement" &&
    !(ts.isIdentifier(receiver) && receiver.text === "document")
  );
}

function includesEmitter(node: ts.Node): boolean {
  return isCreateElement(node) || node.forEachChild(includesEmitter) === true;
}

test("every createElement emitter is classified in design section 4", () => {
  const root = resolve(import.meta.dir, "../../../..");
  const actual: string[] = [];
  for (const group of ["apps", "packages"]) {
    const projects = readdirSync(resolve(root, group), { withFileTypes: true });
    for (const project of projects) {
      if (!project.isDirectory()) continue;
      const src = resolve(root, group, project.name, "src");
      if (!existsSync(src)) continue;
      for (const entry of readdirSync(src, {
        recursive: true,
        withFileTypes: true,
      })) {
        if (
          !entry.isFile() ||
          !/\.tsx?$/.test(entry.name) ||
          /\.test\.tsx?$/.test(entry.name)
        )
          continue;
        const file = resolve(entry.parentPath, entry.name);
        const source = readFileSync(file, "utf8");
        if (!source.includes("createElement")) continue;
        if (
          includesEmitter(
            ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true),
          )
        )
          actual.push(relative(root, file).replaceAll(sep, "/"));
      }
    }
  }
  expect(actual.sort()).toEqual(Object.keys(classifiedEmitters).sort());
});
