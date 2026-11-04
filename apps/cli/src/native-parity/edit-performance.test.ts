import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { obstacleRoutingBatch } from "../__fixtures__/obstacle-routing-batch.ts";
import { binary, cliEntry, nativeTest } from "./harness.ts";

nativeTest(
  "native obstacle routing batch matches Bun and expected output",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-routing-"));
    try {
      const fixture = obstacleRoutingBatch();
      const doc = join(dir, "doc.jsonl");
      const ops = join(dir, "ops.json");
      writeFileSync(doc, fixture.document);
      writeFileSync(ops, fixture.operations);
      const args = ["edit", doc, "--ops", ops];
      const bun = Bun.spawnSync([process.execPath, cliEntry, ...args], {
        timeout: 60000,
      });
      const expected = readFileSync(doc, "utf8");
      writeFileSync(doc, fixture.document);
      const start = performance.now();
      const native = Bun.spawnSync([binary as string, ...args], {
        timeout: 60000,
      });
      const elapsed = performance.now() - start;
      expect(native.exitCode).toBe(0);
      expect(bun.exitCode).toBe(0);
      expect(native.stdout.toString()).toBe(bun.stdout.toString());
      expect(native.stderr.toString()).toBe(bun.stderr.toString());
      expect(readFileSync(doc, "utf8")).toBe(expected);
      expect(expected).toBe(
        readFileSync(
          new URL(
            "../__fixtures__/obstacle-routing-batch.expected.jsonl",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      expect(elapsed).toBeLessThan(10000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  120000,
);
