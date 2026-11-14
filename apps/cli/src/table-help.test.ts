import { expect, test } from "bun:test";
import { join } from "node:path";

// A shared test run loads commands.ts first and hides import cycles, so load
// help.ts first in a fresh process, as a test file that imports it alone does.
test("help.ts loads first without an import cycle through commands.ts", () => {
  const help = join(import.meta.dir, "help.ts");
  const result = Bun.spawnSync([
    process.execPath,
    "-e",
    `const help = await import(${JSON.stringify(help)}); if (!help.COMMAND_HELP.table) process.exit(3);`,
  ]);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
