import { expect, test } from "bun:test";
import { parseDocument, serializeDocument } from "@nodetto/io";
import type { Document, Element, PageKind } from "@nodetto/ir";
import {
  document,
  element,
  makeEditor,
  TEST_PAGE,
} from "../../../packages/core/src/test-helpers.ts";
import { textLayoutProblemDocument } from "./__fixtures__/text-layout.ts";
import { runCli, type CommandIo } from "./commands.ts";
import { TABLE_HELP } from "./table-command.ts";

function memoryIo(
  files: Record<string, string>,
): CommandIo & { files: Map<string, string> } {
  const store = new Map(Object.entries(files));
  return {
    files: store,
    readText(path) {
      const value = store.get(path);
      if (value === undefined) throw Error("missing");
      return value;
    },
    writeText(path, text) {
      store.set(path, text);
    },
  };
}
const doc = (kind: PageKind, elements: Element[] = []): Document =>
  document(elements, [{ ...TEST_PAGE, kind }]);
const file = (d: Document) => serializeDocument(d);
const run = (io: ReturnType<typeof memoryIo>, ...args: string[]) =>
  runCli(args, io, "t");
function state(kind: PageKind = "state") {
  const editor = makeEditor({ document: doc(kind) });
  if (kind === "state" || kind === "erd") {
    editor.createElement("frame", {
      id: "frame",
      semantic: { name: "Stage", memberIds: ["a", "b"] },
      visual: { x: 0, y: 0, width: 500, height: 500 },
    });
    if (kind === "state") {
      editor.createElement("state.node", {
        id: "a",
        semantic: { kind: "initial", name: "Idle" },
        visual: { x: 20, y: 30, width: 80, height: 50 },
      });
      editor.createElement("state.node", {
        id: "b",
        semantic: { kind: "state", name: "Running" },
        visual: { x: 20, y: 150, width: 80, height: 50 },
      });
      editor.createElement("state.transition", {
        id: "edge",
        semantic: { from: "a", to: "b" },
      });
    } else {
      editor.createElement("erd.table", {
        id: "a",
        semantic: { tableName: "widgets", columns: [] },
        visual: { x: 30, y: 50, width: 100, height: 100 },
      });
    }
  }
  return file(editor.getSnapshot());
}
function bpmn() {
  return doc("bpmn", [
    element({
      id: "pool",
      page: TEST_PAGE.id,
      type: "bpmn.participant",
      index: "a1",
      semantic: { name: "Orders", collapsed: false },
      visual: { x: 0, y: 0, width: 600, height: 240 },
    }),
    element({
      id: "lane",
      page: TEST_PAGE.id,
      type: "bpmn.lane",
      index: "a2",
      semantic: { name: "Intake", parent: "pool" },
      visual: { x: 30, y: 0, width: 570, height: 120 },
    }),
    element({
      id: "lane2",
      page: TEST_PAGE.id,
      type: "bpmn.lane",
      index: "a3",
      semantic: { name: "Shipping", parent: "pool" },
      visual: { x: 30, y: 120, width: 570, height: 120 },
    }),
    element({
      id: "task",
      page: TEST_PAGE.id,
      type: "bpmn.task",
      index: "a4",
      semantic: {
        name: "Check",
        taskType: "user",
        loop: "none",
        parent: "lane",
      },
      visual: { x: 60, y: 40, width: 100, height: 60 },
    }),
  ]);
}

test("table command help and missing subcommand", () => {
  const io = memoryIo({});
  expect(run(io, "table", "--help").stdout).toBe(`${TABLE_HELP}\n`);
  expect(run(io, "table").exitCode).toBe(2);
});

test("merge exits for clean, conflict, and invalid inputs and keeps ours on quiet conflict", () => {
  const base = doc("freeform");
  const ours = { ...base, title: "Ours" };
  const theirs = { ...base, title: "Theirs" };
  const io = memoryIo({
    base: file(base),
    ours: file(ours),
    theirs: file(base),
  });
  expect(run(io, "merge", "base", "ours", "theirs").exitCode).toBe(0);
  io.files.set("theirs", file(theirs));
  const conflict = run(
    io,
    "merge",
    "base",
    "ours",
    "theirs",
    "--output",
    "ours",
    "--quiet",
  );
  expect(conflict.exitCode).toBe(1);
  expect(conflict.stderr).toContain("conflict:");
  expect(io.files.get("ours")).toBe(file(ours));
  io.files.set("theirs", "invalid");
  expect(
    run(io, "merge", "base", "ours", "theirs", "--output", "ours").exitCode,
  ).toBe(2);
  expect(io.files.get("ours")).toBe(file(ours));
});

test("arrange modes validate options and converge through CLI", () => {
  for (const mode of ["layered", "route"]) {
    const io = memoryIo({ doc: state() });
    expect(run(io, "arrange", "doc", "--mode", mode, "--write").exitCode).toBe(
      0,
    );
    expect(run(io, "arrange", "doc", "--mode", mode, "--check").exitCode).toBe(
      0,
    );
  }
  const io = memoryIo({ doc: state() });
  for (const args of [
    ["tidy", "--reset-manual"],
    ["overlaps", "--ids", "x"],
    ["route", "--frames", "x"],
    ["layered", "--ids", "x"],
  ])
    expect(run(io, "arrange", "doc", "--mode", ...args).exitCode).toBe(2);
  expect(run(io, "arrange", "doc", "--mode", "tidy")).toEqual(
    run(io, "arrange", "doc"),
  );
  expect(
    run(memoryIo({ doc: state("erd") }), "arrange", "doc", "--mode", "layered")
      .exitCode,
  ).toBe(0);
  for (const kind of ["sequence", "breadboard", "pcb"] as const)
    for (const mode of ["route", "layered"]) {
      const result = run(
        memoryIo({ doc: state(kind) }),
        "arrange",
        "doc",
        "--mode",
        mode,
      );
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("supports page kinds");
      for (const supported of [
        "state",
        "erd",
        "flowchart",
        "architecture",
        "freeform",
      ])
        expect(result.stderr).toContain(supported);
    }
});

test("BPMN layered stacks lanes and rejects unsupported options", () => {
  const io = memoryIo({ doc: file(bpmn()) });
  for (const args of [
    ["--frames", "x"],
    ["--direction", "TB"],
  ])
    expect(
      run(io, "arrange", "doc", "--mode", "layered", ...args).exitCode,
    ).toBe(2);
  expect(
    run(io, "arrange", "doc", "--mode", "layered", "--write").exitCode,
  ).toBe(0);
  const elements = parseDocument(io.files.get("doc") ?? "").elements;
  const pool = elements.find((e) => e.id === "pool")?.visual;
  const lane = elements.find((e) => e.id === "lane")?.visual;
  const lane2 = elements.find((e) => e.id === "lane2")?.visual;
  expect(lane2?.y).toBe((lane?.y ?? 0) + (lane?.height ?? 0));
  expect((lane2?.y ?? 0) + (lane2?.height ?? 0)).toBeLessThanOrEqual(
    (pool?.y ?? 0) + (pool?.height ?? 0),
  );
  expect(
    run(io, "arrange", "doc", "--mode", "layered", "--check").exitCode,
  ).toBe(0);
});

test("lint metrics and fix pass through CLI", () => {
  const io = memoryIo({ doc: state(), layout: textLayoutProblemDocument() });
  const plain = run(io, "lint", "doc", "--format", "json");
  const metrics = run(io, "lint", "doc", "--metrics", "--format", "json");
  expect(metrics.exitCode).toBe(plain.exitCode);
  expect(JSON.parse(plain.stdout).pages[0].metrics).toBeUndefined();
  expect(JSON.parse(metrics.stdout).pages[0].metrics).toBeDefined();
  expect(JSON.parse(metrics.stdout).summary.metrics).toBeDefined();
  expect(run(io, "lint", "doc", "--metrics").stdout).toContain(
    "edge crossing(s)",
  );
  const fixed = run(io, "lint", "layout", "--fix");
  expect(fixed.stdout).toContain("fixed ");
  const saved = io.files.get("layout");
  expect(saved).not.toBe(textLayoutProblemDocument());
  run(io, "lint", "layout", "--fix");
  expect(io.files.get("layout")).toBe(saved);
  const jsonIo = memoryIo({
    layout: textLayoutProblemDocument(),
    "layout.bpmn": textLayoutProblemDocument(),
  });
  expect(
    JSON.parse(
      run(jsonIo, "lint", "layout", "--fix", "--format", "json").stdout,
    ).fixes.length,
  ).toBeGreaterThan(0);
  expect(run(jsonIo, "lint", "layout.bpmn", "--fix").exitCode).toBe(2);
});

test("edit match reports survive quiet and wrong expect writes nothing", () => {
  const source = state();
  const io = memoryIo({
    doc: source,
    ops: JSON.stringify([
      { op: "delete", where: { type: "state.transition" }, expect: 2 },
    ]),
  });
  expect(run(io, "edit", "doc", "--ops", "ops").exitCode).toBe(2);
  expect(io.files.get("doc")).toBe(source);
  io.files.set(
    "ops",
    JSON.stringify([
      { op: "delete", where: { type: "state.transition" }, expect: 1 },
    ]),
  );
  const result = run(io, "edit", "doc", "--ops", "ops", "--quiet");
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("operation 0 (delete): matched 1 element(s)");
  const jsonIo = memoryIo({ doc: source, ops: io.files.get("ops") ?? "" });
  expect(
    JSON.parse(
      run(jsonIo, "edit", "doc", "--ops", "ops", "--format", "json").stdout,
    ).matches,
  ).toHaveLength(1);
});

test("pool move and resize with carryMembers false preserves task position", () => {
  const io = memoryIo({
    doc: file(bpmn()),
    ops: JSON.stringify([
      {
        op: "update",
        id: "pool",
        visual: { x: -20, y: -20, width: 700, height: 300 },
        carryMembers: false,
      },
    ]),
  });
  expect(run(io, "edit", "doc", "--ops", "ops").exitCode).toBe(0);
  const elements = parseDocument(io.files.get("doc") ?? "").elements;
  expect(elements.find((e) => e.id === "task")?.visual).toMatchObject({
    x: 60,
    y: 40,
  });
  const lane = elements.find((e) => e.id === "lane")?.visual;
  const pool = elements.find((e) => e.id === "pool")?.visual;
  expect(lane).toMatchObject({ x: 10, y: -20, width: 670 });
  expect(lane?.x).toBeGreaterThanOrEqual(pool?.x ?? 0);
  expect(lane?.y).toBeGreaterThanOrEqual(pool?.y ?? 0);
  expect((lane?.x ?? 0) + (lane?.width ?? 0)).toBeLessThanOrEqual(
    (pool?.x ?? 0) + (pool?.width ?? 0),
  );
  expect((lane?.y ?? 0) + (lane?.height ?? 0)).toBeLessThanOrEqual(
    (pool?.y ?? 0) + (pool?.height ?? 0),
  );
  const defaultIo = memoryIo({
    doc: file(bpmn()),
    ops: JSON.stringify([
      {
        op: "update",
        id: "pool",
        visual: { x: -20, y: -20, width: 700, height: 300 },
      },
    ]),
  });
  expect(run(defaultIo, "edit", "doc", "--ops", "ops").exitCode).toBe(0);
  expect(
    parseDocument(defaultIo.files.get("doc") ?? "").elements.find(
      (e) => e.id === "task",
    )?.visual,
  ).toMatchObject({ x: 40, y: 20 });
});

function nestedBpmn(tear: boolean) {
  const entries: Element[] = [
    element({
      id: "p",
      page: TEST_PAGE.id,
      type: "bpmn.participant",
      semantic: { name: "p", collapsed: false },
      visual: { x: 0, y: 0, width: 800, height: 800 },
    }),
  ];
  const lanes = tear
    ? ([
        ["a", "p", 30, 0, 770, 500],
        ["b", "p", 30, 500, 770, 300],
        ["a1", "a", 60, 0, 740, 500],
        ["b1", "b", 60, 500, 740, 300],
      ] as const)
    : ([
        ["a", "p", 30, 0, 770, 800],
        ["a1", "a", 60, 0, 740, 800],
        ["a2", "a1", 90, 0, 710, 800],
      ] as const);
  for (const [i, [id, parent, x, y, width, height]] of lanes.entries())
    entries.push(
      element({
        id,
        page: TEST_PAGE.id,
        index: `a${i + 1}`,
        type: "bpmn.lane",
        semantic: { name: id, parent },
        visual: { x, y, width, height },
      }),
    );
  if (tear)
    for (const [id, parent, y] of [
      ["sa", "a1", 300],
      ["sb", "b1", 620],
    ] as const) {
      entries.push(
        element({
          id,
          page: TEST_PAGE.id,
          type: "bpmn.subProcess",
          semantic: {
            name: id,
            parent,
            expanded: true,
            triggeredByEvent: false,
            adHoc: false,
            loop: "none",
          },
          visual: { x: 100, y, width: 200, height: 100 },
        }),
      );
      entries.push(
        element({
          id: `${id}_in`,
          page: TEST_PAGE.id,
          type: "bpmn.task",
          semantic: { name: id, taskType: "user", loop: "none", parent: id },
          visual: { x: 110, y: y + 10, width: 40, height: 20 },
        }),
      );
    }
  else
    entries.push(
      element({
        id: "unit",
        page: TEST_PAGE.id,
        type: "bpmn.task",
        semantic: {
          name: "unit",
          taskType: "user",
          loop: "none",
          parent: "a2",
        },
        visual: { x: 130, y: 40, width: 20, height: 40 },
      }),
    );
  return file(doc("bpmn", entries));
}

test("nested BPMN refuses to tear subprocess contents without writing", () => {
  const source = nestedBpmn(true);
  const io = memoryIo({ doc: source });
  const result = run(io, "arrange", "doc", "--mode", "layered", "--write");
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain("cannot keep the contents of sub-process");
  expect(io.files.get("doc")).toBe(source);
});

test("depth-three narrow BPMN unit stays in its leaf and converges", () => {
  const io = memoryIo({ doc: nestedBpmn(false) });
  expect(
    run(io, "arrange", "doc", "--mode", "layered", "--write").exitCode,
  ).toBe(0);
  expect(
    parseDocument(io.files.get("doc") ?? "").elements.find(
      (e) => e.id === "unit",
    )?.semantic,
  ).toMatchObject({ parent: "a2" });
  expect(
    run(io, "arrange", "doc", "--mode", "layered", "--check").exitCode,
  ).toBe(0);
});

test("ERD lint reports overlap and clean documents", () => {
  const table = (id: string, x: number) =>
    element({
      id,
      page: TEST_PAGE.id,
      type: "erd.table",
      semantic: { tableName: id, columns: [] },
      visual: { x, y: 0, width: 100, height: 100 },
    });
  const overlap = run(
    memoryIo({ doc: file(doc("erd", [table("a", 0), table("b", 0)])) }),
    "lint",
    "doc",
  );
  expect(overlap.stdout).toContain("node-overlap");
  const clean = run(
    memoryIo({ doc: file(doc("erd", [table("a", 0), table("b", 500)])) }),
    "lint",
    "doc",
  );
  expect(clean.exitCode).toBe(0);
  expect(clean.stdout).not.toContain("node-overlap");
  expect(clean.stdout).toBe("");
  expect(clean.stderr).toBe("");
});

test("warning collapse and quiet preserve strict status and summary", () => {
  const entries = Array.from({ length: 42 }, (_, i) =>
    element({
      id: `n${i}`,
      page: TEST_PAGE.id,
      type: "node.generic",
      semantic: { label: `Node ${i}`, extra: true },
      visual: { x: i * 200, y: 0, width: 100, height: 60 },
    }),
  );
  const io = memoryIo({ doc: file(doc("freeform", entries)) });
  const normal = run(io, "validate", "doc", "--strict");
  expect(normal.exitCode).toBe(3);
  expect(normal.stdout + normal.stderr).toContain("(and 41 more like this)");
  const quiet = run(io, "validate", "doc", "--strict", "--quiet");
  expect(quiet.exitCode).toBe(3);
  expect(quiet.stdout + quiet.stderr).not.toContain("(and 41 more like this)");
  expect(quiet.stdout + quiet.stderr).toContain("warning");
  expect(run(io, "validate", "doc", "--quiet").exitCode).toBe(0);
  const positional = run(io, "validate", "--", "--quiet");
  expect(positional.exitCode).toBe(2);
  expect(positional.stderr).toContain("Cannot read --quiet");
});

test("edit JSON retains repeated warnings", () => {
  const source = state();
  const ops = JSON.stringify(
    ["a", "b"].map((id) => ({ op: "update", id, semantic: { extra: true } })),
  );
  const io = memoryIo({ doc: source, ops });
  const result = run(io, "edit", "doc", "--ops", "ops", "--format", "json");
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout).warnings).toHaveLength(2);
});

test("BPMN import collapses repeated warnings while strict counts every warning", () => {
  const xml =
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="p"><bpmn:startEvent id="start"/><bpmn:endEvent id="end"/></bpmn:process></bpmn:definitions>';
  const io = memoryIo({ "flow.bpmn": xml });
  const normal = run(io, "bpmn", "import", "flow.bpmn");
  expect(normal.exitCode).toBe(0);
  expect(normal.stderr.match(/warning: /g)?.length).toBe(1);
  expect(normal.stderr).toContain("(and 1 more like this)");
  const strict = run(io, "bpmn", "import", "flow.bpmn", "--strict");
  expect(strict.exitCode).toBe(3);
  expect(strict.stderr).toContain("2 BPMN import warning(s) with --strict.");
  expect(strict.stderr).toContain("(and 1 more like this)");
  const quiet = run(io, "bpmn", "import", "flow.bpmn", "--strict", "--quiet");
  expect(quiet.exitCode).toBe(3);
  expect(quiet.stderr).not.toContain("warning: ");
  expect(quiet.stderr).toContain("2 BPMN import warning(s) with --strict.");
});

test("DDL collapses repeated warnings and retains the strict count", () => {
  const tables = [0, 1, 2].map((i) =>
    element({
      id: `table${i}`,
      page: TEST_PAGE.id,
      type: "erd.table",
      index: `a${i}`,
      semantic: { tableName: "widgets", columns: [] },
      visual: { x: i * 200, y: 0, width: 100, height: 100 },
    }),
  );
  const io = memoryIo({ "schema.jsonl": file(doc("erd", tables)) });
  const result = run(io, "ddl", "schema.jsonl", "--strict");
  expect(result.exitCode).toBe(3);
  expect(result.stderr).toContain(
    "Duplicate table name: widgets. (and 1 more like this)",
  );
  expect(result.stderr).toContain("5 DDL warning(s) with --strict.");
});
