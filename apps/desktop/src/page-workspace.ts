import { type Page, type PageKind, pageModeOf } from "@nodetto/ir";
import type { WorkspaceId } from "@nodetto/ui-solid";

export const DEDICATED_WORKSPACES: Readonly<
  Partial<Record<PageKind, WorkspaceId>>
> = {
  bpmn: "bpmn",
  breadboard: "breadboard",
  pcb: "pcb",
};

export const DEDICATED_PAGE_NAMES: Readonly<Partial<Record<PageKind, string>>> =
  {
    bpmn: "Process",
    breadboard: "Breadboard",
    pcb: "PCB",
  };

export function dedicatedWorkspaceFor(
  kind: PageKind | undefined,
): WorkspaceId | undefined {
  return kind === undefined ? undefined : DEDICATED_WORKSPACES[kind];
}

export function dedicatedPageKindFor(
  workspace: WorkspaceId,
): PageKind | undefined {
  return (
    Object.entries(DEDICATED_WORKSPACES) as [PageKind, WorkspaceId][]
  ).find(([, candidate]) => candidate === workspace)?.[0];
}

/**
 * The mode a page opens in (see pageModeOf); pages that never chose one and
 * have no notation of their own open in the default mode.
 */
export function workspaceForPage(
  page: Pick<Page, "kind" | "mode"> | undefined,
  fallback: WorkspaceId,
): WorkspaceId {
  return (page && pageModeOf(page)) ?? fallback;
}
