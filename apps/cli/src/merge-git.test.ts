import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseDocument, serializeDocument } from "@nodetto/io";
import type { Document } from "@nodetto/ir";

const doc = (title: string, name = "Page"): Document => ({
  schemaVersion: 1,
  id: "doc",
  title,
  pages: [{ id: "page", name, kind: "freeform" }],
  elements: [],
});

function runMerge(conflict: boolean) {
  const dir = mkdtempSync(join(tmpdir(), "nodetto git test "));
  const env = {
    ...process.env,
    HOME: dir,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], {
      cwd: dir,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });
    return {
      code: result.exitCode,
      output: result.stdout.toString() + result.stderr.toString(),
    };
  };
  const checked = (...args: string[]) => {
    const result = git(...args);
    if (result.code !== 0)
      throw new Error(`git ${args.join(" ")}: ${result.output}`);
  };
  try {
    checked("init", "-b", "main");
    checked("config", "user.name", "Test User");
    checked("config", "user.email", "test@example.invalid");
    checked("config", "commit.gpgsign", "false");
    checked("config", "merge.nodetto.name", "nodetto three-way merge");
    const binary = process.env.NODETTO_CLI_TEST_BINARY;
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
    const driver = binary
      ? quote(resolve(binary))
      : `${quote(process.execPath)} ${quote(resolve(import.meta.dir, "main.ts"))}`;
    checked(
      "config",
      "merge.nodetto.driver",
      `${driver} merge %O %A %B --output %A`,
    );
    writeFileSync(join(dir, ".gitattributes"), "*.jsonl merge=nodetto\n");
    const path = join(dir, "document.jsonl");
    writeFileSync(path, serializeDocument(doc("Base")));
    checked("add", ".");
    checked("commit", "-m", "base");
    checked("switch", "-c", "theirs");
    writeFileSync(
      path,
      serializeDocument(conflict ? doc("Theirs") : doc("Base", "Other")),
    );
    checked("add", "document.jsonl");
    checked("commit", "-m", "theirs");
    checked("switch", "main");
    writeFileSync(path, serializeDocument(doc("Ours")));
    checked("add", "document.jsonl");
    checked("commit", "-m", "ours");
    const result = git("merge", "theirs");
    const text = readFileSync(path, "utf8");
    expect(result.code === 0).toBe(!conflict);
    expect(text).toBe(
      serializeDocument(doc("Ours", conflict ? "Page" : "Other")),
    );
    expect(serializeDocument(parseDocument(text))).toBe(text);
    if (conflict) {
      expect(result.output).toContain("conflict:");
      expect(text).not.toContain("<<<<<<<");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("git merge driver merges disjoint fields canonically", () =>
  runMerge(false));
test("git merge driver preserves canonical ours on conflict", () =>
  runMerge(true));
