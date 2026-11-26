import { expect } from "bun:test";
import { join } from "node:path";
import { cliSrcDir, compare, nativeTest } from "./harness.ts";

const fixture = join(cliSrcDir, "../../../examples/schematic/led-switch.jsonl");

for (const [name, args] of [
  ["lint text", ["lint", fixture]],
  ["lint JSON", ["lint", fixture, "--format", "json"]],
  ["netlist text", ["schematic", "netlist", fixture, "--format", "text"]],
  ["netlist KiCad", ["schematic", "netlist", fixture, "--format", "kicad"]],
  ["SVG export", ["export", fixture, "--format", "svg"]],
] as const) {
  nativeTest(
    `schematic ${name} matches Bun`,
    () => {
      const result = compare([...args]);
      expect(result.exitCode).toBe(0);
      if (name !== "lint text") expect(result.stdout.length).toBeGreaterThan(0);
    },
    60000,
  );
}
