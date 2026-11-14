import { expect } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  textLayoutCleanDocument,
  textLayoutDenseDocument,
  textLayoutProblemDocument,
  textLayoutWideDocument,
} from "../__fixtures__/text-layout.ts";
import { binary, cliEntry, compare, nativeTest } from "./harness.ts";

nativeTest(
  "native CLI matches text-layout lint and export, including dense pages",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-text-layout-"));
    try {
      writeFileSync(join(cwd, "clean.jsonl"), textLayoutCleanDocument());
      writeFileSync(join(cwd, "problem.jsonl"), textLayoutProblemDocument());
      writeFileSync(join(cwd, "dense.jsonl"), textLayoutDenseDocument(300));
      for (const args of [
        ["lint", "clean.jsonl"],
        ["lint", "problem.jsonl"],
        ["lint", "problem.jsonl", "--format", "json"],
        ["lint", "problem.jsonl", "--page", "Architecture"],
      ]) {
        const result = compare(args, cwd);
        expect(result.exitCode).toBe(0);
      }
      for (const args of [
        ["export", "problem.jsonl", "--format", "svg"],
        ["export", "problem.jsonl", "--format", "svg", "--output", "out.svg"],
      ]) {
        const result = compare(args, cwd);
        expect(result.exitCode).toBe(0);
        expect(result.stderr.toString()).toContain(
          "warning: label-overflow node-clipped:",
        );
      }
      const args = ["lint", "dense.jsonl", "--format", "json"];
      const expected = Bun.spawnSync([process.execPath, cliEntry, ...args], {
        cwd,
      });
      const actual = Bun.spawnSync([binary!, ...args], { cwd, timeout: 60000 });
      expect(expected.exitCode).toBe(0);
      expect(actual.exitCode).toBe(0);
      expect(actual.stderr.toString()).not.toContain("panicked");
      expect(actual.stdout.toString()).toBe(expected.stdout.toString());
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  // Three dense-launch budgets of 60000 ms cover the paired CLI launches.
  180000,
);

nativeTest(
  "native CLI matches text-layout lint on wide labels, freeform and flowchart pages",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-text-layout-wide-"));
    try {
      writeFileSync(join(cwd, "wide.jsonl"), textLayoutWideDocument());
      writeFileSync(
        join(cwd, "problem-freeform.jsonl"),
        textLayoutProblemDocument("freeform"),
      );
      writeFileSync(
        join(cwd, "problem-flowchart.jsonl"),
        textLayoutProblemDocument("flowchart"),
      );
      for (const file of [
        "wide.jsonl",
        "problem-freeform.jsonl",
        "problem-flowchart.jsonl",
      ]) {
        const lint = compare(["lint", file], cwd);
        expect(lint.exitCode).toBe(0);
        if (file === "wide.jsonl")
          expect(lint.stdout.toString()).toContain("note-overflow");
        expect(compare(["lint", file, "--format", "json"], cwd).exitCode).toBe(
          0,
        );
        const exported = compare(["export", file, "--format", "svg"], cwd);
        expect(exported.exitCode).toBe(0);
        if (file === "wide.jsonl") {
          expect(exported.stderr.toString()).toContain(
            "warning: label-overflow node-wide:",
          );
          expect(exported.stderr.toString()).not.toContain("node-ascii");
        } else {
          expect(exported.stderr.toString()).toContain(
            "warning: label-overflow node-clipped:",
          );
        }
      }
      expect(
        compare(
          ["lint", "problem-flowchart.jsonl", "--page", "Architecture"],
          cwd,
        ).exitCode,
      ).toBe(0);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  // Twenty launches cover ten comparisons of small documents.
  120000,
);
