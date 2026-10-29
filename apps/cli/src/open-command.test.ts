import { expect, test } from "bun:test";
import { shortPageId } from "@nodetto/ir";
import { serializeDocument } from "@nodetto/io";
import { resolve } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { runCliAsync } from "./cli.ts";
import type { CommandIo } from "./commands.ts";
import { desktopOpenArguments, openDesktopDocument } from "./open-desktop.ts";
import { desktopOpenLink } from "./open-link.ts";

const io: CommandIo = {
  readText: () => {
    throw new Error("Opening must not parse or write a document.");
  },
  writeText: () => {
    throw new Error("Opening must not write a document.");
  },
};

test("open delegates one file and an optional application without modifying it", async () => {
  const requests: unknown[] = [];
  const result = await runCliAsync(
    ["open", "a b.jsonl", "--app", "/tmp/Test.app"],
    {
      ...io,
      openDocument: async (...args) => {
        requests.push(args);
      },
    },
    "test",
  );
  expect(result.exitCode).toBe(0);
  expect(requests).toEqual([["a b.jsonl", "/tmp/Test.app"]]);
});

test("open rejects bad arguments and reports launch failures", async () => {
  for (const args of [[], ["a", "b"], ["a", "--unknown"], ["a", "--app"]]) {
    expect((await runCliAsync(["open", ...args], io, "test")).exitCode).toBe(2);
  }
  const result = await runCliAsync(
    ["open", "missing.jsonl"],
    {
      ...io,
      openDocument: async () => {
        throw new Error("app not installed");
      },
    },
    "test",
  );
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain("app not installed");
});

test("open help never launches an app", async () => {
  for (const args of [
    ["open", "--help"],
    ["help", "open"],
  ]) {
    const result = await runCliAsync(args, io, "test");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--app");
  }
});

test("launch plans preserve literal paths and use platform-specific executables", () => {
  const path = "-a name;$(touch nope).jsonl";
  expect(desktopOpenArguments(path, "/tmp/My App.app", "darwin")).toEqual([
    "/usr/bin/open",
    ["-a", "/tmp/My App.app", "--", resolve(path)],
  ]);
  expect(desktopOpenArguments(path, undefined, "linux")).toEqual([
    "nodetto",
    [resolve(path)],
  ]);
  expect(desktopOpenArguments(path, undefined, "win32")).toEqual([
    "nodetto.exe",
    [resolve(path)],
  ]);
  expect(() => desktopOpenArguments(path, undefined, "unsupported")).toThrow(
    "unsupported",
  );
});

test("missing files and directories are rejected before launching", async () => {
  const directory = mkdtempSync(`${tmpdir()}/nodetto-open-`);
  try {
    await expect(openDesktopDocument(directory)).rejects.toThrow(
      "regular file",
    );
    await expect(
      openDesktopDocument(`${directory}/missing.jsonl`),
    ).rejects.toThrow();
  } finally {
    rmSync(directory, { recursive: true });
  }
});

const paged = serializeDocument({
  schemaVersion: 1,
  id: "doc",
  title: "Paged",
  pages: [
    { id: "page-b", name: "Second", kind: "freeform", order: "b" },
    { id: "page-a", name: "First", kind: "freeform", order: "a" },
  ],
  elements: [],
});

async function openWith(args: readonly string[]) {
  const requests: unknown[][] = [];
  const result = await runCliAsync(
    ["open", "doc.jsonl", ...args],
    {
      ...io,
      readText: () => paged,
      openDocument: async (...request) => {
        requests.push(request);
      },
    },
    "test",
  );
  return { result, requests };
}

test("open --page and --page-number resolve against the file before launching", async () => {
  for (const [args, id] of [
    [["--page", "Second"], "page-b"],
    [["--page", shortPageId("page-a")], "page-a"],
    [["--page", "page-b"], "page-b"],
    [["--page-number", "1"], "page-a"],
    [["--page-number=2"], "page-b"],
  ] as const) {
    const { result, requests } = await openWith(args);
    expect(result.exitCode).toBe(0);
    expect(requests).toEqual([["doc.jsonl", undefined, id]]);
    expect(result.stdout).toContain(shortPageId(id));
  }
});

test("open rejects unknown pages and malformed page selections without launching", async () => {
  for (const args of [
    ["--page", "Missing"],
    ["--page-number", "3"],
    ["--page-number", "0"],
    ["--page-number", "1.5"],
    ["--page-number", "x"],
    ["--page", "First", "--page-number", "1"],
  ]) {
    const { result, requests } = await openWith(args);
    expect(result.exitCode).toBe(2);
    expect(requests).toEqual([]);
  }
});

test("a page travels as a nodetto:// link after the file on every platform", () => {
  const path = "dir/a b&c.jsonl";
  const link = desktopOpenLink(resolve(path), "page/1");
  expect(link).toBe(
    `nodetto://open?path=${encodeURIComponent(resolve(path))}&page=page%2F1`,
  );
  expect(desktopOpenArguments(path, undefined, "darwin", "page/1")).toEqual([
    "/usr/bin/open",
    ["-a", "nodetto", "--", resolve(path), link],
  ]);
  expect(desktopOpenArguments(path, undefined, "linux", "page/1")).toEqual([
    "nodetto",
    [resolve(path), link],
  ]);
});
