import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localIo } from "./local-io.ts";
test("ensureDir creates parents idempotently and rejects files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nodetto-mkdir-"));
  try {
    const ensure = localIo().ensureDir!;
    await ensure(join(dir, "a/b/c"));
    await ensure(join(dir, "a/b/c"));
    await writeFile(join(dir, "file"), "x");
    await expect(ensure(join(dir, "file"))).rejects.toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
