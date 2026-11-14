import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { binary, cliEntry, cliSrcDir, nativeTest } from "./harness.ts";

nativeTest(
  "native CLI writes the same breadboard PCB archive as the TypeScript CLI",
  () => {
    const example = join(
      cliSrcDir,
      "../../../examples/breadboard/led-button.jsonl",
    );
    for (const extra of [[], ["--outline", "used"]]) {
      const expectedDir = mkdtempSync(join(tmpdir(), "nodetto-pcb-ts-"));
      const actualDir = mkdtempSync(join(tmpdir(), "nodetto-pcb-native-"));
      try {
        const args = [
          "breadboard",
          "gerber",
          example,
          "--output",
          "led-button.zip",
          ...extra,
        ];
        const expected = Bun.spawnSync([process.execPath, cliEntry, ...args], {
          cwd: expectedDir,
        });
        const actual = Bun.spawnSync([binary!, ...args], { cwd: actualDir });
        expect(actual.exitCode).toBe(0);
        expect(actual.exitCode).toBe(expected.exitCode);
        expect(actual.stdout.toString()).toBe(expected.stdout.toString());
        expect(actual.stderr.toString()).toBe(expected.stderr.toString());
        expect(readFileSync(join(actualDir, "led-button.zip"))).toEqual(
          readFileSync(join(expectedDir, "led-button.zip")),
        );
      } finally {
        rmSync(expectedDir, { recursive: true, force: true });
        rmSync(actualDir, { recursive: true, force: true });
      }
    }
  },
  60000,
);

nativeTest(
  "native pcb import and gerber match the TypeScript CLI",
  () => {
    const fixture = join(
      cliSrcDir,
      "../../../test-fixtures/kicad/two-layer.kicad_pcb",
    );
    const expectedDir = mkdtempSync(join(tmpdir(), "nodetto-pcb-ts-"));
    const actualDir = mkdtempSync(join(tmpdir(), "nodetto-pcb-native-"));
    try {
      const both = (args: string[]) => {
        const expected = Bun.spawnSync([process.execPath, cliEntry, ...args], {
          cwd: expectedDir,
        });
        const actual = Bun.spawnSync([binary!, ...args], { cwd: actualDir });
        expect(actual.exitCode).toBe(0);
        expect(actual.exitCode).toBe(expected.exitCode);
        expect(actual.stdout.toString()).toBe(expected.stdout.toString());
        expect(actual.stderr.toString()).toBe(expected.stderr.toString());
        return expected.stdout.toString();
      };
      both(["pcb", "import", fixture, "--output", "board.jsonl"]);
      both(["pcb", "gerber", "board.jsonl", "--output", "board.zip"]);
      const svg = both(["export", "board.jsonl", "--format", "svg"]);
      expect(svg).toContain('data-layer="pcb-board"');
      expect(readFileSync(join(actualDir, "board.jsonl"), "utf8")).toBe(
        readFileSync(join(expectedDir, "board.jsonl"), "utf8"),
      );
      expect(readFileSync(join(actualDir, "board.zip"))).toEqual(
        readFileSync(join(expectedDir, "board.zip")),
      );
    } finally {
      rmSync(expectedDir, { recursive: true, force: true });
      rmSync(actualDir, { recursive: true, force: true });
    }
  },
  120000,
);

nativeTest(
  "native gerber import matches the TypeScript CLI for files, a ZIP and --into",
  () => {
    const example = join(cliSrcDir, "../../../examples/breadboard");
    const layers = ["GTL", "GBL", "GTS", "GBS", "GTO", "GKO", "DRL"].map(
      (extension) => join(example, `led-button.${extension}`),
    );
    const expectedDir = mkdtempSync(join(tmpdir(), "nodetto-gerber-ts-"));
    const actualDir = mkdtempSync(join(tmpdir(), "nodetto-gerber-native-"));
    try {
      const both = (args: string[]) => {
        const expected = Bun.spawnSync([process.execPath, cliEntry, ...args], {
          cwd: expectedDir,
        });
        const actual = Bun.spawnSync([binary!, ...args], { cwd: actualDir });
        expect(actual.exitCode).toBe(0);
        expect(actual.exitCode).toBe(expected.exitCode);
        expect(actual.stdout.toString()).toBe(expected.stdout.toString());
        expect(actual.stderr.toString()).toBe(expected.stderr.toString());
      };
      both([
        "breadboard",
        "gerber",
        join(example, "led-button.jsonl"),
        "--output",
        "board.zip",
      ]);
      both(["gerber", "import", ...layers]);
      both(["gerber", "import", "board.zip", "--output", "pcb.jsonl"]);
      both([
        "gerber",
        "import",
        ...layers,
        "--into",
        "pcb.jsonl",
        "--page-name",
        "Again",
      ]);
      expect(readFileSync(join(actualDir, "pcb.jsonl"), "utf8")).toBe(
        readFileSync(join(expectedDir, "pcb.jsonl"), "utf8"),
      );
    } finally {
      rmSync(expectedDir, { recursive: true, force: true });
      rmSync(actualDir, { recursive: true, force: true });
    }
  },
  120000,
);

/** RGBA pixels of an 8-bit RGBA PNG, enough to inspect native output. */
