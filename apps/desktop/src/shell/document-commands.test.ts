import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { shortPageId, type Document } from "@nodetto/ir";
import type { DocumentSession, SessionState } from "../file/session.ts";
import { createDocumentCommands } from "./document-commands.ts";

const document = (id: string): Document => ({
  schemaVersion: 1,
  id,
  title: id,
  pages: [
    { id: `${id}-2`, name: "Second", kind: "freeform", order: "b" },
    { id: `${id}-1`, name: "First", kind: "freeform", order: "a" },
  ],
  elements: [],
});

function fixture(openFile: string) {
  const editor = new Editor({ document: document(openFile) });
  const opened: string[] = [];
  const notices: (string | null)[] = [];
  let state = { filePath: openFile, dirty: false } as SessionState;
  const session = {
    openPath: async (path: string) => {
      opened.push(path);
      editor.loadDocument(document(path));
      state = { ...state, filePath: path };
      return true;
    },
    state: () => state,
  } as unknown as DocumentSession;
  const commands = createDocumentCommands(
    { editor, session },
    () => state,
    () => ({ width: 800, height: 600 }),
    (message) => notices.push(message),
  );
  return { editor, opened, notices, commands };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

test("a link into the open file switches pages without reloading it", async () => {
  const { editor, opened, commands } = fixture("/docs/a.jsonl");
  editor.setCurrentPage("/docs/a.jsonl-1");
  commands.openRequest({
    path: "/docs/a.jsonl",
    page: shortPageId("/docs/a.jsonl-2"),
  });
  await settle();
  expect(opened).toEqual([]);
  expect(editor.currentPageId).toBe("/docs/a.jsonl-2");
});

test("a link to another file opens it at the page number in display order", async () => {
  const { editor, opened, commands } = fixture("/docs/a.jsonl");
  commands.openRequest({ path: "/docs/b.jsonl", pageNumber: 2 });
  await settle();
  expect(opened).toEqual(["/docs/b.jsonl"]);
  expect(editor.currentPageId).toBe("/docs/b.jsonl-2");
});

test("an unknown page still opens the file on its first page and says so", async () => {
  const { editor, opened, notices, commands } = fixture("/docs/a.jsonl");
  commands.openRequest({ path: "/docs/b.jsonl", page: "missing" });
  await settle();
  expect(opened).toEqual(["/docs/b.jsonl"]);
  expect(editor.currentPageId).toBe("/docs/b.jsonl-1");
  expect(notices).toEqual([
    null,
    'Link to b.jsonl: No page has the id, short id or name "missing".',
  ]);
  commands.openRequest({ path: "/docs/b.jsonl", pageNumber: 3 });
  await settle();
  expect(notices.slice(2)).toEqual([
    null,
    "Link to b.jsonl: Page number 3 is out of range; the document has 2 pages.",
  ]);
});
