import { expect, test } from "bun:test";
import { Editor, Tool } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { runCli, type CommandIo } from "./commands.ts";

function cadDocument() {
  const editor = new Editor();
  const cad = editor.createPage({ name: "Bracket", kind: "cad3d" });
  editor.createElement("cad.sketch");
  return { cad, document: editor.getSnapshot() };
}

test.each(["ios:list-row", Tool.Actor])(
  "CLI add rejects the %s emitter on a CAD page",
  (shape) => {
    const { cad, document } = cadDocument();
    const io: CommandIo = {
      readText: () => serializeDocument(document),
      readStdin: () => JSON.stringify([{ op: "add", shape, page: cad }]),
      writeText: () => {
        throw new Error("Rejected edits must not write");
      },
    };
    const result = runCli(["edit", "part.jsonl", "--ops", "-"], io, "test");
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("page.contentKind");
  },
);

test("Gerber --into adds a freeform page alongside the CAD page", () => {
  const { cad, document } = cadDocument();
  const gerber = [
    "%FSLAX24Y24*%",
    "%MOMM*%",
    "%ADD10C,1.2*%",
    "D10*",
    "X10000Y20000D03*",
    "M02*",
  ].join("\n");
  let written = "";
  const io: CommandIo = {
    readText: (path) =>
      path === "part.jsonl" ? serializeDocument(document) : gerber,
    writeText: (_path, contents) => {
      written = contents;
    },
  };
  const result = runCli(
    ["gerber", "import", "--into", "part.jsonl", "mark.gtl"],
    io,
    "test",
  );
  expect(result.exitCode).toBe(0);
  const imported = parseDocument(written);
  const board = imported.pages.at(-1);
  expect(board).toMatchObject({ name: "mark", kind: "freeform" });
  expect(imported.elements.filter(({ page }) => page === cad)).toEqual([
    ...document.elements,
  ]);
  expect(imported.elements.some(({ page }) => page === board?.id)).toBe(true);
});
