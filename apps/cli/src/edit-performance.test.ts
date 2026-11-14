import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  obstacleRoutingBatch,
  obstacleRoutingMixedMultiPage,
  obstacleRoutingMultiPage,
} from "./__fixtures__/obstacle-routing-batch.ts";
import { runCli } from "./commands.ts";

test("obstacle routing batch preserves expected output within deadline", () => {
  const fixture = obstacleRoutingBatch();
  const files = new Map([
    ["doc.jsonl", fixture.document],
    ["ops.json", fixture.operations],
  ]);
  const start = performance.now();
  const result = runCli(
    ["edit", "doc.jsonl", "--ops", "ops.json"],
    {
      readText(path) {
        const text = files.get(path);
        if (text === undefined) throw new Error("ENOENT");
        return text;
      },
      writeText(path, text) {
        files.set(path, text);
      },
    },
    "test",
  );
  expect(result.exitCode).toBe(0);
  expect(files.get("doc.jsonl")).toBe(
    readFileSync(
      new URL(
        "./__fixtures__/obstacle-routing-batch.expected.jsonl",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  expect(performance.now() - start).toBeLessThan(10000);
}, 120000);

for (const [name, build] of [
  ["multi-page", obstacleRoutingMultiPage],
  ["mixed-multi-page", obstacleRoutingMixedMultiPage],
] as const) {
  test(`${name} obstacle routing preserves expected output within deadline`, () => {
    const fixture = build();
    const files = new Map([
      ["doc.jsonl", fixture.document],
      ["ops.json", fixture.operations],
    ]);
    const start = performance.now();
    const result = runCli(
      ["edit", "doc.jsonl", "--ops", "ops.json"],
      {
        readText(path) {
          const text = files.get(path);
          if (text === undefined) throw new Error("ENOENT");
          return text;
        },
        writeText(path, text) {
          files.set(path, text);
        },
      },
      "test",
    );
    expect(result.exitCode).toBe(0);
    expect(files.get("doc.jsonl")).toBe(
      readFileSync(
        new URL(
          `./__fixtures__/obstacle-routing-batch.${name}.expected.jsonl`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(performance.now() - start).toBeLessThan(10000);
  }, 120000);
}
