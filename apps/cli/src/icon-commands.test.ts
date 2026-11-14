import { describe, expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { type CommandIo, runCli } from "./commands.ts";

function memoryIo(
  document: string,
  stdin = "",
): CommandIo & { saved(): string } {
  let saved = document;
  return {
    readText: () => saved,
    writeText: (_path, value) => {
      saved = value;
    },
    readStdin: () => stdin,
    saved: () => saved,
  };
}
const run = (args: string[], io: CommandIo = memoryIo("")) =>
  runCli(args, io, "test");

describe("icon CLI", () => {
  test("searches and describes icons", () => {
    const search = run(["shapes", "icon", "bell"]);
    expect(search.exitCode).toBe(0);
    expect(search.stdout.split("\n")[0]).toStartWith("bell\t");
    const empty = run(["shapes", "icon", "zzzz-none"]);
    expect(empty.exitCode).toBe(0);
    expect(empty.stdout).toContain('no icon matches "zzzz-none"');
    expect(empty.stdout).toContain("Search with nodetto-cli shapes icon");
    const nearDescription = run(["shapes", "icon:bel"]);
    expect(nearDescription.exitCode).toBe(2);
    expect(nearDescription.stderr).toContain('unknown icon "bel"');
    expect(nearDescription.stderr).toContain("Did you mean");
    expect(nearDescription.stderr).toContain("bell");
    const missingDescription = run(["shapes", "icon:zzzz-none"]);
    expect(missingDescription.exitCode).toBe(2);
    expect(missingDescription.stderr).toContain('unknown icon "zzzz-none"');
    expect(missingDescription.stderr).toContain(
      "Search with nodetto-cli shapes icon",
    );
    expect(run(["shapes", "icon:bell"]).stdout).toContain("ui.icon");
  });
  test("draws a named icon and rejects an unknown shape", () => {
    const editor = new Editor();
    const io = memoryIo(serializeDocument(editor.getSnapshot()));
    const draw = run(["draw", "doc", "icon:search", "--at", "10,10"], io);
    expect(draw.exitCode).toBe(0);
    expect(parseDocument(io.saved()).elements[0]).toMatchObject({
      type: "ui.icon",
      semantic: { icon: "search" },
      visual: { x: 10, y: 10, width: 24, height: 24 },
    });
    const bad = memoryIo(
      io.saved(),
      JSON.stringify([
        { op: "add", page: editor.currentPageId, shape: "icon:not-an-icon" },
      ]),
    );
    const result = run(["edit", "doc", "--ops", "-"], bad);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('unknown icon "not-an-icon"');
    expect(result.stderr).toContain("Search with nodetto-cli shapes icon");
    const suggestion = memoryIo(
      io.saved(),
      JSON.stringify([
        { op: "add", page: editor.currentPageId, shape: "icon:bel" },
      ]),
    );
    const nearMiss = run(["edit", "doc", "--ops", "-"], suggestion);
    expect(nearMiss.exitCode).toBe(2);
    expect(nearMiss.stderr).toContain("Did you mean");
    expect(nearMiss.stderr).toContain("bell");
  });
  test("warns for unknown icons without invalidating documents", () => {
    const editor = new Editor();
    const id = editor.createElement("ui.icon", { semantic: { icon: "nope" } });
    const doc = serializeDocument(editor.getSnapshot());
    const validate = run(["validate", "doc"], memoryIo(doc));
    expect(validate.exitCode).toBe(0);
    expect(validate.stderr).toContain(
      `warning: ${id} icon.unknown Unknown icon "nope"`,
    );
    const io = memoryIo(
      doc,
      JSON.stringify([{ op: "update", id, semantic: { icon: "nope-again" } }]),
    );
    const edit = run(["edit", "doc", "--ops", "-"], io);
    expect(edit.exitCode).toBe(0);
    expect(edit.stdout).toContain("icon.unknown");
  });
});
