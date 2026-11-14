import type { Editor } from "@nodetto/core";
import type { Page, PageId } from "@nodetto/ir";
import { presentationToggleLabel } from "./page-presentation-toggle.ts";

export type PageMenuItemKey =
  | "rename"
  | "duplicate"
  | "copyShapes"
  | "presentation"
  | "delete"
  | "moveBack"
  | "moveForward";

export interface PageMenuItem {
  readonly key: PageMenuItemKey;
  readonly label: string;
  readonly title?: string;
  readonly disabled: boolean;
}

export const deletePagePrompt = (page: Page, count: number): string =>
  `Delete page "${page.name}" and the ${count} element${
    count === 1 ? "" : "s"
  } on it?`;

export const canDeletePage = (editor: Editor): boolean =>
  !editor.readOnly && editor.store.listPages().length > 1;

export function deletePageWithConfirm(
  editor: Editor,
  id: PageId,
  confirm: (message: string) => boolean,
): "deleted" | "cancelled" | "unavailable" {
  const page = editor.store.getPage(id);
  if (!canDeletePage(editor) || !page) return "unavailable";
  const count = editor.store.getPageElements(id).length;
  if (count > 0 && !confirm(deletePagePrompt(page, count))) return "cancelled";
  editor.deletePage(id);
  return "deleted";
}

export function duplicatePageAction(editor: Editor, id: PageId): boolean {
  return !editor.readOnly && editor.duplicatePage(id) !== null;
}

export function togglePagePresentation(editor: Editor, id: PageId): void {
  const page = editor.store.getPage(id);
  if (page)
    editor.setPageHiddenInPresentation(
      id,
      !(page.hiddenInPresentation === true),
    );
}

export function pageMenuItems(
  editor: Editor,
  id: PageId,
  options: { copyShapes: boolean; axis: "horizontal" | "vertical" },
): readonly PageMenuItem[] {
  const pages = editor.store.listPages();
  const canDelete = canDeletePage(editor);
  return [
    { key: "rename", label: "Rename", title: "Rename page", disabled: false },
    {
      key: "duplicate",
      label: "Duplicate",
      title: "Duplicate page and everything on it",
      disabled: false,
    },
    ...(options.copyShapes
      ? [
          {
            key: "copyShapes" as const,
            label: "Copy shapes from page...",
            disabled: editor.readOnly || pages.length <= 1,
          },
        ]
      : []),
    {
      key: "presentation",
      label: presentationToggleLabel(
        editor.store.getPage(id)?.hiddenInPresentation === true,
      ),
      disabled: editor.readOnly,
    },
    {
      key: "delete",
      label: "Delete",
      title: canDelete ? "Delete page" : "The last page cannot be deleted",
      disabled: !canDelete,
    },
    {
      key: "moveBack",
      label: options.axis === "horizontal" ? "Move left" : "Move up",
      disabled: pages[0]?.id === id,
    },
    {
      key: "moveForward",
      label: options.axis === "horizontal" ? "Move right" : "Move down",
      disabled: pages.at(-1)?.id === id,
    },
  ];
}
