import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Document, validateDocument } from "@nodetto/ir";
import { importBpmnXml, parseDocumentResult } from "@nodetto/io";
import { createDefaultRegistry } from "./shapes/index.ts";
import {
  createDesignTemplate,
  DESIGN_TEMPLATES,
} from "./templates/design-templates.ts";

const root = join(import.meta.dir, "../../..");
const fixtures = join(root, "packages/io/src/__fixtures__");
const examples = join(root, "examples");
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
function unknown(document: Document) {
  return validateDocument(document, { checkReferences: false }).filter(
    (issue) => issue.code === "semantic.unknownField",
  );
}
function documentFor(type: string, semantic: unknown): Document {
  return {
    schemaVersion: 1,
    id: "d",
    title: "",
    pages: [{ id: "p", name: "P", kind: "freeform" }],
    elements: [
      {
        id: "e",
        page: "p",
        index: "a0",
        type,
        semantic,
        visual: {},
      } as Document["elements"][number],
    ],
  };
}
describe("semantic field audit", () => {
  test("fixtures and examples have no unknown semantic fields", () => {
    const paths = [...files(fixtures), ...files(examples)].filter(
      (path) =>
        path.endsWith(".jsonl") && !path.endsWith("forward-compat.jsonl"),
    );
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      const result = parseDocumentResult(readFileSync(path, "utf8"));
      expect({
        path,
        ok: result.ok,
        warnings: result.issues.filter(
          (i) => i.code === "semantic.unknownField",
        ),
      }).toEqual({ path, ok: true, warnings: [] });
    }
  });
  test("forward-compatible known elements report their three own unknown keys", () => {
    const result = parseDocumentResult(
      readFileSync(join(fixtures, "forward-compat.jsonl"), "utf8"),
    );
    expect(result.ok).toBe(true);
    expect(
      result.issues
        .filter((i) => i.code === "semantic.unknownField")
        .map((i) => i.path)
        .sort(),
    ).toEqual([
      "elements[0].semantic.__proto__",
      "elements[0].semantic.constructor",
      "elements[0].semantic.futureSemantic",
    ]);
  });
  test("example operations, defaults, templates and BPMN imports have no unknown fields", () => {
    for (const path of files(examples).filter((p) => p.endsWith(".ops.json"))) {
      const operations = JSON.parse(readFileSync(path, "utf8")) as {
        op: string;
        type?: string;
        semantic?: unknown;
      }[];
      for (const op of operations)
        if ((op.op === "add" || op.op === "connect") && op.type && op.semantic)
          expect({
            path,
            warnings: unknown(documentFor(op.type, op.semantic)),
          }).toEqual({ path, warnings: [] });
    }
    const registry = createDefaultRegistry();
    expect(registry.types().length).toBeGreaterThan(0);
    for (const type of registry.types())
      expect({
        type,
        warnings: unknown(
          documentFor(type, registry.get(type)!.defaultSemantic()),
        ),
      }).toEqual({ type, warnings: [] });
    for (const template of DESIGN_TEMPLATES)
      expect({
        id: template.id,
        warnings: unknown(createDesignTemplate(template.id)),
      }).toEqual({ id: template.id, warnings: [] });
    const paths = files(join(fixtures, "bpmn")).filter((p) =>
      p.endsWith(".bpmn"),
    );
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths)
      expect({
        path,
        warnings: unknown(importBpmnXml(readFileSync(path, "utf8")).document),
      }).toEqual({ path, warnings: [] });
  });
});
