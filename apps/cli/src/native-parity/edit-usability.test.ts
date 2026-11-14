import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { bpmnLayeredDocument } from "../__fixtures__/bpmn-layered.ts";
import { textLayoutProblemDocument } from "../__fixtures__/text-layout.ts";
import { compare, compareFile, nativeTest } from "./harness.ts";

nativeTest(
  "edit selectors, labels, unknown fields and quiet match native",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-edit-"));
    try {
      const doc = join(dir, "doc.jsonl");
      const ops = join(dir, "ops.json");
      const editor = new Editor();
      editor.createElement("node.generic", {
        id: "one",
        semantic: { label: "Idle" },
      });
      editor.createElement("node.generic", {
        id: "two",
        semantic: { label: "Idle" },
      });
      const source = serializeDocument(editor.getSnapshot());
      for (const [operations, code, message] of [
        [[{ op: "update", id: "one", label: "Ready" }], 0, ""],
        [
          [{ op: "update", id: "one", labele: "Ready" }],
          2,
          'Did you mean "label"',
        ],
        [[{ op: "update", id: "name:Idle", label: "Ready" }], 2, "one"],
        [
          [
            {
              op: "update",
              where: { type: "node.generic" },
              expect: 1,
              label: "Ready",
            },
          ],
          2,
          "expected 1",
        ],
        [
          [
            {
              op: "update",
              where: { type: "node.generic" },
              expect: 2,
              label: "Ready",
            },
          ],
          0,
          "match",
        ],
        [
          [
            { op: "select", ref: "ok", id: "one" },
            { op: "update", id: "@ok", label: "Ready" },
          ],
          0,
          "",
        ],
      ] as const) {
        writeFileSync(ops, JSON.stringify(operations));
        const result = compareFile(["edit", doc, "--ops", ops], doc, source);
        expect(result.exitCode).toBe(code);
        expect(result.stdout.toString() + result.stderr.toString()).toContain(
          message,
        );
        if (
          operations[0]?.op === "update" &&
          "id" in operations[0] &&
          operations[0].id === "name:Idle"
        ) {
          expect(result.stderr.toString()).toContain("two");
        }
        if (code === 2) expect(readFileSync(doc, "utf8")).toBe(source);
      }
      writeFileSync(doc, textLayoutProblemDocument());
      const exported = compare(["export", doc, "--format", "svg"]);
      expect(exported.exitCode).toBe(0);
      expect(exported.stderr.toString()).toContain("(and 2 more like this)");
      for (const args of [
        ["validate", doc, "--quiet"],
        ["export", doc, "--format", "svg", "--quiet"],
      ]) {
        const result = compare(args);
        expect(result.exitCode).toBe(0);
        expect(result.stderr.toString()).not.toContain("warning:");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "frame and BPMN carry opt-out and lane errors match",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-carry-"));
    try {
      const doc = join(dir, "doc.jsonl");
      const ops = join(dir, "ops.json");
      const editor = new Editor();
      editor.createElement("frame", {
        id: "frame",
        semantic: { name: "Stage" },
        visual: { x: 0, y: 0, width: 500, height: 500 },
      });
      editor.createElement("node.generic", {
        id: "member",
        visual: { x: 60, y: 60, width: 80, height: 60 },
      });
      const nested = new Editor({
        document: parseDocument(bpmnLayeredDocument()),
      });
      nested.createElement("bpmn.lane", {
        id: "nested",
        semantic: { name: "Nested", parent: "lane-0" },
        visual: { x: 60, y: 0, width: 2340, height: 100 },
      });
      for (const [source, operation, member, code, message] of [
        [
          serializeDocument(editor.getSnapshot()),
          {
            op: "update",
            id: "frame",
            visual: { x: 100 },
            carryMembers: false,
          },
          "member",
          0,
          "",
        ],
        [
          bpmnLayeredDocument(),
          {
            op: "update",
            id: "pool-0",
            visual: { x: 100 },
            carryMembers: false,
          },
          "task-0",
          0,
          "",
        ],
        [
          bpmnLayeredDocument(),
          {
            op: "update",
            id: "lane-0",
            visual: { x: 40 },
            carryMembers: false,
          },
          "task-0",
          2,
          "follow its pool",
        ],
        [
          serializeDocument(nested.getSnapshot()),
          {
            op: "update",
            id: "lane-0",
            visual: { height: 1 },
            carryMembers: false,
          },
          "task-0",
          2,
          "at least",
        ],
      ] as const) {
        writeFileSync(ops, JSON.stringify([operation]));
        const result = compareFile(["edit", doc, "--ops", ops], doc, source);
        expect(result.exitCode).toBe(code);
        expect(result.stderr.toString()).toContain(message);
        expect(
          parseDocument(readFileSync(doc, "utf8")).elements.find(
            (e) => e.id === member,
          )?.visual,
        ).toEqual(
          parseDocument(source).elements.find((e) => e.id === member)?.visual,
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "repeated warnings collapse and quiet retains strict status",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-warnings-"));
    try {
      const editor = new Editor();
      for (let i = 0; i < 42; i++)
        editor.createElement("node.generic", {
          id: `n${i}`,
          semantic: { label: `Node ${i}` },
          visual: { x: i * 200, y: 0, width: 100, height: 60 },
        });
      const snapshot = editor.getSnapshot();
      const source = serializeDocument({
        ...snapshot,
        elements: snapshot.elements.map((e) => ({
          ...e,
          semantic: { ...(e.semantic as Record<string, unknown>), extra: true },
        })),
      });
      const doc = join(dir, "doc.jsonl");
      const ops = join(dir, "ops.json");
      writeFileSync(doc, source);
      const normal = compare(["validate", doc, "--strict"]);
      expect(normal.exitCode).toBe(3);
      expect(normal.stdout.toString() + normal.stderr.toString()).toContain(
        "(and 41 more like this)",
      );
      const quiet = compare(["validate", doc, "--strict", "--quiet"]);
      expect(quiet.exitCode).toBe(3);
      expect(quiet.stdout.toString() + quiet.stderr.toString()).toContain(
        "warning",
      );
      expect(quiet.stdout.toString() + quiet.stderr.toString()).not.toContain(
        "(and 41 more like this)",
      );
      writeFileSync(
        ops,
        JSON.stringify([{ op: "update", id: "n0", semantic: { bogus: true } }]),
      );
      const verbose = compareFile(["edit", doc, "--ops", ops], doc, source);
      expect(verbose.exitCode).toBe(0);
      expect(verbose.stdout.toString()).toContain(
        "warning operation 0 (update)",
      );
      const edited = compareFile(
        ["edit", doc, "--ops", ops, "--quiet"],
        doc,
        source,
      );
      expect(edited.exitCode).toBe(0);
      expect(edited.stdout.toString()).not.toContain("warning operation");
      expect(edited.stdout.toString()).toContain("Applied 1 operation(s)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "collapsed BPMN import warnings match native",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-import-"));
    try {
      const path = join(dir, "flow.bpmn");
      writeFileSync(
        path,
        '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="p"><bpmn:startEvent id="start"/><bpmn:endEvent id="end"/></bpmn:process></bpmn:definitions>',
      );
      const result = compare(["bpmn", "import", path, "--strict"]);
      expect(result.exitCode).toBe(3);
      expect(result.stderr.toString()).toContain("(and 1 more like this)");
      expect(result.stderr.toString()).toContain(
        "2 BPMN import warning(s) with --strict.",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);
