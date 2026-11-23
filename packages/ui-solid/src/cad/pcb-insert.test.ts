import { expect, test } from "bun:test";
import { CAD_TEST_PAGE } from "../../../core/src/cad/testing/documents.ts";
import {
  edge,
  PCB_TEST_PAGE,
  testBoard,
} from "../../../core/src/cad/testing/pcb.ts";
import { pcbBoardChoices, pcbBoardOptions } from "./pcb-insert.ts";

test("lists PCB board records, leaving out other CAD and PCB elements", () => {
  const pages = [CAD_TEST_PAGE, PCB_TEST_PAGE];
  const outline = edge("rim", { kind: "rect", start: [0, 0], end: [20, 10] });
  expect(pcbBoardChoices({ pages, elements: [outline] })).toEqual([]);
  expect(pcbBoardChoices({ pages, elements: [outline, testBoard()] })).toEqual([
    { boardId: "board", pageName: PCB_TEST_PAGE.name },
  ]);
});

test("includes hidden pages and follows fractional page order", () => {
  const first = {
    ...PCB_TEST_PAGE,
    id: "z",
    order: "A",
    hiddenInPresentation: true,
  };
  const second = { ...PCB_TEST_PAGE, id: "a", order: "B" };
  const board = testBoard();
  const choices = pcbBoardChoices({
    pages: [second, first],
    elements: [
      { ...board, id: "second", page: second.id },
      { ...board, page: first.id },
    ],
  });
  expect(choices.map(({ boardId }) => boardId)).toEqual(["board", "second"]);
  expect(pcbBoardOptions(choices)).toEqual([
    { value: "board", label: "Circuit (1)" },
    { value: "second", label: "Circuit (2)" },
  ]);
});
