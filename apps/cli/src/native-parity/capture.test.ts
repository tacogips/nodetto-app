import { expect } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { binary, cliEntry, nativeTest } from "./harness.ts";

nativeTest(
  "Bun and native capture agree on 2D metadata and native PNG bytes repeat",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-capture-parity-"));
    try {
      const run = (executable: string[], args: string[]) =>
        Bun.spawnSync(
          [...executable, "capture", "panel.jsonl", "--padding", "0", ...args],
          {
            cwd,
            env: { ...process.env, TMPDIR: cwd, TMP: cwd, TEMP: cwd },
          },
        );
      const rustCli = [binary as string];
      const bunCli = [process.execPath, cliEntry];
      const info = (stdout: Uint8Array) =>
        stdout
          .toString()
          .split("\n")
          .filter((line) => /^(path|format|size|page): /.test(line));
      for (const { width, height, args } of [
        { width: 100, height: 100, args: ["--scale", "1.1"] },
        { width: 3000, height: 3296, args: [] },
        { width: 12247, height: 5468, args: [] },
        { width: 19780, height: 14187, args: [] },
      ]) {
        const editor = new Editor();
        editor.createElement("shape.geo", {
          semantic: { geo: "rect", label: "" },
          visual: { x: 0, y: 0, width, height },
        });
        writeFileSync(
          join(cwd, "panel.jsonl"),
          serializeDocument(editor.getSnapshot()),
        );
        const explicit = [...args, "--output", "panel.png", "--force"];
        const bun = run(bunCli, explicit);
        expect(bun.stderr.toString()).toBe("");
        expect(bun.exitCode).toBe(0);
        const native = run(rustCli, explicit);
        expect(native.stderr.toString()).toBe("");
        expect(native.exitCode).toBe(bun.exitCode);
        expect(info(native.stdout)).toEqual(info(bun.stdout));
        const bytes = readFileSync(join(cwd, "panel.png"));
        expect([...bytes.subarray(0, 8)]).toEqual([
          137, 80, 78, 71, 13, 10, 26, 10,
        ]);
        expect(native.stdout.toString()).toContain(
          `size: ${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}\n`,
        );
      }
      const first = run(rustCli, []);
      expect(first.exitCode).toBe(0);
      const path =
        first.stdout.toString().split("\n")[0]?.slice("path: ".length) ?? "";
      expect(isAbsolute(path)).toBe(true);
      expect(basename(dirname(path))).toStartWith("nodetto-capture");
      const bytes = readFileSync(path);
      const repeated = run(rustCli, []);
      expect(repeated.exitCode).toBe(0);
      expect(repeated.stdout.toString()).toBe(first.stdout.toString());
      expect(readFileSync(path)).toEqual(bytes);
      // Render afresh as well, so reuse of a digest file cannot mask a byte change.
      const fresh = run(rustCli, ["--output", "fresh.png"]);
      expect(fresh.exitCode).toBe(0);
      expect(readFileSync(join(cwd, "fresh.png"))).toEqual(bytes);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  10_000,
);

nativeTest(
  "native captures deterministic JPG files while Bun explains the native requirement",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-capture-jpg-"));
    try {
      const editor = new Editor();
      editor.createElement("shape.geo", {
        semantic: { geo: "rect", label: "" },
        visual: { x: 0, y: 0, width: 120, height: 75 },
      });
      writeFileSync(
        join(cwd, "panel.jsonl"),
        serializeDocument(editor.getSnapshot()),
      );
      const run = (executable: string[], output: string) =>
        Bun.spawnSync(
          [
            ...executable,
            "capture",
            "panel.jsonl",
            "--output",
            output,
            "--padding",
            "0",
            "--quality",
            "85",
            "--json",
          ],
          { cwd },
        );
      for (const output of ["first.jpg", "second.jpeg"]) {
        const native = run([binary as string], output);
        expect(native.stderr.toString()).toBe("");
        expect(native.exitCode).toBe(0);
        const path = join(cwd, output);
        const bytes = readFileSync(path);
        expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
        expect([...bytes.subarray(-2)]).toEqual([0xff, 0xd9]);
        const metadata = JSON.parse(native.stdout.toString()) as {
          path: string;
        };
        expect(metadata).toMatchObject({
          format: "jpg",
          width: 120,
          height: 75,
          bytes: bytes.length,
        });
        expect(isAbsolute(metadata.path)).toBe(true);
        expect(realpathSync(metadata.path)).toBe(realpathSync(path));
      }
      expect(readFileSync(join(cwd, "first.jpg"))).toEqual(
        readFileSync(join(cwd, "second.jpeg")),
      );
      const bun = run([process.execPath, cliEntry], "bun.jpg");
      expect(bun.exitCode).toBe(2);
      expect(bun.stderr.toString()).toContain(
        "JPG capture needs the native nodetto-cli.",
      );
      expect(existsSync(join(cwd, "bun.jpg"))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  10_000,
);
