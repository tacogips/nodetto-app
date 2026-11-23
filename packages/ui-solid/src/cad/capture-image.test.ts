import { expect, test } from "bun:test";
test("CAD image controls work in light and dark modes", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--conditions=browser",
      "--config=./test-dom/bunfig.toml",
      "--preload",
      "./test-dom/setup.ts",
      "./test-dom/cad-image.dom.tsx",
    ],
    { cwd: `${import.meta.dir}/..`, stdout: "pipe", stderr: "pipe" },
  );
  const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
  expect(result.exitCode, output).toBe(0);
  expect(output).toContain("ok light");
  expect(output).toContain("ok dark");
  expect(output).toContain("ok artwork jpg");
});
