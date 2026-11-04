import { expect, test } from "bun:test";
import { serializeDocument, parseDocument } from "@nodetto/io";
import type { PageKind } from "@nodetto/ir";
import {
  document,
  makeEditor,
  TEST_PAGE,
} from "../../../packages/core/src/test-helpers.ts";
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

test("route accepts ERD and BPMN; layered excludes BPMN and both exclude sequence", () => {
  for (const kind of ["erd", "bpmn"] as const)
    expect(run(fixture(kind), "--mode", "route").exitCode).toBe(0);
  const bpmn = run(fixture("bpmn"), "--mode", "layered");
  expect(bpmn.exitCode).toBe(2);
  expect(bpmn.stderr).toContain("supports page kinds");
  for (const mode of ["layered", "route"])
    expect(run(fixture("sequence"), "--mode", mode).exitCode).toBe(2);
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
