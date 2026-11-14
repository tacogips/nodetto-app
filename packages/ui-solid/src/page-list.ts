import type { Editor } from "@nodetto/core";
import type { PageId } from "@nodetto/ir";
import { pageTabRevealTarget } from "./page-tab-scroll.ts";

export interface PageListRow {
  id: PageId;
  number: number;
  name: string;
  hiddenInPresentation: boolean;
  current: boolean;
}

export function pageListRows(editor: Editor): PageListRow[] {
  return editor.store.listPages().map((page, index) => ({
    id: page.id,
    number: index + 1,
    name: page.name,
    hiddenInPresentation: page.hiddenInPresentation === true,
    current: page.id === editor.currentPageId,
  }));
}

export function pageListVisibleRows(
  rows: readonly PageListRow[],
  open: boolean,
): readonly PageListRow[] {
  return open ? rows : [];
}

export function pageListKeyAction(
  rows: readonly PageListRow[],
  focusedId: PageId,
  key: string,
  mods: { alt: boolean; ctrl: boolean; meta: boolean; composing: boolean },
  readOnly: boolean,
): { kind: "focus" | "activate" | "rename"; id: PageId } | null {
  if (mods.alt || mods.ctrl || mods.meta || mods.composing) return null;
  const index = rows.findIndex((row) => row.id === focusedId);
  if (index < 0) return null;
  const focus = (target: number) => ({
    kind: "focus" as const,
    id: rows[target]?.id ?? focusedId,
  });
  switch (key) {
    case "ArrowUp":
      return focus(Math.max(0, index - 1));
    case "ArrowDown":
      return focus(Math.min(rows.length - 1, index + 1));
    case "Home":
      return focus(0);
    case "End":
      return focus(rows.length - 1);
    case "Enter":
    case " ":
      return { kind: "activate", id: focusedId };
    case "F2":
      return readOnly ? null : { kind: "rename", id: focusedId };
    default:
      return null;
  }
}

export function pageListRevealTop(
  row: { top: number; bottom: number },
  view: { scrollTop: number; clientHeight: number; scrollHeight: number },
): number | null {
  return pageTabRevealTarget(
    { start: row.top, end: row.bottom },
    {
      scrollLeft: view.scrollTop,
      width: view.clientHeight,
      scrollWidth: view.scrollHeight,
    },
  );
}
