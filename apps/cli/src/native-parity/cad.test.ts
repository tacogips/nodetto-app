import { expect } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { generateCadDocument } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import {
  binary,
  cliSrcDir,
  compare,
  compareFile,
  nativeTest,
} from "./harness.ts";

const root = resolve(cliSrcDir, "../../..");
const scratch = join(root, "tmp/cad3d/m16");
const fixture = join(cliSrcDir, "__fixtures__/cad-bracket.jsonl");

nativeTest(
  "CAD check, validate and edit match the source CLI byte for byte",
  () => {
    mkdirSync(scratch, { recursive: true });
    const cwd = mkdtempSync(join(scratch, "parity-"));
    try {
      const source = readFileSync(fixture, "utf8");
      const document = join(cwd, "bracket.jsonl");
      const ops = join(cwd, "ops.json");
      writeFileSync(document, source);
      for (const args of [
        ["cad", "check", document],
        ["cad", "check", document, "--page", "bracket", "--json"],
        ["validate", document],
      ])
        expect(compare(args, cwd).exitCode).toBe(0);
      writeFileSync(
        ops,
        JSON.stringify([
          { op: "update", id: "bracket-extrude", semantic: { distance: -9 } },
          { op: "rename-page", id: "bracket", name: "Machined bracket" },
        ]),
      );
      expect(
        compareFile(["edit", document, "--ops", ops], document, source, cwd)
          .exitCode,
      ).toBe(0);
      expect(compare(["cad", "check", document, "--json"], cwd).exitCode).toBe(
        0,
      );
      writeFileSync(document, source.replace(/^.*"id":"bracket-top".*\n/m, ""));
      expect(compare(["cad", "check", document, "--json"], cwd).exitCode).toBe(
        1,
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  60_000,
);

nativeTest(
  "native validate and cad check each finish within 10 seconds for 10,000 CAD elements including extrusions",
  () => {
    if (!binary) throw new Error("Expected the native CLI binary");
    mkdirSync(scratch, { recursive: true });
    const cwd = mkdtempSync(join(scratch, "large-"));
    try {
      const doc = generateCadDocument({ features: 500, entitiesPerSketch: 18 });
      expect(doc.elements).toHaveLength(10_000);
      expect(
        doc.elements.filter(({ type }) => type === "cad.extrude"),
      ).toHaveLength(500);
      const file = join(cwd, "large.jsonl");
      writeFileSync(file, serializeDocument(doc));
      for (const args of [["validate"], ["cad", "check", "--json"]]) {
        const started = performance.now();
        const result = Bun.spawnSync([binary, ...args, file], { cwd });
        const elapsed = performance.now() - started;
        console.log(
          `Native ${args.join(" ")}, 10,000 elements: ${elapsed.toFixed(1)} ms`,
        );
        expect(result.stderr.toString()).toBe("");
        expect(result.exitCode).toBe(0);
        if (args[0] === "cad") {
          expect(JSON.parse(result.stdout.toString())).toEqual([
            {
              pageId: doc.pages[0]?.id,
              features: 1_000,
              entities: 9_000,
              errors: [],
              bounds: { min: [-3, -3, 0], max: [30, 3, 4] },
            },
          ]);
        }
        expect(elapsed).toBeLessThan(10_000);
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  60_000,
);

nativeTest("the built native CLI engine has no WebAssembly identifier", () => {
  if (!binary) throw new Error("Expected the native CLI binary");
  const directory = dirname(resolve(binary));
  const bundles = Array.from(
    new Bun.Glob("build/nodetto-cli-*/out/diagram.js").scanSync(directory),
  );
  expect(bundles.length).toBeGreaterThan(0);
  for (const bundle of bundles)
    expect(
      /\bWebAssembly\b/.test(readFileSync(join(directory, bundle), "utf8")),
    ).toBe(false);
});
