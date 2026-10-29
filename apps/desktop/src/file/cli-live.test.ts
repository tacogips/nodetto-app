import { expect, test } from "bun:test";
import { unwatchFile, watchFile } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultRegistry, Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import type { FileBackend } from "./backend.ts";
import { DocumentSession } from "./session.ts";

const cliPath = fileURLToPath(
  new URL("../../../cli/src/main.ts", import.meta.url),
);
async function cli(...args: string[]): Promise<string> {
  const child = Bun.spawn([process.execPath, cliPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(code, stderr).toBe(0);
  return stdout;
}
async function until(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!check() && Date.now() < deadline) await Bun.sleep(10);
  expect(check()).toBe(true);
}

test("CLI atomic edits appear through a polled file watch, merge human edits and render the shared result", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nodetto-cli-live-"));
  const path = join(directory, "drawing.jsonl");
  const ops = join(directory, "ops.json");
  const snapshot = join(directory, "snapshot.jsonl");
  const png = join(directory, "drawing.png");
  const editor = new Editor({ registry: createDefaultRegistry() });
  const humanId = editor.createElement("node.generic", {
    semantic: { label: "Human node" },
  });
  await writeFile(path, serializeDocument(editor.getSnapshot()));
  let watched: string | undefined;
  const listeners = new Set<(path: string) => void>();
  const backend: FileBackend = {
    available: true,
    pickOpenPath: async () => path,
    pickSavePath: async () => path,
    readDocument: (path) => readFile(path, "utf8"),
    writeDocument: (path, contents) => writeFile(path, contents),
    listRecent: async () => [],
    addRecent: async () => [],
    removeRecent: async () => [],
    // Stat polling stands in for the app's native watcher: macOS fs.watch
    // can miss a change made just after it starts, or drop an atomic rename.
    watch: async (path) => {
      watched = path;
      watchFile(path, { interval: 20 }, (current, previous) => {
        if (
          current.ino !== previous.ino ||
          current.mtimeMs !== previous.mtimeMs
        )
          for (const listener of listeners) listener(path);
      });
    },
    unwatch: async () => {
      if (watched !== undefined) unwatchFile(watched);
    },
    onFileChanged: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const session = new DocumentSession({
    editor,
    backend,
    autosaveDelayMs: 60000,
  });
  try {
    expect(await session.open()).toBe(true);
    await writeFile(
      ops,
      JSON.stringify([
        {
          op: "add",
          page: editor.currentPageId,
          type: "node.generic",
          semantic: { label: "AI node" },
          place: { rightOf: humanId },
        },
      ]),
    );
    await cli("edit", path, "--ops", ops, "--snapshot", snapshot);
    await until(() => editor.store.listElements().length === 2);
    expect(session.state().outsideChange?.added).toBe(1);
    expect(session.state().conflict).toBeNull();

    // Leave a human move unsaved while the AI adds another node from disk.
    editor.moveElements([{ id: humanId, x: 80, y: 120 }]);
    await writeFile(
      ops,
      JSON.stringify([
        {
          op: "add",
          page: editor.currentPageId,
          type: "node.generic",
          semantic: { label: "AI second pass" },
        },
      ]),
    );
    await cli("edit", path, "--ops", ops);
    await until(() => editor.store.listElements().length === 3);
    expect(editor.store.get(humanId)?.visual).toMatchObject({ x: 80, y: 120 });
    expect(session.state().outsideChange?.merged).toBe(true);
    expect(session.state().conflict).toBeNull();
    expect(await session.save()).toBe(true);
    const saved = parseDocument(await readFile(path, "utf8"));
    expect(saved.elements).toHaveLength(3);
    expect(saved.elements.find((e) => e.id === humanId)?.visual).toMatchObject({
      x: 80,
      y: 120,
    });
    expect(await cli("inspect", path)).toContain("AI second pass");
    expect(
      JSON.parse(await cli("inspect", path, "--format", "json")),
    ).toBeDefined();
    expect(await cli("diff", snapshot, path)).toContain("visual.x");
    await cli("export", path, "--format", "png", "--output", png);
    expect(Array.from((await readFile(png)).subarray(0, 8))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
  } finally {
    session.dispose();
    if (watched !== undefined) unwatchFile(watched);
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
