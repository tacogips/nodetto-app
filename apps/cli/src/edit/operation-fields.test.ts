import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { runOperations } from "../edit-command.ts";
import { Batch } from "./batch.ts";
import { checkOperationFields, OPERATION_FIELDS } from "./operation-fields.ts";

test("validates visual style keys for add and update", () => {
  const check = (op: string, style: unknown, extra = {}) =>
    checkOperationFields({ op, visual: { style }, ...extra }, 0);
  expect(() => check("update", { valign: 1 })).toThrow(
    'Did you mean "verticalAlign"?',
  );
  expect(() => check("add", { textVerticalAlign: "top" })).toThrow(
    'Did you mean "verticalAlign"?',
  );
  expect(() => check("add", { valign: 1 }, { shape: "rectangle" })).toThrow(
    'unknown visual.style key "valign"',
  );
  try {
    check("update", { align: 1 });
    throw new Error("expected rejection");
  } catch (error) {
    expect(String(error)).toContain('"textAlign"');
    expect(String(error)).toContain('"verticalAlign"');
  }
  try {
    check("update", { bogusxyz: 1, otherxyz: null });
    throw new Error("expected rejection");
  } catch (error) {
    expect(String(error)).toContain('unknown visual.style key "bogusxyz"');
    expect(String(error)).toContain('unknown visual.style key "otherxyz"');
    expect(String(error)).toContain("Valid style keys: fill");
    expect(String(error)).not.toContain("Did you mean");
  }
  expect(() => check("update", { valign: null })).toThrow(
    'unknown visual.style key "valign"',
  );
  expect(() =>
    check("add", { fill: "#112233", verticalAlign: "top", extensions: {} }),
  ).not.toThrow();
  expect(() => check("connect", { valign: 1 })).not.toThrow();
  expect(() => checkOperationFields({ op: "add", visual: 3 }, 0)).not.toThrow();
  expect(() => check("update", 3)).not.toThrow();
});

test("unknown fields are rejected for every operation", () => {
  for (const [op, fields] of Object.entries(OPERATION_FIELDS)) {
    expect(() => checkOperationFields({ op, bogus: true }, 0)).toThrow(
      `unknown field "bogus"`,
    );
    try {
      checkOperationFields({ op, bogus: true }, 0);
    } catch (error) {
      expect(String(error)).toContain(`Valid fields: ${fields.join(", ")}`);
    }
  }
});
test("suggests a close field", () => {
  expect(() =>
    checkOperationFields({ op: "replace-text", replacement: "x" }, 0),
  ).toThrow('Did you mean "replace"?');
});

test("replace-text validates boolean flags", () => {
  const batch = new Batch(new Editor());
  for (const field of ["regex", "ignoreCase"])
    expect(() =>
      batch.apply(
        { op: "replace-text", find: "x", replace: "y", [field]: "yes" },
        0,
      ),
    ).toThrow(`"${field}" must be true or false`);
});

test("handler operation reads are represented in their field rows", () => {
  const handlers: Record<string, string[]> = {
    add: [
      "add:addElement",
      "add:addShape",
      "add:addParticipant",
      "batch:shape",
      "batch:record",
    ],
    connect: ["connect:connectElements", "batch:shape", "batch:record"],
    update: [
      "elements:updateElement",
      "elements:updateOne",
      "selectors:selectedWhere",
    ],
    select: ["select:selectElement", "selectors:selectedWhere"],
    append: ["elements:editListField"],
    "remove-item": ["elements:editListField"],
    move: ["elements:moveElement"],
    scale: ["elements:scaleElements", "batch:targets"],
    "replace-text": ["elements:replaceTextIn", "batch:targets"],
    delete: ["elements:deleteElement", "selectors:selectedWhere"],
    group: ["groups:groupElements", "batch:record"],
    ungroup: ["groups:ungroupElement"],
    "add-page": ["pages:addPage", "pages:placePage"],
    "move-page": ["pages:movePage", "pages:placePage"],
    "rename-page": ["pages:renamePage"],
    "set-page-mode": ["pages:setPageMode"],
    "delete-page": ["pages:deletePage"],
  };
  const reads = (spec: string): string[] => {
    const [file, name] = spec.split(":");
    const path =
      file === "batch" || file === "selectors"
        ? `${import.meta.dir}/${file}.ts`
        : `${import.meta.dir}/operations/${file}.ts`;
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    let found: ts.Node | undefined;
    const find = (node: ts.Node) => {
      if (
        (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
        node.name?.getText(source) === name
      )
        found = node;
      else ts.forEachChild(node, find);
    };
    find(source);
    expect(found).toBeDefined();
    const fields = new Set<string>();
    const visit = (node: ts.Node) => {
      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "operation"
      ) {
        if (ts.isStringLiteral(node.argumentExpression))
          fields.add(node.argumentExpression.text);
        else {
          expect(["pages:placePage", "elements:replaceTextIn"]).toContain(spec);
          expect(node.argumentExpression.getText(source)).toBe("field");
        }
      }
      if (ts.isArrayLiteralExpression(node)) {
        const values = node.elements
          .filter(ts.isStringLiteral)
          .map((element) => element.text);
        if (
          (spec === "pages:placePage" && values.includes("before")) ||
          (spec === "elements:replaceTextIn" && values.includes("regex"))
        )
          for (const field of values) fields.add(field);
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        node.initializer.text === "operation"
      )
        for (const member of node.name.elements)
          if (!member.dotDotDotToken)
            fields.add((member.propertyName ?? member.name).getText(source));
      ts.forEachChild(node, visit);
    };
    if (found) visit(found);
    return [...fields];
  };
  for (const [op, specs] of Object.entries(handlers)) {
    const allowed = new Set(OPERATION_FIELDS[op]);
    // The list handler branches by op; the other branch's field is not read.
    if (op === "append") allowed.add("item");
    if (op === "remove-item") allowed.add("items");
    for (const spec of specs)
      for (const field of reads(spec))
        expect({ op, spec, field, allowed: allowed.has(field) }).toMatchObject({
          allowed: true,
        });
  }
  for (const field of ["before", "after", "order"])
    for (const op of ["add-page", "move-page"])
      expect(OPERATION_FIELDS[op]).toContain(field);
  for (const field of ["regex", "ignoreCase"])
    expect(OPERATION_FIELDS["replace-text"]).toContain(field);
  expect(OPERATION_FIELDS.append).toContain("items");
  expect(OPERATION_FIELDS["remove-item"]).toContain("item");
});

test("each operation with an unknown field exits 2 before writing", () => {
  const source = serializeDocument(new Editor().getSnapshot());
  for (const [op, fields] of Object.entries(OPERATION_FIELDS)) {
    let writes = 0;
    const result = runOperations(
      {
        readText: () => source,
        writeText: () => {
          writes++;
        },
      },
      "doc.jsonl",
      [{ op, bogus: true }],
      { arrange: false, dryRun: false, format: "text" },
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('unknown field "bogus"');
    expect(result.stderr).toContain(`Valid fields: ${fields.join(", ")}`);
    expect(writes).toBe(0);
  }
});
