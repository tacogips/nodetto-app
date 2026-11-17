import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { runCliAsync } from "./cli.ts";
import { localIo } from "./local-io.ts";

const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 4, 2]);

async function withDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "nodetto-bundle-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const cli = (args: string[]) => runCliAsync(args, localIo(), "test");

test("bundle pack and unpack round-trip a document with its images", () =>
  withDir(async (dir) => {
    const editor = new Editor();
    editor.createElement("image.raster", {
      semantic: { src: "artifacts/logo.png", alt: "Logo" },
    });
    const text = serializeDocument(editor.getSnapshot());
    await mkdir(join(dir, "src/artifacts"), { recursive: true });
    await writeFile(join(dir, "src/design.jsonl"), text);
    await writeFile(join(dir, "src/artifacts/logo.png"), PNG);

    const bundle = join(dir, "design.nodetto");
    const packed = await cli([
      "bundle",
      "pack",
      join(dir, "src/design.jsonl"),
      "--output",
      bundle,
    ]);
    expect(packed.stderr).toContain("with 1 attachment.");
    expect(packed.exitCode).toBe(0);

    const target = join(dir, "repo/docs/design.jsonl");
    const unpacked = await cli([
      "bundle",
      "unpack",
      bundle,
      "--output",
      target,
    ]);
    expect(unpacked.exitCode).toBe(0);
    expect(await readFile(target, "utf8")).toBe(text);
    expect(
      new Uint8Array(await readFile(join(dir, "repo/docs/artifacts/logo.png"))),
    ).toEqual(PNG);

    // Unpacking the same bundle again is a no-op, not a conflict.
    expect(
      (await cli(["bundle", "unpack", bundle, "--output", target])).exitCode,
    ).toBe(0);

    // A different existing image is never clobbered without --force.
    await writeFile(join(dir, "repo/docs/artifacts/logo.png"), "changed");
    await writeFile(target, "local edit");
    const refused = await cli(["bundle", "unpack", bundle, "--output", target]);
    expect(refused.exitCode).toBe(2);
    expect(refused.stderr).toContain("Refusing to overwrite");
    expect(await readFile(target, "utf8")).toBe("local edit");

    const forced = await cli([
      "bundle",
      "unpack",
      bundle,
      "--output",
      target,
      "--force",
    ]);
    expect(forced.exitCode).toBe(0);
    expect(await readFile(target, "utf8")).toBe(text);
  }));

test("bundle pack fails on a missing attachment", () =>
  withDir(async (dir) => {
    const editor = new Editor();
    editor.createElement("image.raster", {
      semantic: { src: "artifacts/gone.png", alt: "Gone" },
    });
    await writeFile(
      join(dir, "design.jsonl"),
      serializeDocument(editor.getSnapshot()),
    );
    const result = await cli([
      "bundle",
      "pack",
      join(dir, "design.jsonl"),
      "--output",
      join(dir, "design.nodetto"),
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Missing attachment: artifacts/gone.png");
  }));
