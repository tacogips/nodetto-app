import { expect, test } from "bun:test";
import { COMMAND_HELP } from "./help.ts";

test("style and glyph behavior is discoverable in command help", () => {
  for (const term of [
    "verticalAlign",
    "boxLabelAlign",
    "strokeDashArray",
    "null removes a key",
  ]) {
    expect(COMMAND_HELP.edit).toContain(term);
  }
  expect(COMMAND_HELP.export).toContain("glyph-missing");
  expect(COMMAND_HELP.lint).toContain("glyph-missing");
  expect(COMMAND_HELP.lint).toContain("--font-dir");
});
