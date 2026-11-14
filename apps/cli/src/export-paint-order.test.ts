import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serializeDocument } from "@nodetto/io";
import { document, element } from "../../../packages/core/src/test-helpers.ts";

test("late filled frame exports beneath its enclosed node", () => {
  const root = mkdtempSync(join(tmpdir(), "nodetto-paint-"));
  try {
    const node = element({
      id: "node",
      type: "shape.geo",
      semantic: { geo: "rect" },
      visual: {
        x: 20,
        y: 20,
        width: 40,
        height: 40,
        style: { fill: "#336699" },
      },
    });
    const frame = element({
      id: "frame",
      type: "frame",
      semantic: { name: "Frame" },
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const fixtures = [[node, frame], [frame, node], [frame]];
    for (const [i, entries] of fixtures.entries()) {
      writeFileSync(
        join(root, `${i}.jsonl`),
        serializeDocument(
          document(
            entries.map((entry, index) => ({
              ...entry,
              index: `a${index + 1}`,
            })),
          ),
        ),
      );
    }
    const run = (i: number, format: string) => {
      const output = join(root, `${i}.${format}`);
      const result = Bun.spawnSync([
        process.execPath,
        join(import.meta.dir, "main.ts"),
        "export",
        join(root, `${i}.jsonl`),
        "--format",
        format,
        "--output",
        output,
      ]);
      expect(result.exitCode).toBe(0);
      return readFileSync(output);
    };
    const svg = run(0, "svg");
    expect(svg.equals(run(1, "svg"))).toBe(true);
    expect(svg.toString()).toContain('data-id="node"');
    const png = run(0, "png");
    expect(png.equals(run(1, "png"))).toBe(true);
    expect(png.equals(run(2, "png"))).toBe(false);
    expect(run(0, "pdf").subarray(0, 4).toString()).toBe("%PDF");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
