import { expect, test } from "bun:test";

test("CAD viewport mounts, evaluates, selects, and fails safely in light and dark", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--conditions=browser",
      "--config=./test-dom/bunfig.toml",
      "--preload",
      "./test-dom/setup.ts",
      "./test-dom/cad-viewport.dom.tsx",
    ],
    { cwd: `${import.meta.dir}/..`, stdout: "pipe", stderr: "pipe" },
  );
  const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
  expect(result.exitCode, output).toBe(0);
  expect(output).toContain("ok light");
  expect(output).toContain("ok dark");
});
