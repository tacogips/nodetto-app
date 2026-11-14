import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { runCli } from "./commands.ts";
import { exportCommand } from "./export-command.ts";
import { Batch } from "./edit/batch.ts";

function fixture() {
  const editor = new Editor();
  const hotspot = editor.createElement("shape.geo", {
    visual: { x: 30, y: 100, width: 40, height: 40 },
  });
  const first = editor.createElement("frame", {
    semantic: {
      name: "First",
      platform: "ios",
      prototypeStart: true,
      prototypeFlowName: "Main",
      memberIds: [hotspot],
    },
    visual: { x: 0, y: 0, width: 200, height: 300 },
  });
  const second = editor.createElement("frame", {
    semantic: { name: "Second", platform: "ios", memberIds: [] },
    visual: { x: 300, y: 0, width: 200, height: 300 },
  });
  const batch = new Batch(editor);
  const link = batch.apply(
    {
      op: "connect",
      shape: "prototype:transition",
      from: hotspot,
      to: second,
      semantic: { prototypeTrigger: "tap" },
    },
    0,
  );
  batch.dispose();
  const io = {
    readText: () => serializeDocument(editor.getSnapshot()),
    writeText: () => {},
  };
  return { editor, first, second, hotspot, io, link };
}

test("prototype CLI export and flow inspection", async () => {
  const { first, second, io } = fixture();
  const svg = await exportCommand(io, [
    "doc.jsonl",
    "--format",
    "svg",
    "--prototype",
  ]);
  expect(svg.exitCode).toBe(0);
  expect(svg.stdout).toContain("#7c3aed");
  const invalid = await exportCommand(io, [
    "doc.jsonl",
    "--format",
    "svg",
    "--prototype",
    "--element",
    first,
  ]);
  expect(invalid.exitCode).toBe(1);
  const text = runCli(["inspect", "doc.jsonl", "--flows"], io, "test");
  expect(text.exitCode).toBe(0);
  expect(text.stdout).toContain('flow "Main"');
  expect(text.stdout.indexOf('"First"')).toBeLessThan(
    text.stdout.lastIndexOf('"Second"'),
  );
  const json = runCli(
    ["inspect", "doc.jsonl", "--flows", "--format", "json"],
    io,
    "test",
  );
  expect(json.exitCode).toBe(0);
  expect(JSON.parse(json.stdout).flows[0].screens).toEqual([first, second]);
  expect(
    runCli(["inspect", "doc.jsonl", "--flow", "unknown"], io, "test").exitCode,
  ).toBe(1);
});

test("connect normalizes tap and creates back links without a destination", () => {
  const { editor, first, second, hotspot } = fixture();
  const link = editor.store
    .listElements()
    .find((element) => element.type === "edge.generic");
  expect(link?.semantic).toMatchObject({ prototypeTrigger: "click" });
  const batch = new Batch(editor);
  try {
    batch.apply(
      { op: "connect", shape: "prototype:back", from: hotspot, ref: "back" },
      0,
    );
    const back = editor.store.get(batch.refs.get("back")!);
    expect(back?.semantic).toMatchObject({
      from: hotspot,
      to: first,
      prototypeAction: "back",
    });
    batch.apply(
      { op: "connect", shape: "prototype:back", from: hotspot, to: second },
      1,
    );
    expect(
      batch.convertWarnings.some((warning) =>
        warning.message.includes("ignores to"),
      ),
    ).toBe(true);
  } finally {
    batch.dispose();
  }
});
