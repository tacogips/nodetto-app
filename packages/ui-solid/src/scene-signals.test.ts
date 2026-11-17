import { expect, test } from "bun:test";

test("scene signals re-run only what a change can affect", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--conditions=browser",
      "--config=./test-dom/bunfig.toml",
      "./test-dom/scene-signals.dom.ts",
    ],
    { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" },
  );
  const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
  expect(result.exitCode, output).toBe(0);
  for (const name of [
    "record",
    "obstacles",
    "history",
    "structure",
    "coarse",
    "culling",
  ])
    expect(output, `Missing ok ${name}:\n${output}`).toContain(`ok ${name}`);
});
