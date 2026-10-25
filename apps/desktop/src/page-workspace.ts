import type { PageKind } from "@nodetto/ir";
import type { WorkspaceId } from "@nodetto/ui-solid";

export const DEDICATED_WORKSPACES: Readonly<
  Partial<Record<PageKind, WorkspaceId>>
> = {
  bpmn: "bpmn",
  breadboard: "breadboard",
};

export const DEDICATED_PAGE_NAMES: Readonly<Partial<Record<PageKind, string>>> =
  {
    bpmn: "Process",
    breadboard: "Breadboard",
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
