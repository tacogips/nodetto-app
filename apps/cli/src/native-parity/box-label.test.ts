import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { binary, cliEntry, compare, nativeTest } from "./harness.ts";

nativeTest(
  "native box alignment edits and exports match Bun",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-box-align-"));
    try {
      const seed = serializeDocument(new Editor().getSnapshot());
      for (const alignment of ["top", "bottom"] as const) {
        const paths = ["bun.jsonl", "native.jsonl"];
        for (const path of paths) writeFileSync(join(cwd, path), seed);
        const ops = [
          {
            op: "add",
            type: "node.generic",
            id: "node",
            semantic: { label: "Widget" },
            visual: {
              x: 0,
              y: 0,
              width: 180,
              height: 100,
              style: { verticalAlign: alignment },
            },
          },
          {
            op: "add",
            type: "shape.geo",
            id: "shape",
            semantic: { geo: "rect", label: "Order" },
            visual: {
              x: 220,
              y: 0,
              width: 180,
              height: 100,
              style: { verticalAlign: alignment },
            },
          },
          {
            op: "update",
            id: "node",
            visual: { style: { verticalAlign: alignment } },
          },
          {
            op: "update",
            id: "shape",
            visual: { style: { verticalAlign: alignment } },
          },
        ];
        const input = new TextEncoder().encode(JSON.stringify(ops));
        const bun = Bun.spawnSync(
          [process.execPath, cliEntry, "edit", paths[0]!, "--ops", "-"],
          { cwd, stdin: input },
        );
        const native = Bun.spawnSync(
          [binary!, "edit", paths[1]!, "--ops", "-"],
          { cwd, stdin: input },
        );
        expect(bun.exitCode).toBe(0);
        expect(native.exitCode).toBe(bun.exitCode);
        expect(native.stderr.toString().replaceAll(paths[1]!, "doc")).toBe(
          bun.stderr.toString().replaceAll(paths[0]!, "doc"),
        );
        const records = paths.map((path) =>
          readFileSync(join(cwd, path), "utf8")
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line) as Record<string, unknown>),
        );
        for (const doc of records) {
          const elements = doc.filter((record) => record["kind"] === "element");
          expect(
            elements.findIndex((record) => record["id"] === "node"),
          ).toBeLessThan(
            elements.findIndex((record) => record["id"] === "shape"),
          );
          for (const element of elements) element["index"] = undefined;
        }
        expect(records[1]).toEqual(records[0]);

        const clearOps = ["node", "shape"].map((id) => ({
          op: "update",
          id,
          visual: { style: { verticalAlign: null } },
        }));
        const clearInput = new TextEncoder().encode(JSON.stringify(clearOps));
        const seedPath = "update-seed.jsonl";
        writeFileSync(join(cwd, seedPath), readFileSync(join(cwd, paths[0]!)));
        const clearedSeed = Bun.spawnSync(
          [process.execPath, cliEntry, "edit", seedPath, "--ops", "-"],
          { cwd, stdin: clearInput },
        );
        expect(clearedSeed.exitCode).toBe(0);
        const updateSeed = serializeDocument(
          parseDocument(readFileSync(join(cwd, seedPath), "utf8")),
        );
        const assertAlignment = (
          document: string,
          value: "top" | "bottom" | null,
        ) => {
          const elements = parseDocument(document).elements;
          for (const id of ["node", "shape"]) {
            const element = elements.find((item) => item.id === id);
            expect(element).toBeDefined();
            expect(element?.visual.style?.verticalAlign).toBe(
              value ?? undefined,
            );
            expect(element?.visual.style?.boxLabelAlign).toBe(
              value === null ? undefined : true,
            );
          }
        };
        assertAlignment(updateSeed, null);
        for (const path of paths) writeFileSync(join(cwd, path), updateSeed);
        const updates = ops.slice(2);
        const clearedPaths = ["cleared-bun.jsonl", "cleared-native.jsonl"];
        for (const [runtime, path] of paths.entries()) {
          const executable =
            runtime === 0 ? [process.execPath, cliEntry] : [binary!];
          const result = Bun.spawnSync(
            [...executable, "edit", path, "--ops", "-"],
            {
              cwd,
              stdin: new TextEncoder().encode(JSON.stringify(updates)),
            },
          );
          expect(result.exitCode).toBe(0);
          const marked = readFileSync(join(cwd, path), "utf8");
          expect(marked).not.toBe(updateSeed);
          assertAlignment(marked, alignment);
          const clearedPath = clearedPaths[runtime]!;
          writeFileSync(join(cwd, clearedPath), marked);
          const resultClear = Bun.spawnSync(
            [...executable, "edit", clearedPath, "--ops", "-"],
            {
              cwd,
              stdin: clearInput,
            },
          );
          expect(resultClear.exitCode).toBe(0);
          assertAlignment(readFileSync(join(cwd, clearedPath), "utf8"), null);
        }
        expect(readFileSync(join(cwd, paths[1]!))).toEqual(
          readFileSync(join(cwd, paths[0]!)),
        );
        expect(readFileSync(join(cwd, clearedPaths[1]!))).toEqual(
          readFileSync(join(cwd, clearedPaths[0]!)),
        );
        expect(
          compare(["export", paths[0]!, "--format", "svg"], cwd).exitCode,
        ).toBe(0);
        expect(
          compare(["export", paths[1]!, "--format", "svg"], cwd).exitCode,
        ).toBe(0);

        const invalid = JSON.stringify([
          {
            op: "update",
            id: "node",
            visual: { style: { valign: alignment } },
          },
        ]);
        const bad = compare(["edit", paths[0]!, "--ops", "-"], cwd, invalid);
        expect(bad.exitCode).not.toBe(0);
        expect(bad.stderr.toString()).toContain("valign");

        for (const [runtime, path] of paths.entries()) {
          const executable =
            runtime === 0 ? [process.execPath, cliEntry] : [binary!];
          const unmarked = `unmarked-${runtime}.jsonl`;
          writeFileSync(join(cwd, unmarked), readFileSync(join(cwd, path)));
          const clear = Bun.spawnSync(
            [...executable, "edit", unmarked, "--ops", "-"],
            {
              cwd,
              stdin: new TextEncoder().encode(
                JSON.stringify([
                  {
                    op: "update",
                    id: "node",
                    visual: { style: { boxLabelAlign: null } },
                  },
                  {
                    op: "update",
                    id: "shape",
                    visual: { style: { boxLabelAlign: null } },
                  },
                ]),
              ),
            },
          );
          expect(clear.exitCode).toBe(0);
          for (const format of ["png", "pdf"]) {
            const outputs: Buffer[] = [];
            for (const [index, doc] of [path, unmarked].entries()) {
              const out = `out-${runtime}-${index}.${format}`;
              const result = Bun.spawnSync(
                [
                  ...executable,
                  "export",
                  doc,
                  "--format",
                  format,
                  "--output",
                  out,
                ],
                { cwd },
              );
              expect(result.exitCode).toBe(0);
              const bytes = readFileSync(join(cwd, out));
              expect([...bytes.subarray(0, 4)]).toEqual(
                format === "png" ? [137, 80, 78, 71] : [37, 80, 68, 70],
              );
              outputs.push(bytes);
            }
            if (format === "png" || runtime === 1)
              expect(outputs[0]!.equals(outputs[1]!)).toBe(false);
          }
        }
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  60000,
);
