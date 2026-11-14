import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor, resolveConnector, endpointReaderFor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import {
  binary,
  cliSrcDir,
  compare,
  fixtureRoot,
  nativeTest,
} from "./harness.ts";

nativeTest(
  "native edit handles refs, arrangement, snapshots and rollback using the shared engine",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-edit-"));
    try {
      const source = serializeDocument(new Editor().getSnapshot());
      writeFileSync(join(cwd, "doc.jsonl"), source);
      const operations = [
        { op: "add-page", name: "Flow", kind: "freeform", ref: "flow" },
        {
          op: "add",
          page: "@flow",
          type: "node.generic",
          ref: "one",
          semantic: { label: "First" },
        },
        {
          op: "add",
          page: "@flow",
          type: "node.generic",
          ref: "two",
          place: { rightOf: "@one", gap: 80 },
          semantic: { label: "Second" },
        },
        { op: "connect", from: "@one", to: "@two", label: "Next" },
        { op: "update", id: "@one", visual: { x: 40 } },
        { op: "move", id: "@two", x: 400, y: 100 },
        { op: "rename-page", id: "@flow", name: "Renamed" },
      ];
      const applied = Bun.spawnSync(
        [
          binary!,
          "edit",
          "doc.jsonl",
          "--ops",
          "-",
          "--snapshot",
          "last.jsonl",
          "--arrange",
        ],
        { cwd, stdin: new TextEncoder().encode(JSON.stringify(operations)) },
      );
      expect(applied.exitCode).toBe(0);
      const saved = readFileSync(join(cwd, "doc.jsonl"), "utf8");
      const document = parseDocument(saved);
      expect(document.elements).toHaveLength(3);
      expect(document.pages.some((page) => page.name === "Renamed")).toBe(true);
      expect(readFileSync(join(cwd, "last.jsonl"), "utf8")).toBe(saved);
      compare(["inspect", "doc.jsonl"], cwd);
      compare(["format", "doc.jsonl", "--check"], cwd);
      const invalid = Bun.spawnSync(
        [binary!, "edit", "doc.jsonl", "--ops", "-"],
        {
          cwd,
          stdin: new TextEncoder().encode(
            '[{"op":"move","id":"missing","x":0,"y":0}]',
          ),
        },
      );
      expect(invalid.exitCode).toBe(2);
      expect(readFileSync(join(cwd, "doc.jsonl"), "utf8")).toBe(saved);
      const importResult = Bun.spawnSync(
        [
          binary!,
          "bpmn",
          "import",
          join(fixtureRoot, "bpmn/purchase-request.bpmn"),
          "--output",
          "process.jsonl",
        ],
        { cwd },
      );
      expect(importResult.exitCode).toBe(0);
      expect(
        parseDocument(readFileSync(join(cwd, "process.jsonl"), "utf8")).pages[0]
          ?.kind,
      ).toBe("bpmn");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  15000,
);

nativeTest(
  "native CLI draws and exports a state flow",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-state-"));
    try {
      const file = join(dir, "flow.jsonl");
      writeFileSync(
        file,
        '{"kind":"document","schemaVersion":1,"id":"state-flow","title":"Flow"}\n{"kind":"page","id":"p1","name":"Flow","pageKind":"state"}\n',
      );
      const ops = join(
        cliSrcDir,
        "../../../examples/state-transition/flow.ops.json",
      );
      const edit = Bun.spawnSync([
        binary!,
        "edit",
        file,
        "--ops",
        ops,
        "--format",
        "json",
      ]);
      expect(edit.exitCode).toBe(0);
      const document = parseDocument(readFileSync(file, "utf8"));
      expect(
        document.elements.filter((element) => element.type === "state.node"),
      ).toHaveLength(5);
      const transitions = document.elements.filter(
        (element) => element.type === "state.transition",
      );
      expect(transitions).toHaveLength(6);
      expect(
        transitions.some(
          (element) =>
            (element.semantic as { from: string; to: string }).from ===
            (element.semantic as { from: string; to: string }).to,
        ),
      ).toBe(true);
      expect(transitions.map((element) => element.semantic)).toContainEqual(
        expect.objectContaining({
          trigger: "start",
          guard: "ready",
          effect: "begin()",
        }),
      );
      compare(["validate", file]);
      compare(["inspect", file, "--format", "json"]);
      for (const format of ["svg", "png", "pdf", "mermaid"]) {
        const output = join(dir, `flow.${format}`);
        const args = ["export", file, "--format", format, "--output", output];
        if (format === "mermaid")
          args.push("--mermaid-kind", "stateDiagram-v2");
        const result = Bun.spawnSync([binary!, ...args]);
        expect(result.exitCode).toBe(0);
        const bytes = readFileSync(output);
        expect(bytes.byteLength).toBeGreaterThan(100);
        if (format === "svg") {
          expect(bytes.toString()).toContain("start [ready] / begin()");
          expect(bytes.toString()).not.toContain("unsupported");
        } else if (format === "png")
          expect(bytes.subarray(1, 4).toString()).toBe("PNG");
        else if (format === "pdf")
          expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
        else expect(bytes.toString()).toContain("stateDiagram-v2");
      }
      compare([
        "export",
        file,
        "--format",
        "mermaid",
        "--mermaid-kind",
        "stateDiagram-v2",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "native CLI creates a flowchart with decisions and retry paths",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-flowchart-"));
    try {
      const file = join(dir, "flowchart.jsonl");
      writeFileSync(
        file,
        '{"kind":"document","schemaVersion":1,"id":"flowchart","title":"Request flowchart"}\n{"kind":"page","id":"p1","name":"Flowchart","pageKind":"flowchart"}\n',
      );
      const ops = join(
        cliSrcDir,
        "../../../examples/flowchart/request.ops.json",
      );
      const result = Bun.spawnSync([binary!, "edit", file, "--ops", ops]);
      expect(result.exitCode).toBe(0);
      const document = parseDocument(readFileSync(file, "utf8"));
      expect(
        document.elements.filter((element) => element.type === "shape.geo"),
      ).toHaveLength(7);
      expect(
        document.elements.filter((element) => element.type === "edge.generic"),
      ).toHaveLength(7);
      compare(["validate", file]);
      compare(["inspect", file, "--format", "json"]);
      compare([
        "export",
        file,
        "--format",
        "mermaid",
        "--mermaid-kind",
        "flowchart",
      ]);
      for (const format of ["svg", "png", "pdf"]) {
        const output = join(dir, `flowchart.${format}`);
        expect(
          Bun.spawnSync([
            binary!,
            "export",
            file,
            "--format",
            format,
            "--output",
            output,
          ]).exitCode,
        ).toBe(0);
        const bytes = readFileSync(output);
        expect(bytes.byteLength).toBeGreaterThan(100);
        if (format === "svg") {
          expect(bytes.toString()).toContain("Read request");
          expect(bytes.toString()).toContain("Retry");
        }
        if (format === "png")
          expect(bytes.subarray(1, 4).toString()).toBe("PNG");
        if (format === "pdf")
          expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "native CLI keeps manual bends fixed when moving the attached shape",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-manual-bends-"));
    try {
      const editor = new Editor();
      const shape = editor.createElement("node.generic", {
        id: "shape",
        visual: { x: 0, y: 0, width: 100, height: 100 },
      });
      editor.createElement("edge.generic", {
        id: "arrow",
        semantic: {
          from: shape,
          toPoint: { x: 450, y: 50 },
          routing: "manual",
          routingWaypoints: [{ u: 0.5, v: 150 }],
        },
      });
      const file = join(dir, "bends.jsonl");
      const ops = join(dir, "move.json");
      writeFileSync(file, serializeDocument(editor.getSnapshot()));
      writeFileSync(
        ops,
        JSON.stringify([{ op: "move", id: shape, x: 100, y: 100 }]),
      );
      const result = Bun.spawnSync([binary!, "edit", file, "--ops", ops]);
      expect(result.exitCode).toBe(0);
      const moved = new Editor({
        document: parseDocument(readFileSync(file, "utf8")),
      });
      const arrow = moved.store.get("arrow")!;
      const resolved = resolveConnector(
        arrow,
        moved.createShapeContext(),
        endpointReaderFor(arrow.type),
      )!;
      expect(resolved.waypointPoints![0]!.x).toBeCloseTo(250);
      expect(resolved.waypointPoints![0]!.y).toBeCloseTo(200);
      compare(["validate", file]);
      compare(["export", file, "--format", "svg"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);
