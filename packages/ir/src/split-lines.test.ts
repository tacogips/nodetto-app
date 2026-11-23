import { expect, test } from "bun:test";
import { splitLines } from "./split-lines.ts";

test("splitLines matches split on documents of every boundary shape", () => {
  const long = "x".repeat(40_000);
  const cases = [
    "",
    "\n",
    "one",
    "one\ntwo\n",
    `${long}\n${long}`,
    `${"ab\n".repeat(20_000)}tail`,
    `${"a".repeat(16_383)}\n${"b".repeat(16_384)}\n\n`,
    `${"a".repeat(16_383)}\u{1F600}\n${"\r\n".repeat(9_000)}`,
    "\n".repeat(50_000),
  ];
  for (const text of cases) expect(splitLines(text)).toEqual(text.split("\n"));
});
