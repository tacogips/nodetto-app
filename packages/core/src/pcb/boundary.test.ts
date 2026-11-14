import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Modules tests and their support files may use besides this folder. */
const TEST_ONLY = new Set([
  "bun:test",
  "node:fs",
  "node:path",
  "gerber-parser",
]);

test("the pcb folder imports only itself, so it can become a package", () => {
  const violations: string[] = [];
  for (const name of readdirSync(import.meta.dir)) {
    if (!name.endsWith(".ts")) continue;
    const source = readFileSync(join(import.meta.dir, name), "utf8");
    const testOnly = /\.test(-support)?\.ts$/.test(name);
    for (const match of source.matchAll(
      /(?:^|\n)\s*(?:import|export)[^;]*?\sfrom\s+"(?<specifier>[^"]+)"/g,
    )) {
      const specifier = match.groups?.specifier ?? "";
      const local = /^\.\/[A-Za-z0-9.-]+\.ts$/.test(specifier);
      if (local || (testOnly && TEST_ONLY.has(specifier))) continue;
      violations.push(`${name}: ${specifier}`);
    }
  }
  expect(violations).toEqual([]);
});

test("the public entry does not expose test support", () => {
  const index = readFileSync(join(import.meta.dir, "index.ts"), "utf8");
  expect(index).not.toContain("validate.ts");
  expect(index).not.toContain("test-support");
});
