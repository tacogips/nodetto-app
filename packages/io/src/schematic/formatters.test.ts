import { expect, test } from "bun:test";
import type { SchematicNetlist } from "@nodetto/ir";
import {
  exportSchematicKicadNetlist,
  exportSchematicNetlistText,
} from "./index.ts";

const input: SchematicNetlist = {
  pageId: "page",
  pageName: "Main page",
  documentTitle: "Example",
  components: [
    {
      elementId: "a",
      type: "schematic.resistor",
      reference: "R1",
      value: "1 k",
      partName: "Resistor",
      description: "resistor",
      footprint: "",
      pins: [],
    },
    {
      elementId: "b",
      type: "schematic.switch",
      reference: "SW1",
      value: "",
      partName: "SW_Push",
      description: "button",
      footprint: "",
      pins: [],
    },
  ],
  nets: [
    {
      code: 1,
      name: "GND",
      nodes: [{ reference: "R1", pin: 1, pinName: "1" }],
    },
    {
      code: 2,
      name: 'a"b\\c#',
      nodes: [{ reference: "SW1", pin: 2, pinName: "2" }],
    },
  ],
};

test("formats a versioned schematic netlist with escaped tokens", () => {
  expect(exportSchematicNetlistText(input)).toEqual({
    text: '# nodetto schematic netlist 1\n# document Example\n# page "Main page"\ncomponent R1 "1 k" Resistor\ncomponent SW1 "" SW_Push\nnet 1 GND R1.1\nnet 2 "a\\"b\\\\c#" SW1.2\n',
    warnings: [],
  });
});

test("reports duplicate and unannotated references", () => {
  const first = input.components[0];
  if (!first) throw new Error("missing fixture");
  const report = exportSchematicNetlistText({
    ...input,
    components: [first, first, { ...first, reference: "R?" }],
  });
  expect(report.warnings).toEqual([
    "R1: duplicate reference",
    "R1: duplicate reference",
    "R?: unannotated reference",
  ]);
});

test("writes schematic components through the KiCad writer", () => {
  const report = exportSchematicKicadNetlist(input);
  expect(report.text).toContain('(libsource (lib "nodetto") (part "SW_Push")');
  expect(report.text).toContain('(footprint "")');
});
