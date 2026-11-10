import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { exportCommand } from "./export-command.ts";
import type { CommandIo } from "./commands.ts";

test("CLI writes standalone prototype HTML and rejects incompatible options", async () => {
  const editor = new Editor();
  const frame = editor.createElement("frame", {
    semantic: { name: "Home", screenKind: "screen" },
    visual: { x: 0, y: 0, width: 200, height: 400 },
  });
  let output = "";
  const io: CommandIo = {
    readText: () => serializeDocument(editor.getSnapshot()),
    writeText: (_path, text) => {
      output = text;
    },
  };
  expect(
    (
      await exportCommand(io, [
        "doc",
        "--format",
        "prototype",
        "--output",
        "app.html",
      ])
    ).exitCode,
  ).toBe(0);
  expect(output.startsWith("<!doctype html>")).toBe(true);
  expect(
    (
      await exportCommand(io, [
        "doc",
        "--format",
        "prototype",
        "--output",
        "app.html",
        "--element",
        frame,
      ])
    ).exitCode,
  ).toBe(1);
  expect(
    (
      await exportCommand(io, [
        "doc",
        "--format",
        "prototype",
        "--output",
        "app.zip",
      ])
    ).exitCode,
  ).toBe(1);
});
