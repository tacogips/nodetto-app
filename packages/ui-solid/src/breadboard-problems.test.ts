import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import type { Document, Element, Page } from "@nodetto/ir";
import {
  breadboardProblemRows,
  canFixBreadboardReferences,
  focusBreadboardProbe,
} from "./breadboard-problems.ts";

const PAGE: Page = { id: "board-page", name: "Board", kind: "breadboard" };
const board: Element = {
  id: "board",
  page: PAGE.id,
  type: "breadboard.board",
  index: "a1",
  semantic: { size: "half" },
  visual: { x: 0, y: 0 },
};
const part = (id: string, reference: string, index: string): Element => ({
  id,
  page: PAGE.id,
  type: "breadboard.resistor",
  index,
  semantic: { reference, value: "220", span: 4, bands: 4 },
  visual: { x: 100, y: 100, width: 40, height: 10 },
});
const documentWith = (elements: readonly Element[] = [board]): Document => ({
  schemaVersion: 1,
  id: "doc",
  title: "Test",
  pages: [PAGE],
  elements,
});

test("lists duplicate references and exposes the repair action state", () => {
  const first = part("r1", "R1", "a2");
  const second = part("r2", "R1", "a3");
  const document = documentWith([board, first, second]);
  const row = breadboardProblemRows(document, PAGE.id).find(
    (candidate) => candidate.ruleId === "duplicate-reference",
  );
  expect(row?.reference).toBe("R1");
  expect(row?.chips).toEqual([{ elementId: "r2", reference: "R1" }]);
  expect(canFixBreadboardReferences(document, PAGE.id)).toBe(true);
});

test("rail-short findings include affected part chips", () => {
  const resistor = {
    ...part("r1", "R1", "a2"),
    visual: { x: 15, y: 15, width: 40, height: 10 },
  };
  const wire: Element = {
    id: "rail-wire",
    page: PAGE.id,
    type: "breadboard.wire",
    index: "a3",
    semantic: {
      color: "red",
      points: [
        { x: 0, y: 0 },
        { x: 0, y: -10 },
      ],
    },
    visual: { x: 20, y: 20 },
  };
  const row = breadboardProblemRows(
    documentWith([board, resistor, wire]),
    PAGE.id,
  ).find((candidate) => candidate.ruleId === "rail-short");
  expect(row?.elementId).toBe("r1");
  expect(row?.chips).toEqual([{ elementId: "r1", reference: "R1" }]);
});

test("lists ERC and parity findings in lint order with part chips", () => {
  const first = part("r1", "R1", "a2");
  const second = part("d1", "D1", "a3");
  const target: Element = {
    id: "target",
    page: PAGE.id,
    type: "breadboard.netlist",
    index: "a4",
    semantic: {
      source: "test.net",
      format: "kicad_net",
      parts: [
        { reference: "R1", value: "220", pins: [{ number: 1, name: "1" }] },
        { reference: "D1", value: "red", pins: [{ number: 1, name: "A" }] },
      ],
      nets: [
        {
          name: "N_SIGNAL",
          nodes: [
            { reference: "R1", pin: 1 },
            { reference: "D1", pin: 1 },
          ],
        },
      ],
    },
    visual: { x: 0, y: 120 },
  };
  const rows = breadboardProblemRows(
    documentWith([board, first, second, target]),
    PAGE.id,
  );
  const parity = rows.find(
    (candidate) => candidate.ruleId === "parity-missing-connection",
  );
  expect(parity?.elementIds).toEqual(["d1", "r1"]);
  expect(parity?.chips).toEqual([
    { elementId: "d1", reference: "D1" },
    { elementId: "r1", reference: "R1" },
  ]);
  expect(rows.some((candidate) => candidate.ruleId === "pin-not-in-hole")).toBe(
    true,
  );
});

test("cross-probes selection and pin after switching pages", () => {
  const otherPage: Page = { id: "other", name: "Other", kind: "freeform" };
  const element = part("r1", "R1", "a2");
  const editor = new Editor({
    document: {
      ...documentWith([element]),
      pages: [otherPage, PAGE],
    },
  });
  editor.setCurrentPage(otherPage.id);
  const probe = {
    pageId: PAGE.id,
    elementIds: [element.id],
    pin: { elementId: element.id, pin: 1 },
  };
  expect(editor.currentPageId).toBe(otherPage.id);
  expect(editor.breadboardProbe()).toBeNull();
  expect(focusBreadboardProbe(editor, probe)).toBe(true);
  expect(editor.currentPageId).toBe(PAGE.id);
  expect([...editor.selection.ids()]).toEqual([element.id]);
  expect(editor.breadboardProbe()).toEqual(probe);
});

test("returns false without changing selection when all probed ids are gone", () => {
  const editor = new Editor({ document: documentWith([board]) });
  editor.selection.set([board.id]);
  const before = [...editor.selection.ids()];
  expect(
    focusBreadboardProbe(editor, { pageId: PAGE.id, elementIds: ["deleted"] }),
  ).toBe(false);
  expect([...editor.selection.ids()]).toEqual(before);
});

test("clean and non-breadboard pages have no rows or reference repair", () => {
  expect(breadboardProblemRows(documentWith(), PAGE.id)).toEqual([]);
  expect(canFixBreadboardReferences(documentWith(), PAGE.id)).toBe(false);
  const plain: Page = { id: "plain", name: "Plain", kind: "freeform" };
  const document = { ...documentWith(), pages: [plain] };
  expect(breadboardProblemRows(document, plain.id)).toEqual([]);
  expect(canFixBreadboardReferences(document, plain.id)).toBe(false);
});
