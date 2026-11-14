import { expect } from "bun:test";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import {
  binary,
  cliEntry,
  compare,
  fixtureRoot,
  nativeTest,
} from "./harness.ts";

const goldenFixtures = readdirSync(fixtureRoot).filter((name) =>
  name.endsWith(".jsonl"),
);

nativeTest(
  "native CLI matches every JSONL golden fixture for validate, canonical format and both inspect formats",
  () => {
    for (const name of goldenFixtures) {
      const path = join(fixtureRoot, name);
      for (const args of [
        ["validate", path],
        ["format", path],
        ["inspect", path],
        ["inspect", path, "--format", "json"],
      ])
        compare(args);
    }
  },
  // Eight CLI launches per fixture (TypeScript and native, four commands);
  // the budget guards each launch, so it grows with the fixture count.
  goldenFixtures.length * 5000,
);

nativeTest(
  "native CLI matches help, element catalogue, DDL, layout, diff, errors and BPMN",
  () => {
    for (const args of [
      ["--help"],
      ["--version"],
      ["help", "mcp"],
      ["types"],
      ["types", "erd.table", "--format", "json"],
      ["ddl", join(fixtureRoot, "erd.jsonl"), "--dialect", "mysql"],
      ["arrange", join(fixtureRoot, "erd.jsonl"), "--mode", "overlaps"],
      [
        "diff",
        join(fixtureRoot, "erd.jsonl"),
        join(fixtureRoot, "erd-unsorted.jsonl"),
        "--format",
        "json",
      ],
      [
        "lint",
        join(fixtureRoot, "bpmn/purchase-request.bpmn"),
        "--format",
        "json",
      ],
      ["bpmn", "export", join(fixtureRoot, "bpmn/purchase-request.jsonl")],
      ["validate", "/missing/document.jsonl"],
      ["export", "missing.jsonl", "--format", "bmp"],
      ["mcp", "--port", "1234"],
    ]) {
      // OS error wording differs between Node and std::fs; result codes and
      // contextual paths are checked separately for missing local files.
      if (args[0] === "validate" && args[1]?.startsWith("/missing")) {
        const result = Bun.spawnSync([binary!, ...args]);
        expect(result.exitCode).toBe(2);
        expect(result.stderr.toString()).toContain(
          "Cannot read /missing/document.jsonl:",
        );
      } else compare(args);
    }
  },
  60000,
);

nativeTest(
  "native --cwd supports document commands and preserves check/strict exit codes",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-cwd-"));
    try {
      const erd = readFileSync(join(fixtureRoot, "erd.jsonl"), "utf8");
      writeFileSync(join(cwd, "doc.jsonl"), erd);
      writeFileSync(join(cwd, "stale.sql"), "-- stale\n");
      const native = Bun.spawnSync([
        binary!,
        "--cwd",
        cwd,
        "inspect",
        "doc.jsonl",
        "--format",
        "json",
      ]);
      const expected = Bun.spawnSync(
        [
          process.execPath,
          cliEntry,
          "inspect",
          "doc.jsonl",
          "--format",
          "json",
        ],
        { cwd },
      );
      expect(native.exitCode).toBe(0);
      expect(native.stdout.toString()).toBe(expected.stdout.toString());
      expect(
        Bun.spawnSync([
          binary!,
          "--cwd",
          cwd,
          "ddl",
          "doc.jsonl",
          "--check",
          "stale.sql",
        ]).exitCode,
      ).toBe(1);
      writeFileSync(
        join(cwd, "unsafe.jsonl"),
        erd.replace(/"dataType":"[^"]+"/, '"dataType":"uuid;drop"'),
      );
      expect(
        Bun.spawnSync([
          binary!,
          "--cwd",
          cwd,
          "ddl",
          "unsafe.jsonl",
          "--strict",
        ]).exitCode,
      ).toBe(3);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
);

nativeTest(
  "native CLI lists stable page aliases and accepts them for page commands",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-page-ids-"));
    try {
      const document = parseDocument(
        readFileSync(join(fixtureRoot, "erd.jsonl"), "utf8"),
      );
      const editor = new Editor({ document });
      const schema = editor.currentPageId;
      editor.createPage({ name: "Other page", kind: "sequence" });
      writeFileSync(
        join(cwd, "mixed.jsonl"),
        serializeDocument(editor.getSnapshot()),
      );
      const listing = compare(
        ["pages", "mixed.jsonl", "--format", "json"],
        cwd,
      );
      const pages = JSON.parse(listing.stdout.toString()) as {
        id: string;
        shortId: string;
      }[];
      const alias = pages.find((page) => page.id === schema)!.shortId;
      expect(alias).toHaveLength(11);
      compare(["pages", "mixed.jsonl", "--kind", "erd"], cwd);
      for (const args of [
        ["inspect", "mixed.jsonl", "--page", alias, "--format", "json"],
        ["export", "mixed.jsonl", "--page", alias, "--format", "svg"],
        ["ddl", "mixed.jsonl", "--page", alias],
        ["arrange", "mixed.jsonl", "--page", alias],
        ["edit", "mixed.jsonl", "--ops", "-", "--dry-run"],
      ])
        compare(
          args,
          cwd,
          args[0] === "edit"
            ? JSON.stringify([
                { op: "rename-page", id: alias, name: "Renamed" },
              ])
            : undefined,
        );
      for (const format of ["png", "pdf"]) {
        const result = Bun.spawnSync(
          [
            binary!,
            "export",
            "mixed.jsonl",
            "--page",
            alias,
            "--format",
            format,
            "--output",
            `out.${format}`,
          ],
          { cwd },
        );
        expect(result.exitCode).toBe(0);
        expect([
          ...readFileSync(join(cwd, `out.${format}`)).subarray(0, 4),
        ]).toEqual(format === "png" ? [137, 80, 78, 71] : [37, 80, 68, 70]);
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "native CLI reads a document with a 20,000-point path quickly",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-large-"));
    try {
      const editor = new Editor();
      const contours = Array.from({ length: 1000 }, (_, contour) => ({
        points: Array.from({ length: 20 }, (_, index) => ({
          x: (contour % 40) * 30 + 10 * Math.cos((index / 20) * 2 * Math.PI),
          y:
            Math.floor(contour / 40) * 30 +
            10 * Math.sin((index / 20) * 2 * Math.PI),
        })),
      }));
      editor.createElement("draw.path", {
        semantic: { contours, fillRule: "nonzero" },
      });
      writeFileSync(
        join(cwd, "large.jsonl"),
        serializeDocument(editor.getSnapshot()),
      );
      // Splitting such a line on a regular expression took minutes in the
      // native interpreter; the whole command now takes about a second.
      const started = performance.now();
      const result = Bun.spawnSync([binary!, "validate", "large.jsonl"], {
        cwd,
      });
      expect(result.exitCode).toBe(0);
      expect(performance.now() - started).toBeLessThan(20000);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  120000,
);
