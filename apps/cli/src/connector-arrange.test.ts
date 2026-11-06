import { expect, test } from "bun:test";
import { Editor, pageMetrics } from "@nodetto/core";
import { parseDocument } from "@nodetto/io";
import { arrangeLayeredOrRoute } from "./arrange-modes.ts";
import { connectorArrangeDocument } from "./__fixtures__/connector-arrange.ts";

test("layered and route fixture metrics and repeatability", () => {
  let text = connectorArrangeDocument();
  const io = {
    readText: () => text,
    writeText: (_path: string, value: string) => {
      text = value;
    },
  };
  const measure = () => {
    const editor = new Editor({ document: parseDocument(text) });
    const page = editor
      .getSnapshot()
      .pages.find((item) => item.name === "States");
    if (!page) throw new Error("Missing States page");
    return pageMetrics(editor.store, page.id, editor.registry);
  };
  const before = measure();
  const check = arrangeLayeredOrRoute(io, [
    "fixture.jsonl",
    "--page",
    "States",
    "--mode",
    "layered",
    "--check",
  ]);
  expect(check.exitCode).toBe(1);
  expect(check.stderr).not.toContain("Moved ");
  const layered = arrangeLayeredOrRoute(io, [
    "fixture.jsonl",
    "--page",
    "States",
    "--mode",
    "layered",
    "--write",
  ]);
  expect(layered.exitCode).toBe(0);
  expect(layered.stderr).toContain("Moved ");
  const route = arrangeLayeredOrRoute(io, [
    "fixture.jsonl",
    "--page",
    "States",
    "--mode",
    "route",
    "--write",
  ]);
  expect(route.exitCode).toBe(0);
  const after = measure();
  console.log("fixture metrics", JSON.stringify({ before, after }));
  expect(after.edgeCrossings).toBeLessThanOrEqual(before.edgeCrossings);
  expect(after.segmentOverlaps).toBe(0);
  expect(after.labelOverlaps).toBe(0);
  expect(route.stderr).toContain("0 layer update(s)");
  expect(
    arrangeLayeredOrRoute(io, [
      "fixture.jsonl",
      "--page",
      "States",
      "--mode",
      "layered",
      "--check",
    ]).exitCode,
  ).toBe(0);
});
