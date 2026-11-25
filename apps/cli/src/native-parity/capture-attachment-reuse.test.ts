import { expect } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { binary, nativeTest } from "./harness.ts";

nativeTest(
  "native capture matches shared and distinct attachments in PNG and JPG",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-reuse-"));
    try {
      mkdirSync(join(cwd, "artifacts"));
      const bytes = readFileSync("apps/desktop/src-tauri/icons/32x32.png");
      for (const name of ["a", "b1", "b2", "b3"])
        writeFileSync(join(cwd, `artifacts/${name}.png`), bytes);
      for (const kind of ["a", "b"]) {
        const editor = new Editor();
        for (let i = 0; i < 3; i++)
          editor.createElement("image.raster", {
            semantic: {
              src: `artifacts/${kind === "a" ? "a" : `b${i + 1}`}.png`,
              alt: "image",
            },
            visual: { x: i * 30, y: 0, width: 25, height: 20 },
          });
        writeFileSync(
          join(cwd, `${kind}.jsonl`),
          serializeDocument(editor.getSnapshot()),
        );
        for (const format of ["png", "jpg"]) {
          const result = Bun.spawnSync(
            [
              binary as string,
              "capture",
              `${kind}.jsonl`,
              "--padding",
              "0",
              "--output",
              `${kind}.${format}`,
            ],
            { cwd },
          );
          expect(result.stderr.toString()).toBe("");
          expect(result.exitCode).toBe(0);
        }
      }
      for (const format of ["png", "jpg"])
        expect(readFileSync(join(cwd, `a.${format}`))).toEqual(
          readFileSync(join(cwd, `b.${format}`)),
        );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30000,
);
