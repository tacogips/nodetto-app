import { expect, test } from "bun:test";
import {
  Editor,
  breadboardNetMembers,
  computeBreadboardConnectivity,
  toBreadboardNetlist,
} from "@nodetto/core";
import type { Document, Element, Page } from "@nodetto/ir";
import {
  E24_VALUES,
  breadboardNetProbe,
  breadboardPinRows,
  resistorValueSuggestions,
  targetNetProbe,
  targetPartProbe,
  writeBreadboardSemantic,
} from "./breadboard-edits.ts";

const PAGE: Page = { id: "board-page", name: "Board", kind: "breadboard" };
const board: Element = {
  id: "board",
  page: PAGE.id,
  type: "breadboard.board",
  index: "a1",
  semantic: { size: "half" },
  visual: { x: 0, y: 0 },
};
const led: Element = {
  id: "led",
  page: PAGE.id,
  type: "breadboard.led",
  index: "a2",
  semantic: { reference: "D1", value: "red", color: "red" },
  visual: { x: 15, y: 45, width: 20, height: 20 },
};
const resistor: Element = {
  id: "resistor",
  page: PAGE.id,
  type: "breadboard.resistor",
  index: "a3",
  semantic: { reference: "R1", value: "220", span: 4, bands: 4 },
  visual: { x: 100, y: 100, width: 40, height: 10 },
};
const ic: Element = {
  id: "ic",
  page: PAGE.id,
  type: "breadboard.ic",
  index: "a5",
  semantic: { reference: "U1", value: "IC", pinCount: 8 },
  visual: { x: 200, y: 100, width: 80, height: 40 },
};
const target: Element = {
  id: "target",
  page: PAGE.id,
  type: "breadboard.netlist",
  index: "a4",
  semantic: {
    source: "circuit.net",
    format: "kicad_net",
    parts: [
      { reference: "D1", value: "red", type: "breadboard.led" },
      { reference: "R1", value: "220", type: "breadboard.resistor" },
    ],
    nets: [
      {
        name: "LED_NET",
        nodes: [
          { reference: "D1", pin: 1 },
          { reference: "R1", pin: 2 },
        ],
      },
    ],
  },
  visual: { x: 0, y: 240 },
};

function documentWith(elements: readonly Element[] = [board, led]): Document {
  return {
    schemaVersion: 1,
    id: "doc",
    title: "Test",
    pages: [PAGE],
    elements,
  };
}

test("E24 values and resistor suggestions cover scaled decades", () => {
  expect(E24_VALUES).toHaveLength(24);
  const suggestions = resistorValueSuggestions("4");
  expect(suggestions).toContain("4.7");
  expect(suggestions).toContain("4.7k");
  expect(suggestions.length).toBeLessThanOrEqual(12);
});

test("LED pin rows use the shared netlist names", () => {
  const document = documentWith();
  const connectivity = computeBreadboardConnectivity(document, PAGE.id);
  const netlist = toBreadboardNetlist(document, PAGE.id, connectivity);
  const rows = breadboardPinRows(document, PAGE.id, led.id);
  expect(rows.map(({ pin, name }) => ({ pin, name }))).toEqual([
    { pin: 1, name: "A" },
    { pin: 2, name: "K" },
  ]);
  expect(rows.map((row) => row.net)).toEqual(
    rows.map(
      (row) =>
        netlist.nets.find((net) =>
          net.nodes.some(
            (node) => node.reference === "D1" && node.pin === row.pin,
          ),
        )?.name ?? "",
    ),
  );
});

test("a pin net probe selects breadboardNetMembers and keeps the pin", () => {
  const document = documentWith();
  const probe = breadboardNetProbe(document, PAGE.id, {
    elementId: led.id,
    pin: 1,
  });
  const connectivity = computeBreadboardConnectivity(document, PAGE.id);
  const members = breadboardNetMembers(document, PAGE.id, connectivity, {
    elementId: led.id,
    pin: 1,
  });
  expect(probe.elementIds).toEqual(members);
  expect(probe.elementIds).toContain(led.id);
  expect(probe.pin).toEqual({ elementId: led.id, pin: 1 });
});

test("target net probes resolved parts and its first valid pin", () => {
  const document = documentWith([board, led, resistor, target]);
  expect(targetNetProbe(document, PAGE.id, "LED_NET")).toEqual({
    pageId: PAGE.id,
    elementIds: [led.id, resistor.id],
    pin: { elementId: led.id, pin: 1 },
  });
  expect(targetNetProbe(document, PAGE.id, "UNKNOWN")).toBeNull();
});

test("target part probes resolve target references and ignore missing parts", () => {
  const document = documentWith([board, led, target]);
  expect(targetPartProbe(document, PAGE.id, "D1")).toEqual({
    pageId: PAGE.id,
    elementIds: [led.id],
  });
  expect(targetPartProbe(document, PAGE.id, "R1")).toBeNull();
  expect(targetPartProbe(document, PAGE.id, "R9")).toBeNull();
});

test("invalid semantic writes return false and valid writes apply", () => {
  const editor = new Editor({ document: documentWith([board, led, ic]) });

  expect(writeBreadboardSemantic(editor, ic.id, { pinCount: 7 })).toBe(false);
  expect(editor.store.get(ic.id)?.semantic).toMatchObject({ pinCount: 8 });

  expect(writeBreadboardSemantic(editor, led.id, { reference: "" })).toBe(
    false,
  );
  expect(editor.store.get(led.id)?.semantic).toMatchObject({ reference: "D1" });

  expect(writeBreadboardSemantic(editor, ic.id, { pinCount: 10 })).toBe(true);
  expect(editor.store.get(ic.id)?.semantic).toMatchObject({ pinCount: 10 });
});
