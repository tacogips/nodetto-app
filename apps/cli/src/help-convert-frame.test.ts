import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { COMMAND_HELP } from "./help.ts";

test("conversion, frame scope and rendering are discoverable", () => {
  for (const term of ["convert", "reconnectTo", "cannot carry"])
    expect(COMMAND_HELP.edit).toContain(term);
  for (const term of ["memberIds", "--strict", "exits 3"])
    expect(COMMAND_HELP.ddl).toContain(term);
  expect(COMMAND_HELP.edit).not.toContain("visual and label");
  expect(COMMAND_HELP.edit).toContain("semantic.geo");
  expect(COMMAND_HELP.lint).toContain("frame-straddle");
  expect(COMMAND_HELP.types).toContain("rendering");
  const docs = readFileSync("docs/cli.md", "utf8");
  const readme = readFileSync("README.md", "utf8");
  expect(docs).toContain("semantic.geo");
  expect(docs).toContain(
    "| erd | `node-overlap`, `frame-straddle`, `image-missing` |",
  );
  for (const term of [
    "rendering",
    "stick figure",
    "convert",
    "reconnectTo",
    "memberIds",
  ])
    expect(docs).toContain(term);
  for (const term of ["convert", "reconnectTo", "memberIds"])
    expect(readme).toContain(term);
});
