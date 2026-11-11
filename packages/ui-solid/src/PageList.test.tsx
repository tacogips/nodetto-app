import { expect, test } from "bun:test";

test("PageList DOM interactions", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--conditions=browser",
      "--config=./test-dom/bunfig.toml",
      "--preload",
      "./test-dom/setup.ts",
      "./test-dom/page-list.dom.tsx",
    ],
    { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" },
  );
  const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
  expect(result.exitCode, output).toBe(0);
  for (const name of [
    "rows",
    "highlight",
    "click",
    "keyboard",
    "fold",
    "read-only",
    "rename",
    "menu",
  ]) {
    expect(output, `Missing ok ${name}:\n${output}`).toContain(`ok ${name}`);
  }
});
