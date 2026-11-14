import { expect, test } from "bun:test";
import { join } from "node:path";

export const binary = process.env.NODETTO_CLI_TEST_BINARY;
export const cliSrcDir = join(import.meta.dir, "..");
export const cliEntry = join(cliSrcDir, "main.ts");
export const fixtureRoot = join(
  cliSrcDir,
  "../../../packages/io/src/__fixtures__",
);
export const nativeTest = binary ? test : test.skip;

export function compare(args: string[], cwd?: string, stdin?: string) {
  const expected = Bun.spawnSync([process.execPath, cliEntry, ...args], {
    cwd,
    stdin: stdin === undefined ? undefined : new TextEncoder().encode(stdin),
  });
  // biome-ignore lint/style/noNonNullAssertion: nativeTest runs only when the binary is set.
  const actual = Bun.spawnSync([binary!, ...args], {
    cwd,
    stdin: stdin === undefined ? undefined : new TextEncoder().encode(stdin),
  });
  expect(actual.exitCode).toBe(expected.exitCode);
  expect(actual.stdout.toString()).toBe(expected.stdout.toString());
  expect(actual.stderr.toString()).toBe(expected.stderr.toString());
  return actual;
}
