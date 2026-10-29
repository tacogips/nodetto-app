import { describe, expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { type CommandIo, runCli } from "./commands.ts";

function memoryIo(
  document: string,
  ops: unknown,
): CommandIo & {
  readonly saved: () => string;
} {
  let saved = document;
  return {
    readText: () => saved,
    writeText: (_path, value) => {
      saved = value;
    },
    readStdin: () => JSON.stringify(ops),
    saved: () => saved,
  };
}

function diagram() {
  const editor = new Editor();
  const gateway = editor.createElement("shape.geo", {
    semantic: { geo: "rect", label: "gw.example.dev" },
    visual: { x: 0, y: 0, width: 100, height: 40 },
  });
  const cache = editor.createElement("text.note", {
    semantic: { text: "Caches *.example.dev" },
    visual: { x: 200, y: 100, width: 120, height: 40 },
  });
  return { text: serializeDocument(editor.getSnapshot()), gateway, cache };
}

const edit = (io: CommandIo, ...extra: string[]) =>
  runCli(["edit", "doc.jsonl", "--ops", "-", ...extra], io, "t");

describe("edit scale, replace-text, group and ungroup", () => {
  test("scale enlarges a whole page and keeps its layout", () => {
    const { text, gateway, cache } = diagram();
    const io = memoryIo(text, [{ op: "scale", factor: 1.25 }]);
    expect(edit(io).exitCode).toBe(0);
    const byId = new Map(
      parseDocument(io.saved()).elements.map((element) => [
        element.id,
        element,
      ]),
    );
    expect(byId.get(gateway)?.visual).toMatchObject({
      x: 0,
      y: 0,
      width: 125,
      height: 50,
      style: { fontSize: 16.25 },
    });
    expect(byId.get(cache)?.visual).toMatchObject({
      x: 250,
      y: 125,
      width: 150,
      height: 50,
    });
  });

  test("replace-text previews with --dry-run and then rewrites part of the text", () => {
    const { text, gateway, cache } = diagram();
    const ops = [
      { op: "replace-text", find: "example.dev", replace: "example.info" },
    ];
    const preview = memoryIo(text, ops);
    const report = JSON.parse(
      edit(preview, "--dry-run", "--format", "json").stdout,
    ) as { written: boolean; replaced: { id: string; after: string }[] };
    expect(report.written).toBe(false);
    expect(report.replaced.map((item) => [item.id, item.after])).toEqual(
      expect.arrayContaining([
        [gateway, "gw.example.info"],
        [cache, "Caches *.example.info"],
      ]),
    );
    expect(preview.saved()).toBe(text);

    const io = memoryIo(text, ops);
    expect(edit(io).stdout).toContain('-> "gw.example.info"');
    const found = runCli(
      ["inspect", "doc.jsonl", "--text", "example.info", "--format", "json"],
      io,
      "t",
    );
    const pages = JSON.parse(found.stdout).pages as {
      elements: { id: string }[];
    }[];
    expect(pages[0]?.elements.map((element) => element.id).sort()).toEqual(
      [gateway, cache].sort(),
    );
    const none = runCli(
      ["inspect", "doc.jsonl", "--text", "example.dev", "--format", "json"],
      io,
      "t",
    );
    expect(JSON.parse(none.stdout).pages[0].elements).toEqual([]);
    const bad = memoryIo(text, [
      { op: "replace-text", find: "(", replace: "", regex: true },
    ]);
    expect(edit(bad).stderr).toContain("invalid regular expression");
  });

  test("group wraps elements under a name and ungroup dissolves it", () => {
    const { text, gateway, cache } = diagram();
    const io = memoryIo(text, [
      { op: "group", ids: [gateway, cache], ref: "edge", name: "Edge tier" },
    ]);
    const grouped = JSON.parse(edit(io, "--format", "json").stdout) as {
      created: { id: string; type: string }[];
    };
    const groupId = grouped.created[0]?.id as string;
    const group = parseDocument(io.saved()).elements.find(
      (element) => element.id === groupId,
    );
    expect(group).toMatchObject({
      type: "group",
      semantic: { memberIds: [gateway, cache] },
      visual: { layerName: "Edge tier" },
    });
    const ungroup = memoryIo(io.saved(), [{ op: "ungroup", id: groupId }]);
    expect(edit(ungroup).exitCode).toBe(0);
    expect(
      parseDocument(ungroup.saved()).elements.map((element) => element.type),
    ).not.toContain("group");
    const notGroup = memoryIo(text, [{ op: "ungroup", id: gateway }]);
    expect(edit(notGroup).stderr).toContain("not a group");
    const single = memoryIo(text, [{ op: "group", ids: [gateway] }]);
    expect(edit(single).stderr).toContain("two or more");
  });
});
