import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./commands.ts";
import { denseRelationsDocument } from "./__fixtures__/dense-relations.ts";

const binary = process.env.NODETTO_CLI_TEST_BINARY;
for (const avoidance of [undefined, true, false]) {
  test(`dense multipage inspect stays deterministic (avoidance=${avoidance})`, () => {
    const source = denseRelationsDocument(200, 11, avoidance, true);
    const io = { readText: () => source, writeText: () => {} };
    const inspect = runCli(["inspect", "dense.jsonl"], io, "test");
    expect(inspect.exitCode).toBe(0);
    expect(inspect.stdout.match(/erd.relation/g)?.length).toBe(200);
    const isolated = runCli(
      ["inspect", "dense.jsonl", "--page", "page-10"],
      io,
      "test",
    );
    expect(isolated.exitCode).toBe(0);
    expect(isolated.stdout).not.toContain("erd.relation");
  });
  (binary ? test : test.skip)(
    `native dense inspection and export (avoidance=${avoidance})`,
    () => {
      const directory = mkdtempSync(join(tmpdir(), "nodetto-dense-"));
      try {
        const source = denseRelationsDocument(200, 11, avoidance, true);
        const path = join(directory, "dense.jsonl");
        writeFileSync(path, source);
        for (const args of [
          ["inspect", path],
          ["inspect", path, "--page", "page-10"],
          [
            "export",
            path,
            "--page",
            "Page 0",
            "--format",
            "svg",
            "--output",
            join(directory, "dense.svg"),
          ],
          [
            "export",
            path,
            "--page",
            "page-10",
            "--format",
            "svg",
            "--output",
            join(directory, "isolated.svg"),
          ],
        ]) {
          // The initial page has a generated ID; obtain it from its JSONL record.
          if (args.includes("Page 0"))
            args[args.indexOf("Page 0")] = JSON.parse(
              source
                .split("\n")
                .find((line) => JSON.parse(line || "null")?.kind === "page")!,
            ).id;
          const result = Bun.spawnSync([binary!, ...args], { timeout: 60000 });
          expect(result.stderr.toString()).not.toContain("panicked");
          expect(
            result.exitCode,
            `${args.join(" ")}\n${result.stderr.toString()}`,
          ).toBe(0);
          if (args[0] === "inspect")
            expect(result.stdout.toString()).toBe(
              runCli(
                args,
                { readText: () => source, writeText: () => {} },
                "test",
              ).stdout,
            );
        }
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
    240000,
  );
}
