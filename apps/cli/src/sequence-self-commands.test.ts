import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDocument } from "@nodetto/io";

const main = join(import.meta.dir, "main.ts");
const document = (kind: string) =>
  `{"kind":"document","schemaVersion":1,"id":"01JFEAT0000000000000000000","title":"Sequence"}\n{"kind":"page","id":"p1","name":"Main","pageKind":"${kind}"}\n`;
const participant = (ref: string) => ({
  op: "add",
  page: "p1",
  type: "sequence.participant",
  ref,
  semantic: { name: ref },
});
function run(cwd: string, ...args: string[]) {
  return Bun.spawnSync([process.execPath, main, ...args], { cwd });
}
function withDocument(kind: string, fn: (cwd: string) => void) {
  const cwd = mkdtempSync(join(tmpdir(), "nodetto-self-"));
  try {
    writeFileSync(join(cwd, "doc.jsonl"), document(kind));
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
function edit(cwd: string, ops: unknown[]) {
  writeFileSync(join(cwd, "ops.json"), JSON.stringify(ops));
  return run(cwd, "edit", "doc.jsonl", "--ops", "ops.json");
}
function expectLoop(svg: string) {
  const match = /<polyline[^>]*points="([^"]+)"[^>]*marker-end=/.exec(svg);
  expect(match).not.toBeNull();
  const points = (match?.[1] ?? "")
    .split(" ")
    .map((point) => point.split(",").map(Number));
  expect(points).toHaveLength(4);
  const x = points[0]?.[0] as number;
  const y = points[0]?.[1] as number;
  expect(points).toEqual([
    [x, y],
    [x + 40, y],
    [x + 40, y + 32],
    [x, y + 32],
  ]);
}
function saved(cwd: string) {
  return parseDocument(readFileSync(join(cwd, "doc.jsonl"), "utf8"));
}

for (const kind of ["sync", "async", "return"]) {
  test(`CLI self-connect ${kind} saves and validates`, () =>
    withDocument("sequence", (cwd) => {
      const result = edit(cwd, [
        participant("a"),
        {
          op: "connect",
          from: "@a",
          to: "@a",
          label: "check",
          semantic: { kind },
        },
      ]);
      expect(result.exitCode).toBe(0);
      const message = saved(cwd).elements.find(
        (e) => e.type === "sequence.message",
      );
      const semantic = message?.semantic as {
        from: string;
        to: string;
        kind: string;
        label: string;
      };
      expect(semantic).toMatchObject({ kind, label: "check" });
      expect(semantic.from).toBe(semantic.to);
      expect(run(cwd, "validate", "doc.jsonl").exitCode).toBe(0);
      const svg = run(cwd, "export", "doc.jsonl", "--format", "svg");
      expect(svg.exitCode).toBe(0);
      const text = svg.stdout.toString();
      expectLoop(text);
      expect(text).toContain('text-anchor="start"');
      if (kind === "return") expect(text).toContain('stroke-dasharray="6 4"');
      for (const format of ["png", "pdf"]) {
        const output = `out.${format}`;
        expect(
          run(
            cwd,
            "export",
            "doc.jsonl",
            "--format",
            format,
            "--output",
            output,
          ).exitCode,
        ).toBe(0);
        expect([...readFileSync(join(cwd, output)).subarray(0, 4)]).toEqual(
          format === "png" ? [137, 80, 78, 71] : [37, 80, 68, 70],
        );
      }
    }));
}

test("explicit message shape self-connect and next row spacing", () =>
  withDocument("sequence", (cwd) => {
    const result = edit(cwd, [
      participant("a"),
      participant("b"),
      { op: "connect", shape: "sequence.message", from: "@a", to: "@a" },
      { op: "connect", from: "@a", to: "@b" },
    ]);
    expect(result.exitCode).toBe(0);
    const messages = saved(cwd).elements.filter(
      (e) => e.type === "sequence.message",
    );
    expect(messages).toHaveLength(2);
    const first = messages.find((message) => {
      const semantic = message.semantic as { from: string; to: string };
      return semantic.from === semantic.to;
    });
    const second = messages.find((message) => {
      const semantic = message.semantic as { from: string; to: string };
      return semantic.from !== semantic.to;
    });
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(second?.visual.y).toBe((first?.visual.y as number) + 32 + 52);
  }));

test("class self-connect keeps the existing rejection", () =>
  withDocument("uml", (cwd) => {
    const result = edit(cwd, [
      {
        op: "add",
        page: "p1",
        type: "uml.class",
        ref: "a",
        semantic: { name: "Widget" },
      },
      { op: "connect", from: "@a", to: "@a" },
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("Cannot connect");
  }));

test("existing document with an added equal-ends message now exports a loop", () =>
  withDocument("sequence", (cwd) => {
    expect(
      edit(cwd, [
        participant("a"),
        {
          op: "add",
          page: "p1",
          type: "sequence.message",
          semantic: { from: "@a", to: "@a", label: "check" },
        },
      ]).exitCode,
    ).toBe(0);
    const svg = run(cwd, "export", "doc.jsonl", "--format", "svg");
    expect(svg.exitCode).toBe(0);
    expectLoop(svg.stdout.toString());
  }));

test("types notes apply only to sequence messages", () =>
  withDocument("sequence", (cwd) => {
    const text = run(cwd, "types", "sequence.message").stdout.toString();
    expect(text).toContain("self-call loop");
    expect(text).toContain("next row");
    const message = JSON.parse(
      run(
        cwd,
        "types",
        "sequence.message",
        "--format",
        "json",
      ).stdout.toString(),
    );
    expect(message.notes).toEqual([expect.stringContaining("self-call loop")]);
    expect(run(cwd, "types", "erd.table").stdout.toString()).not.toContain(
      "self-call loop",
    );
    expect(
      JSON.parse(
        run(cwd, "types", "erd.table", "--format", "json").stdout.toString(),
      ).notes,
    ).toBeUndefined();
  }));
