import { expect, test } from "bun:test";
import {
  Store,
  applyCommands,
  pageMetrics,
  planLayered,
  planRoute,
} from "@nodetto/core";
import { serializeDocument, parseDocument } from "@nodetto/io";
import type { PageKind } from "@nodetto/ir";
import {
  document,
  makeEditor,
  TEST_PAGE,
} from "../../../packages/core/src/test-helpers.ts";
import { erdTableBounds } from "../../../packages/core/src/shapes/erdTable.ts";
import { arrangeLayeredOrRoute } from "./arrange-modes.ts";
import { obstacleRoutingBatch } from "./__fixtures__/obstacle-routing-batch.ts";

function fixture(kind: PageKind = "state") {
  const editor = makeEditor({
    document: document([], [{ ...TEST_PAGE, kind }]),
  });
  if (kind === "state") {
    editor.createElement("frame", {
      id: "stage0",
      semantic: { name: "Stage0", memberIds: ["idle", "running"] },
      visual: { x: 0, y: 0, width: 500, height: 500 },
    });
    editor.createElement("frame", {
      id: "stage1",
      semantic: { name: "Stage1", memberIds: ["done"] },
      visual: { x: 600, y: 0, width: 500, height: 500 },
    });
    editor.createElement("state.node", {
      id: "idle",
      semantic: { kind: "initial", name: "Idle" },
      visual: { x: 20, y: 30, width: 80, height: 50 },
    });
    editor.createElement("state.node", {
      id: "running",
      semantic: { kind: "state", name: "Running" },
      visual: { x: 20, y: 150, width: 80, height: 50 },
    });
    editor.createElement("state.node", {
      id: "done",
      semantic: { kind: "state", name: "Done" },
      visual: { x: 620, y: 30, width: 80, height: 50 },
    });
    editor.createElement("state.transition", {
      id: "edge0",
      semantic: { from: "idle", to: "running" },
    });
    editor.createElement("state.transition", {
      id: "edge1",
      semantic: { from: "running", to: "done" },
    });
  }
  let text = serializeDocument(editor.getSnapshot());
  const io = {
    readText: () => text,
    writeText: (_: string, value: string) => {
      text = value;
    },
  };
  return {
    io,
    get text() {
      return text;
    },
  };
}

const run = (f: ReturnType<typeof fixture>, ...args: string[]) =>
  arrangeLayeredOrRoute(f.io, ["doc.jsonl", ...args]);

test("layered resolves frame names and writes a stable result", () => {
  const f = fixture();
  expect(
    run(
      f,
      "--mode",
      "layered",
      "--frames",
      "Stage1,Stage0",
      "--direction",
      "TB",
      "--write",
    ).exitCode,
  ).toBe(0);
  const result = parseDocument(f.text);
  expect(result.elements.find((e) => e.id === "stage1")?.visual.y).toBeLessThan(
    result.elements.find((e) => e.id === "stage0")?.visual.y ?? 0,
  );
  expect(
    run(
      f,
      "--mode",
      "layered",
      "--frames",
      "Stage1,Stage0",
      "--direction",
      "TB",
      "--check",
    ).exitCode,
  ).toBe(0);
  const missing = run(f, "--mode", "layered", "--frames", "missing");
  expect(missing.exitCode).toBe(2);
  expect(missing.stderr).toContain("Stage0");
  expect(missing.stderr).toContain("stage1");
});

test("route limits changes to selected connectors and validates options", () => {
  const f = fixture();
  const before = parseDocument(f.text);
  expect(run(f, "--mode", "route", "--ids", "edge0", "--write").exitCode).toBe(
    0,
  );
  const after = parseDocument(f.text);
  expect(after.elements.find((e) => e.id === "edge1")).toEqual(
    before.elements.find((e) => e.id === "edge1"),
  );
  for (const id of ["idle", "running", "done"])
    expect(after.elements.find((e) => e.id === id)?.visual).toEqual(
      before.elements.find((e) => e.id === id)?.visual,
    );
  expect(run(f, "--mode", "route", "--ids", "idle").exitCode).toBe(2);
  expect(run(f, "--mode", "route", "--frames", "Stage0").exitCode).toBe(2);
  expect(run(f, "--mode", "layered", "--ids", "edge0").exitCode).toBe(2);
});

test("route and layered accept BPMN; both exclude sequence", () => {
  for (const kind of ["erd", "bpmn"] as const)
    expect(run(fixture(kind), "--mode", "route").exitCode).toBe(0);
  const bpmn = run(fixture("bpmn"), "--mode", "layered");
  expect(bpmn.exitCode).toBe(0);
  for (const kind of ["sequence", "breadboard", "pcb"] as const) {
    for (const mode of ["layered", "route"]) {
      const result = run(fixture(kind), "--mode", mode);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("supports page kinds");
    }
  }
});

test("layered completes the obstacle-routing fixture within its deadline", () => {
  const fixture = obstacleRoutingBatch();
  const io = { readText: () => fixture.document, writeText: () => {} };
  const start = performance.now();
  const result = arrangeLayeredOrRoute(io, ["doc.jsonl", "--mode", "layered"]);
  const elapsed = performance.now() - start;
  console.log(`A7 layered fixture: ${elapsed.toFixed(1)} ms`);
  expect(result.exitCode).toBe(0);
  expect(elapsed).toBeLessThan(10_000);
}, 10_000);

test("route preserves manual waypoints until reset", () => {
  const f = fixture();
  const before = parseDocument(f.text);
  const manual = {
    ...before,
    elements: before.elements.map((e) =>
      e.id === "edge0"
        ? {
            ...e,
            semantic: {
              ...(e.semantic as object),
              routing: "manual",
              routingWaypoints: [{ u: 0.4, v: 0.3 }],
            },
          }
        : e,
    ),
  };
  f.io.writeText("doc.jsonl", serializeDocument(manual));
  expect(run(f, "--mode", "route", "--ids", "edge0", "--write").exitCode).toBe(
    0,
  );
  const kept = parseDocument(f.text).elements.find(
    (e) => e.id === "edge0",
  )?.semantic;
  expect(kept).toMatchObject({
    routing: "manual",
    routingWaypoints: [{ u: 0.4, v: 0.3 }],
  });
  expect(
    run(f, "--mode", "route", "--ids", "edge0", "--reset-manual", "--write")
      .exitCode,
  ).toBe(0);
  const reset = parseDocument(f.text).elements.find((e) => e.id === "edge0")
    ?.semantic as Record<string, unknown>;
  expect(reset.routing).toBe("orthogonal");
  expect(reset.routingWaypoints).toBeUndefined();
});

test("layered preserves manual routing on a two-frame page", () => {
  const f = fixture();
  const before = parseDocument(f.text);
  const manual = {
    ...before,
    elements: before.elements.map((element) =>
      element.id === "edge0"
        ? {
            ...element,
            semantic: {
              ...(element.semantic as Record<string, unknown>),
              routing: "manual",
              routingWaypoints: [{ u: 0.4, v: 0.3 }],
            },
          }
        : element,
    ),
  };
  f.io.writeText("doc.jsonl", serializeDocument(manual));
  expect(run(f, "--mode", "layered", "--write").exitCode).toBe(0);
  const semantic = parseDocument(f.text).elements.find(
    (element) => element.id === "edge0",
  )?.semantic;
  expect(semantic).toMatchObject({
    routing: "manual",
    routingWaypoints: [{ u: 0.4, v: 0.3 }],
  });
  expect(run(f, "--mode", "layered", "--check").exitCode).toBe(0);
  const again = run(f, "--mode", "layered", "--write");
  expect(again.exitCode).toBe(0);
  expect(again.stderr).toContain("0 layer update(s)");
});

test("layered reverses horizontal frame order", () => {
  const f = fixture();
  expect(
    run(f, "--mode", "layered", "--frames", "Stage1,Stage0", "--write")
      .exitCode,
  ).toBe(0);
  const result = parseDocument(f.text);
  expect(result.elements.find((e) => e.id === "stage1")?.visual.x).toBeLessThan(
    result.elements.find((e) => e.id === "stage0")?.visual.x ?? 0,
  );
});

test("ERD layered keeps tables in frames and rejects pages without frames", () => {
  const editor = makeEditor({
    document: document([], [{ ...TEST_PAGE, kind: "erd" }]),
  });
  editor.createElement("frame", {
    id: "stage",
    semantic: { name: "Stage", memberIds: ["table"] },
    visual: { x: 0, y: 0, width: 500, height: 500 },
  });
  editor.createElement("erd.table", {
    id: "table",
    semantic: { tableName: "widgets", columns: [] },
    visual: { x: 30, y: 50, width: 100, height: 100 },
  });
  let text = serializeDocument(editor.getSnapshot());
  const io = {
    readText: () => text,
    writeText: (_: string, value: string) => {
      text = value;
    },
  };
  expect(
    arrangeLayeredOrRoute(io, ["doc.jsonl", "--mode", "layered", "--write"])
      .exitCode,
  ).toBe(0);
  const elements = parseDocument(text).elements;
  const frame = elements.find((e) => e.id === "stage")!.visual;
  const tableElement = elements.find((e) => e.id === "table")!;
  const table = erdTableBounds(tableElement.visual, tableElement.semantic);
  expect(table.x!).toBeGreaterThanOrEqual(frame.x!);
  expect(table.y!).toBeGreaterThanOrEqual(frame.y!);
  expect(table.x! + table.width!).toBeLessThanOrEqual(frame.x! + frame.width!);
  expect(table.y! + table.height!).toBeLessThanOrEqual(
    frame.y! + frame.height!,
  );
  expect(run(fixture("erd"), "--mode", "layered").exitCode).toBe(2);
});

for (const mode of ["route", "layered"]) {
  test(`reset manual remains stable through serialization in ${mode} mode`, () => {
    const editor = makeEditor({
      document: document([], [{ ...TEST_PAGE, kind: "state" }]),
    });
    editor.createElement("frame", {
      id: "stage",
      semantic: { name: "Stage", memberIds: ["a", "b", "c", "block"] },
      visual: { x: 0, y: 0, width: 700, height: 500 },
    });
    for (const [id, x, y] of [
      ["a", 20, 150],
      ["b", 420, 50],
      ["c", 420, 250],
      ["block", 220, 100],
    ] as const) {
      editor.createElement("node.generic", {
        id,
        visual: { x, y, width: 80, height: 60 },
      });
    }
    editor.createElement("edge.generic", {
      id: "edge-a",
      semantic: {
        from: "a",
        to: "b",
        label: "Review order details and confirm the next step",
      },
    });
    editor.createElement("edge.generic", {
      id: "edge-b",
      semantic: { from: "a", to: "b", label: "Approve" },
    });
    editor.createElement("bpmn.sequenceFlow", {
      id: "manual-label",
      semantic: { from: "c", to: "block", name: "Note", labelPosition: 0.2 },
      visual: { labelBounds: { x: 600, y: 450, width: 40, height: 20 } },
    });
    let text = serializeDocument(editor.getSnapshot());
    const io = {
      readText: () => text,
      writeText: (_: string, value: string) => {
        text = value;
      },
    };
    const args = ["doc.jsonl", "--mode", mode, "--reset-manual"];
    const first = arrangeLayeredOrRoute(io, [...args, "--write"]);
    expect(first.exitCode).toBe(0);
    expect(first.stderr).not.toContain("0 layer update(s)");
    const written = text;
    const edges = parseDocument(written).elements.filter(
      (element) => element.id === "edge-a" || element.id === "edge-b",
    );
    const data = edges.map((edge) => edge.semantic as Record<string, unknown>);
    expect(data.map((item) => item.fromPortPosition).sort()).toEqual([
      0.3333, 0.6667,
    ]);
    const manualLabel = parseDocument(written).elements.find(
      (element) => element.id === "manual-label",
    );
    expect(
      (manualLabel?.semantic as Record<string, unknown>).labelPosition,
    ).toBe(0.2);
    const check = arrangeLayeredOrRoute(io, [...args, "--check"]);
    expect(check.exitCode).toBe(0);
    expect(text).toBe(written);
    const second = arrangeLayeredOrRoute(io, [...args, "--write"]);
    expect(second.exitCode).toBe(0);
    expect(second.stderr).toContain("0 layer update(s)");
    expect(text).toBe(written);
  });
}

test("layered selects a lower-crossing order and remains stable", () => {
  const editor = makeEditor({
    document: document([], [{ ...TEST_PAGE, kind: "state" }]),
  });
  for (const [id, x, members] of [
    ["frame-a", 0, ["a", "b", "c"]],
    ["frame-b", 600, ["x", "y", "z"]],
  ] as const) {
    editor.createElement("frame", {
      id,
      semantic: { name: id, memberIds: [...members] },
      visual: { x, y: 0, width: 500, height: 500 },
    });
  }
  for (const [i, id] of ["a", "b", "c", "x", "y", "z"].entries()) {
    editor.createElement("state.node", {
      id,
      semantic: { kind: "state", name: id },
      visual: {
        x: i < 3 ? 20 : 620,
        y: 30 + (i % 3) * 100,
        width: 80,
        height: 50,
      },
    });
  }
  for (const [i, [from, to]] of [
    ["a", "x"],
    ["a", "y"],
    ["b", "x"],
  ].entries()) {
    editor.createElement("state.transition", {
      id: `edge-${i}`,
      semantic: { from, to },
    });
  }
  const crossings = (memberOrder: "rank" | "barycenter") => {
    const plan = planLayered(editor.store, TEST_PAGE.id, editor.registry, {
      direction: "LR",
      memberOrder,
    });
    if ("error" in plan) throw new Error(plan.error);
    const draft = new Store(editor.getSnapshot());
    applyCommands(draft, plan.commands);
    applyCommands(
      draft,
      planRoute(draft, TEST_PAGE.id, editor.registry, {
        resetManual: true,
        separation: false,
      }),
    );
    return pageMetrics(draft, TEST_PAGE.id, editor.registry).edgeCrossings;
  };
  expect(crossings("barycenter")).toBeLessThan(crossings("rank"));
  let text = serializeDocument(editor.getSnapshot());
  const io = {
    readText: () => text,
    writeText: (_: string, value: string) => {
      text = value;
    },
  };
  const args = ["doc.jsonl", "--mode", "layered"];
  expect(arrangeLayeredOrRoute(io, [...args, "--write"]).exitCode).toBe(0);
  const written = text;
  expect(arrangeLayeredOrRoute(io, [...args, "--check"]).exitCode).toBe(0);
  const again = arrangeLayeredOrRoute(io, [...args, "--write"]);
  expect(again.exitCode).toBe(0);
  expect(again.stderr).toContain("0 layer update(s)");
  expect(text).toBe(written);
});
