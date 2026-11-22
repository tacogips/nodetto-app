import { expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { type Document, isPlainObject } from "@nodetto/ir";

const fixture = parseDocument(
  readFileSync(
    new URL(
      "../../../packages/io/src/__fixtures__/cad3d.jsonl",
      import.meta.url,
    ),
    "utf8",
  ),
);

function withField(
  document: Document,
  id: string,
  patch: Record<string, unknown>,
): Document {
  return {
    ...document,
    elements: document.elements.map((element) => {
      if (element.id !== id) return element;
      if (!isPlainObject(element.semantic)) {
        throw new Error(`Expected CAD fields on ${id}`);
      }
      return { ...element, semantic: { ...element.semantic, ...patch } };
    }),
  };
}

function gitMerge(ours: Document, theirs: Document, useDriver: boolean) {
  const scratch = new URL("../../../tmp/cad3d/m17/", import.meta.url);
  mkdirSync(scratch, { recursive: true });
  const dir = mkdtempSync(fileURLToPath(new URL("git-merge-", scratch)));
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], {
      cwd: dir,
      env: {
        ...process.env,
        GIT_ATTR_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    return { code: result.exitCode, stderr: result.stderr.toString() };
  };
  const checked = (...args: string[]) => {
    const { code, stderr } = git(...args);
    if (code !== 0) throw new Error(`git ${args.join(" ")}: ${stderr}`);
  };
  const path = join(dir, "document.jsonl");
  const commit = (document: Document, message: string) => {
    writeFileSync(path, serializeDocument(document));
    checked("add", ".");
    checked("commit", "-m", message);
  };
  try {
    checked("init", "--template=", "-b", "main");
    checked("config", "user.name", "CAD Merge Test");
    checked("config", "user.email", "cad-merge@example.invalid");
    checked("config", "core.attributesFile", "/dev/null");
    checked("config", "core.autocrlf", "false");
    if (useDriver) {
      const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
      const binary = process.env.NODETTO_CLI_TEST_BINARY;
      const cli = binary
        ? quote(resolve(binary))
        : `${quote(process.execPath)} ${quote(join(import.meta.dir, "main.ts"))}`;
      checked("config", "merge.nodetto.name", "nodetto three-way merge");
      checked(
        "config",
        "merge.nodetto.driver",
        `${cli} merge %O %A %B --output %A`,
      );
      writeFileSync(join(dir, ".gitattributes"), "*.jsonl merge=nodetto\n");
    }
    commit(fixture, "base");
    checked("switch", "-c", "theirs");
    commit(theirs, "theirs");
    checked("switch", "main");
    commit(ours, "ours");
    return {
      ...git("merge", "--no-edit", "theirs"),
      text: readFileSync(path, "utf8"),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function expectCanonical(text: string, expected: Document) {
  expect(text).toBe(serializeDocument(expected));
  expect(parseDocument(text)).toEqual(expected);
}

test("the Git driver merges different fields on the same CAD record", () => {
  const ours = withField(fixture, "cut", { distance: -7 });
  const theirs = withField(fixture, "cut", { name: "Reamed bore" });
  const result = gitMerge(ours, theirs, true);
  expect(result.code).toBe(0);
  expectCanonical(result.text, withField(ours, "cut", { name: "Reamed bore" }));
});

test("the Git driver reports one CAD field conflict and keeps ours", () => {
  const ours = withField(fixture, "circle-bore", { r: 3 });
  const theirs = withField(fixture, "circle-bore", { r: 4 });
  const result = gitMerge(ours, theirs, true);
  expect(result.code).toBe(1);
  expect(result.stderr.match(/^conflict:.*$/gm)).toEqual([
    "conflict: element circle-bore (cad.circle) semantic.r: base 2.125001 | ours 3 | theirs 4 (kept ours)",
  ]);
  expect(result.stderr).toContain("merged with 1 conflict(s)");
  expectCanonical(result.text, ours);
});

test("plain Git merges edits to separated CAD record lines", () => {
  const ours = withField(fixture, "circle-bore", { r: 3 });
  const theirs = withField(fixture, "plate", { distance: 8 });
  const result = gitMerge(ours, theirs, false);
  expect(result.code).toBe(0);
  expectCanonical(result.text, withField(ours, "plate", { distance: 8 }));
});
