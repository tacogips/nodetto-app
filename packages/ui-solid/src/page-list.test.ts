import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import {
  pageListKeyAction,
  pageListRevealTop,
  pageListRows,
  pageListVisibleRows,
} from "./page-list.ts";

const noMods = { alt: false, ctrl: false, meta: false, composing: false };

test("rows follow page order, metadata, current page, changes and undo", () => {
  const editor = new Editor();
  const first = editor.currentPageId;
  const second = editor.createPage({ name: "Second" });
  const third = editor.createPage({ name: "Third" });
  editor.setPageHiddenInPresentation(second, true);
  editor.setCurrentPage(second);
  const rows = pageListRows(editor);
  expect(rows.map((row) => row.id)).toEqual([first, second, third]);
  expect(rows.map((row) => row.number)).toEqual([1, 2, 3]);
  expect(rows.map((row) => row.hiddenInPresentation)).toEqual([
    false,
    true,
    false,
  ]);
  expect(rows.map((row) => row.current)).toEqual([false, true, false]);
  expect(pageListVisibleRows(rows, false)).toEqual([]);
  expect(pageListVisibleRows(rows, true)).toEqual(rows);
  editor.reorderPage(third, -1);
  expect(pageListRows(editor).map((row) => row.id)).toEqual([
    first,
    third,
    second,
  ]);
  editor.renamePage(third, "Renamed");
  expect(pageListRows(editor).find((row) => row.id === third)?.name).toBe(
    "Renamed",
  );
  editor.undo();
  expect(pageListRows(editor).find((row) => row.id === third)?.name).toBe(
    "Third",
  );
  editor.undo();
  expect(pageListRows(editor).map((row) => row.id)).toEqual([
    first,
    second,
    third,
  ]);
});

test("keyboard actions clamp focus, activate, rename and ignore modifiers", () => {
  const editor = new Editor();
  const first = editor.currentPageId;
  const second = editor.createPage();
  const third = editor.createPage();
  const rows = pageListRows(editor);
  const action = (id: string, key: string, readOnly = false) =>
    pageListKeyAction(rows, id, key, noMods, readOnly);
  expect(action(first, "ArrowUp")).toEqual({ kind: "focus", id: first });
  expect(action(third, "ArrowDown")).toEqual({ kind: "focus", id: third });
  expect(action(second, "ArrowUp")).toEqual({ kind: "focus", id: first });
  expect(action(second, "ArrowDown")).toEqual({ kind: "focus", id: third });
  expect(action(second, "Home")).toEqual({ kind: "focus", id: first });
  expect(action(second, "End")).toEqual({ kind: "focus", id: third });
  expect(action(second, "Enter")).toEqual({ kind: "activate", id: second });
  expect(action(second, " ")).toEqual({ kind: "activate", id: second });
  expect(action(second, "F2")).toEqual({ kind: "rename", id: second });
  expect(action(second, "F2", true)).toBeNull();
  expect(action(second, "Escape")).toBeNull();
  expect(action("missing", "Enter")).toBeNull();
  for (const key of ["alt", "ctrl", "meta", "composing"] as const) {
    expect(
      pageListKeyAction(
        rows,
        second,
        "Enter",
        { ...noMods, [key]: true },
        false,
      ),
    ).toBeNull();
  }
});

test("reveal computes only the necessary vertical scroll", () => {
  const view = { scrollTop: 100, clientHeight: 100, scrollHeight: 500 };
  expect(pageListRevealTop({ top: 60, bottom: 90 }, view)).toBe(60);
  expect(pageListRevealTop({ top: 190, bottom: 230 }, view)).toBe(130);
  expect(pageListRevealTop({ top: 120, bottom: 150 }, view)).toBeNull();
});
