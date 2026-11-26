import { expect, test } from "bun:test";
import { runCli, type CommandIo } from "./commands.ts";

function fixture(source: string) {
  const files = new Map([["doc.jsonl", source]]);
  let stdin = "";
  const io: CommandIo = {
    readText(path) {
      const text = files.get(path);
      if (text === undefined) throw new Error("ENOENT");
      return text;
    },
    writeText(path, text) {
      files.set(path, text);
    },
    readStdin() {
      return stdin;
    },
  };
  const run = (...args: string[]) => runCli(args, io, "test");
  return {
    run,
    edit(ops: unknown) {
      stdin = JSON.stringify(ops);
      return run("edit", "doc.jsonl", "--ops", "-");
    },
  };
}
const doc = '{"kind":"document","schemaVersion":1,"id":"doc","title":"Test"}\n';
const sheet =
  '{"kind":"page","id":"sheet","name":"Sheet","pageKind":"schematic"}\n';
const board = '{"kind":"page","id":"board","name":"Board","pageKind":"pcb"}\n';
const part = (id: string) =>
  `${JSON.stringify({
    kind: "element",
    id,
    page: "sheet",
    type: "schematic.connector",
    index: id,
    semantic: { reference: "J1", value: "", pinCount: 1 },
  })}\n`;
const wire = `${JSON.stringify({
  kind: "element",
  id: "wire",
  page: "sheet",
  type: "schematic.wire",
  index: "a0",
  semantic: {
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
  },
})}\n`;
type Report = {
  pages: { pageId: string; findings: Record<string, unknown>[] }[];
};

test("schematic lint reports warnings in text and JSON and duplicate references as errors", () => {
  const f = fixture(doc + sheet + wire + part("a1"));
  const text = f.run("lint", "doc.jsonl");
  expect(text.exitCode).toBe(0);
  expect(text.stdout).toContain("dangling-wire-end");
  const json = f.run("lint", "doc.jsonl", "--format", "json");
  expect(json.exitCode).toBe(0);
  const findings = (JSON.parse(json.stdout) as Report).pages.flatMap(
    (page) => page.findings,
  );
  expect(
    findings.some((finding) => finding.ruleId === "dangling-wire-end"),
  ).toBe(true);
  expect(
    findings.some(
      (finding) => finding.ruleId === "unconnected-pin" && finding.pin === 1,
    ),
  ).toBe(true);
  const duplicate = fixture(doc + sheet + part("a1") + part("a2")).run(
    "lint",
    "doc.jsonl",
  );
  expect(duplicate.exitCode).toBe(1);
  expect(duplicate.stdout).toContain("duplicate-reference");
});

test("PCB parity is conditional on a schematic page and identifies the subject page", () => {
  const only = fixture(doc + board);
  for (const format of ["text", "json"]) {
    const result = only.run("lint", "doc.jsonl", "--format", format);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Document contains no BPMN");
  }
  const mixed = fixture(doc + board + sheet + part("a1"));
  const text = mixed.run("lint", "doc.jsonl");
  expect(text.exitCode).toBe(0);
  expect(text.stdout).toContain("pcb-parity-missing-part");
  const result = mixed.run("lint", "doc.jsonl", "--format", "json");
  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout) as Report;
  const pcb = report.pages.find((page) => page.pageId === "board");
  expect(pcb?.findings).toContainEqual(
    expect.objectContaining({
      ruleId: "pcb-parity-missing-part",
      pageId: "sheet",
      elementId: "a1",
    }),
  );
});

test("schematic types can all be added to a new schematic page and validated", () => {
  const f = fixture(
    `${doc}{"kind":"page","id":"initial","name":"Initial","pageKind":"freeform"}\n`,
  );
  const types = f.run("types", "--kind", "schematic", "--format", "json");
  expect(types.exitCode).toBe(0);
  const entries = JSON.parse(types.stdout) as { type: string }[];
  expect(entries).toHaveLength(18);
  expect(entries.every(({ type }) => type.startsWith("schematic."))).toBe(true);
  const edit = f.edit([
    {
      op: "add-page",
      id: "sheet",
      name: "Sheet",
      kind: "schematic",
      ref: "sheet",
    },
    ...entries.map(({ type }, index) => ({
      op: "add",
      page: "@sheet",
      id: `part-${index}`,
      type,
    })),
  ]);
  expect(edit.stderr).toBe("");
  expect(edit.exitCode).toBe(0);
  expect(f.run("validate", "doc.jsonl").exitCode).toBe(0);
});
