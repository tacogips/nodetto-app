import { expect, test } from "bun:test";

test("inline text editing closes across document and page transitions", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--conditions=browser",
      "--config=./test-dom/bunfig.toml",
      "--preload",
      "./test-dom/setup.ts",
      "./test-dom/text-editor.dom.tsx",
    ],
    { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" },
  );
  expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
});
