import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { binary, cliEntry, compare, nativeTest } from "./harness.ts";

function fixture() {
  const editor = new Editor();
  for (const [i, id] of ["alpha", "beta", "gamma"].entries())
    editor.createElement("node.generic", {
      id,
      semantic: { label: id },
      visual: { x: i * 300, y: 0 },
    });
  return editor;
}
function run(
  executable: string[],
  cwd: string,
  args: string[],
  stdin?: string,
) {
  return Bun.spawnSync([...executable, ...args], {
    cwd,
    stdin: stdin === undefined ? undefined : new TextEncoder().encode(stdin),
  });
}
function withDir(fn: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "nodetto-order-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

nativeTest(
  "native order batch matches Bun and preserves stored order and SVG",
  () =>
    withDir((dir) => {
      const source = serializeDocument(fixture().getSnapshot());
      writeFileSync(join(dir, "bun.jsonl"), source);
      writeFileSync(join(dir, "native.jsonl"), source);
      const ops = JSON.stringify([
        { op: "select", id: "beta", ref: "panel" },
        { op: "order", id: "@panel", to: "back" },
        { op: "order", id: "alp", to: "front" },
        { op: "order", id: "name:gamma", before: "beta" },
        { op: "order", where: { type: "node.generic" }, expect: 3, to: "back" },
        { op: "order", id: "beta", after: "alpha" },
        { op: "order", id: "beta", to: "backward" },
        { op: "order", id: "beta", to: "forward" },
      ]);
      expect(
        compare(["edit", "bun.jsonl", "--ops", "-", "--dry-run"], dir, ops)
          .exitCode,
      ).toBe(0);
      for (const [exe, file] of [
        [[process.execPath, cliEntry], "bun.jsonl"],
        [[binary!], "native.jsonl"],
      ] as const) {
        expect(
          run([...exe], dir, ["edit", file, "--ops", "-"], ops).exitCode,
        ).toBe(0);
      }
      const ids = (file: string) => {
        const editor = new Editor({
          document: parseDocument(readFileSync(join(dir, file), "utf8")),
        });
        return editor.store
          .getPageElements(editor.store.listPages()[0]!.id)
          .map((e) => e.id);
      };
      expect(ids("native.jsonl")).toEqual(ids("bun.jsonl"));
      const a = run([process.execPath, cliEntry], dir, [
        "export",
        "bun.jsonl",
        "--format",
        "svg",
      ]);
      const b = run([binary!], dir, [
        "export",
        "native.jsonl",
        "--format",
        "svg",
      ]);
      expect(a.exitCode).toBe(0);
      expect(b.exitCode).toBe(0);
      expect(b.stdout.toString()).toBe(a.stdout.toString());
    }),
  60000,
);

nativeTest(
  "native group member order matches Bun",
  () =>
    withDir((dir) => {
      const editor = fixture();
      editor.createElement("group", {
        id: "group",
        semantic: { memberIds: ["alpha", "beta", "gamma"] },
      });
      const source = serializeDocument(editor.getSnapshot());
      for (const f of ["bun.jsonl", "native.jsonl"])
        writeFileSync(join(dir, f), source);
      const ops = JSON.stringify([{ op: "order", id: "gamma", to: "back" }]);
      expect(
        run(
          [process.execPath, cliEntry],
          dir,
          ["edit", "bun.jsonl", "--ops", "-"],
          ops,
        ).exitCode,
      ).toBe(0);
      expect(
        run([binary!], dir, ["edit", "native.jsonl", "--ops", "-"], ops)
          .exitCode,
      ).toBe(0);
      const members = (f: string) =>
        parseDocument(readFileSync(join(dir, f), "utf8")).elements.find(
          (e) => e.id === "group",
        )?.semantic;
      expect(members("bun.jsonl")).toMatchObject({
        memberIds: ["gamma", "alpha", "beta"],
      });
      expect(members("native.jsonl")).toEqual(members("bun.jsonl"));
    }),
  60000,
);

nativeTest(
  "native order errors match Bun",
  () =>
    withDir((dir) => {
      writeFileSync(
        join(dir, "doc.jsonl"),
        serializeDocument(fixture().getSnapshot()),
      );
      for (const op of [
        { op: "send-to-back", id: "alpha" },
        { op: "order", id: "alpha", to: "middle" },
      ]) {
        const result = compare(
          ["edit", "doc.jsonl", "--ops", "-", "--dry-run"],
          dir,
          JSON.stringify([op]),
        );
        expect(result.exitCode).toBe(2);
        expect(result.stderr.toString()).toContain(
          op.op === "order" ? '"to" must be' : '"to":"back"',
        );
      }
    }),
  60000,
);

nativeTest(
  "native SVG export matches Bun for inverted frames and connector layers",
  () =>
    withDir((dir) => {
      for (const connected of [false, true]) {
        const editor = new Editor();
        editor.createElement("node.generic", {
          id: "node",
          visual: { x: 20, y: 20, width: 40, height: 40 },
        });
        if (connected)
          editor.createElement("node.generic", {
            id: "panel",
            visual: { x: 500, y: 0 },
          });
        editor.createElement("frame", {
          id: "frame",
          visual: { x: 0, y: 0, width: 200, height: 200 },
        });
        if (connected)
          editor.createElement("edge.generic", {
            id: "connector",
            semantic: { from: "node", to: "panel" },
          });
        writeFileSync(
          join(dir, "doc.jsonl"),
          serializeDocument(editor.getSnapshot()),
        );
        expect(
          compare(["export", "doc.jsonl", "--format", "svg"], dir).exitCode,
        ).toBe(0);
      }
    }),
  60000,
);
