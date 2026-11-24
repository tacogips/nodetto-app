import { compareCadHistoryOrder } from "@nodetto/core";
import {
  comparePageOrder,
  type Element,
  type ElementId,
  type Page,
} from "@nodetto/ir";

export interface PcbBoardChoice {
  readonly boardId: ElementId;
  readonly pageName: string;
}

export function pcbBoardChoices(document: {
  pages: readonly Page[];
  elements: readonly Element[];
}): readonly PcbBoardChoice[] {
  const boardsByPage = new Map<string, Element[]>();
  for (const element of document.elements) {
    if (element.type !== "pcb.board") continue;
    const boards = boardsByPage.get(element.page);
    if (boards) boards.push(element);
    else boardsByPage.set(element.page, [element]);
  }
  return [...document.pages]
    .filter((page) => page.kind === "pcb")
    .sort(comparePageOrder)
    .flatMap((page) =>
      (boardsByPage.get(page.id) ?? [])
        .sort(compareCadHistoryOrder)
        .map(({ id }) => ({
          boardId: id,
          pageName: page.name,
        })),
    );
}

export function isPcbBoardChoice(
  document: { pages: readonly Page[]; elements: readonly Element[] },
  boardId: ElementId,
): boolean {
  return pcbBoardChoices(document).some((choice) => choice.boardId === boardId);
}

export function pcbBoardOptions(choices: readonly PcbBoardChoice[]) {
  const totals = new Map<string, number>();
  const seen = new Map<string, number>();
  const nameOf = ({ pageName }: PcbBoardChoice) =>
    pageName.trim() || "PCB board";
  for (const choice of choices) {
    const name = nameOf(choice);
    totals.set(name, (totals.get(name) ?? 0) + 1);
  }
  return choices.map((choice) => {
    const name = nameOf(choice);
    const number = (seen.get(name) ?? 0) + 1;
    seen.set(name, number);
    return {
      value: choice.boardId,
      label: totals.get(name) === 1 ? name : `${name} (${number})`,
    };
  });
}
