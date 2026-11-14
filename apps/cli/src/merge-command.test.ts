import { expect, test } from "bun:test";
import type { Document } from "@nodetto/ir";
import { serializeDocument, parseDocumentResult } from "@nodetto/io";
import { mergeCommand } from "./merge-command.ts";
const doc = (title: string): Document => ({
  schemaVersion: 1,
  id: "d",
  title,
  pages: [{ id: "p", name: "Page", kind: "freeform" }],
  elements: [],
});
function fixture() {
  const files = new Map([
    ["base", serializeDocument(doc("Base"))],
    ["ours", serializeDocument(doc("Ours"))],
    ["theirs", serializeDocument(doc("Theirs"))],
  ]);
  return {
    files,
    io: {
      readText(path: string) {
        const v = files.get(path);
        if (v === undefined) throw Error("missing");
        return v;
      },
      writeText(path: string, text: string) {
        files.set(path, text);
      },
    },
  };
}
test("conflicts write ours even when output is the input path", () => {
  const { files, io } = fixture();
  const result = mergeCommand(io, [
    "base",
    "ours",
    "theirs",
    "--output",
    "ours",
  ]);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain(
    'conflict: document d title: base "Base" | ours "Ours" | theirs "Theirs" (kept ours)',
  );
  const parsed = parseDocumentResult(files.get("ours") ?? "");
  expect(parsed.ok && parsed.document.title).toBe("Ours");
});
test("clean merge emits canonical stdout; errors do not write", () => {
  const { files, io } = fixture();
  files.set("theirs", files.get("base") ?? "");
  expect(mergeCommand(io, ["base", "ours", "theirs"]).stdout).toBe(
    files.get("ours") ?? "",
  );
  expect(mergeCommand(io, ["base"]).exitCode).toBe(2);
  files.set("theirs", "bad");
  const before = files.get("ours");
  const invalid = mergeCommand(io, [
    "base",
    "ours",
    "theirs",
    "--output",
    "ours",
  ]);
  expect(invalid.exitCode).toBe(2);
  expect(invalid.stderr).toContain("theirs");
  expect(files.get("ours")).toBe(before);
  files.set("theirs", serializeDocument({ ...doc("Other"), id: "other" }));
  expect(mergeCommand(io, ["base", "ours", "theirs"]).exitCode).toBe(2);
});
test("invalid combined crop writes nothing", () => {
  const image = (x: number, width: number): Document => ({
    ...doc("Base"),
    elements: [
      {
        id: "image",
        page: "p",
        type: "image.raster",
        index: "a0",
        semantic: {
          src: "assets/p.png",
          alt: "",
          crop: { x, y: 0, width, height: 0.5 },
        },
        visual: { x: 0, y: 0, width: 20, height: 20 },
      },
    ],
  });
  const { files, io } = fixture();
  files.set("base", serializeDocument(image(0, 0.5)));
  files.set("ours", serializeDocument(image(0.4, 0.5)));
  files.set("theirs", serializeDocument(image(0, 0.8)));
  const before = files.get("ours");
  const result = mergeCommand(io, [
    "base",
    "ours",
    "theirs",
    "--output",
    "ours",
  ]);
  expect(result.exitCode).toBe(2);
  expect(result.stdout).toBe("");
  expect(files.get("ours")).toBe(before);
});
