import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fixtures = join(import.meta.dir, "__fixtures__/sequence-golden");
for (const [input, expected] of [
  [
    join(
      import.meta.dir,
      "../../../packages/io/src/__fixtures__/sequence.jsonl",
    ),
    "io-sequence.expected.svg",
  ],
  [join(fixtures, "omitted-geometry.jsonl"), "omitted-geometry.expected.svg"],
]) {
  test(`baseline SVG bytes: ${expected}`, () => {
    const result = Bun.spawnSync([
      process.execPath,
      join(import.meta.dir, "main.ts"),
      "export",
      input,
      "--format",
      "svg",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toEqual(readFileSync(join(fixtures, expected)));
  });
}
