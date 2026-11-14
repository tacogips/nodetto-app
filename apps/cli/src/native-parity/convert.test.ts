import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { compareFile, nativeTest } from "./harness.ts";

nativeTest(
  "conversion and reconnect match native",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-convert-parity-"));
    try {
      const doc = join(dir, "doc.jsonl");
      const ops = join(dir, "ops.json");
      const editor = new Editor();
      for (const [id, x] of [
        ["a", 0],
        ["b", 300],
        ["c", 600],
      ] as const)
        editor.createElement("node.generic", {
          id,
          semantic: { label: id },
          visual: { x, y: 0, width: 180, height: 120 },
        });
      editor.createElement("edge.generic", {
        id: "edge",
        semantic: { from: "a", to: "b", label: "Link", fromPort: "right" },
      });
      const source = serializeDocument(editor.getSnapshot());
      const cases = [
        [
          [{ op: "convert", id: "a", shape: "flowchart:database" }],
          ["--format", "json"],
          0,
        ],
        [[{ op: "convert", id: "a", shape: "flowchart:database" }], [], 0],
        [[{ op: "convert", id: "a", type: "state.node" }], [], 0],
        [
          [
            {
              op: "convert",
              where: { type: "node.generic" },
              expect: 3,
              type: "shape.geo",
              semantic: { geo: "rect" },
            },
          ],
          [],
          0,
        ],
        [[{ op: "convert", id: "a", type: "erd.table" }], [], 2],
        [[{ op: "delete", id: "a", reconnectTo: "c" }], [], 0],
        [[{ op: "delete", id: "a", reconnectTo: "b" }], [], 2],
      ] as const;
      for (const [operation, flags, code] of cases) {
        writeFileSync(ops, JSON.stringify(operation));
        const result = compareFile(
          ["edit", doc, "--ops", ops, ...flags],
          doc,
          source,
        );
        expect(result.exitCode).toBe(code);
        if (code === 2) expect(readFileSync(doc, "utf8")).toBe(source);
      }
      const dry = new Editor();
      dry.createElement("state.node", {
        id: "a",
        semantic: { name: "Ready", kind: "state" },
        visual: { x: 0, y: 0, width: 180, height: 120 },
      });
      dry.createElement("node.generic", { id: "b" });
      dry.createElement("edge.generic", {
        id: "edge",
        semantic: { from: "a", to: "b" },
      });
      const drySource = serializeDocument(dry.getSnapshot());
      writeFileSync(
        ops,
        JSON.stringify([{ op: "convert", id: "a", type: "node.generic" }]),
      );
      const dryResult = compareFile(
        ["edit", doc, "--ops", ops, "--dry-run"],
        doc,
        drySource,
      );
      expect(dryResult.exitCode).toBe(0);
      expect(dryResult.stdout.toString()).toContain("semantic.kind");
      expect(dryResult.stdout.toString()).toContain("edge");
      expect(readFileSync(doc, "utf8")).toBe(drySource);
      const state = new Editor();
      state.createElement("state.node", {
        id: "a",
        semantic: { name: "Ready", kind: "state" },
        visual: { x: 0, y: 0, width: 180, height: 120 },
      });
      state.createElement("state.node", { id: "b" });
      state.createElement("state.transition", {
        id: "edge",
        semantic: { from: "a", to: "b" },
      });
      const stateSource = serializeDocument(state.getSnapshot());
      writeFileSync(
        ops,
        JSON.stringify([{ op: "convert", id: "a", type: "node.generic" }]),
      );
      const failed = compareFile(["edit", doc, "--ops", ops], doc, stateSource);
      expect(failed.exitCode).toBe(2);
      expect(readFileSync(doc, "utf8")).toBe(stateSource);
      const bpmn = new Editor();
      bpmn.createElement("bpmn.task", { id: "a" });
      bpmn.createElement("bpmn.task", { id: "b" });
      bpmn.createElement("bpmn.sequenceFlow", {
        id: "flow",
        semantic: { from: "a", to: "b" },
      });
      const bpmnSource = serializeDocument(bpmn.getSnapshot());
      writeFileSync(
        ops,
        JSON.stringify([
          { op: "convert", id: "a", type: "bpmn.textAnnotation" },
        ]),
      );
      expect(
        compareFile(["edit", doc, "--ops", ops], doc, bpmnSource).exitCode,
      ).toBe(2);
      expect(readFileSync(doc, "utf8")).toBe(bpmnSource);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);
