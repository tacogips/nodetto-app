import type { CreatePageOptions } from "@nodetto/core";
import type { Page } from "@nodetto/ir";

export function isShapeEntryEnabled(
  page: Pick<Page, "kind"> | undefined,
): boolean {
  return page?.kind !== "cad3d";
}

export function newPageOptionsFor(
  currentPage: Pick<Page, "kind"> | undefined,
  pages: readonly Pick<Page, "kind">[],
  cadAllowed: boolean,
): CreatePageOptions {
  if (currentPage?.kind !== "cad3d" || !cadAllowed) return {};
  const count = pages.filter(({ kind }) => kind === "cad3d").length;
  return { kind: "cad3d", name: `3D CAD ${count + 1}` };
}
