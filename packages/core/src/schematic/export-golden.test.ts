import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "bun:test";
import {
  exportSchematicKicadNetlist,
  exportSchematicNetlistText,
  parseDocument,
  serializeDocument,
} from "@nodetto/io";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { renderPageSvg } from "../svg-export.ts";
import { computeSchematicConnectivity } from "./connectivity.ts";
import { lintSchematicPage } from "./erc.ts";
import { toSchematicNetlist } from "./netlist.ts";

const root = resolve(import.meta.dir, "../../../../");
const readText = (path: string) => readFileSync(resolve(root, path), "utf8");
const source = readText("examples/schematic/led-switch.jsonl");
const document = parseDocument(source);
const page = document.pages.find(({ kind }) => kind === "schematic");
if (!page) throw new Error("schematic example page is missing");
const pageId = page.id;
const connectivity = computeSchematicConnectivity(document, pageId);
const netlist = toSchematicNetlist(document, pageId, connectivity);

test("example is canonical and has clean lint and expected nets", () => {
  expect(serializeDocument(document)).toBe(source);
  expect(lintSchematicPage(document, pageId)).toEqual([]);
  expect(netlist.nets.map(({ name }) => name).sort()).toEqual(
    ["GND", "SW_OUT", "VCC", "N_R1_2"].sort(),
  );
  expect(
    netlist.nets.map(({ name, nodes }) => [
      name,
      nodes.map(({ reference, pin }) => `${reference}.${pin}`),
    ]),
  ).toEqual([
    ["VCC", ["BT1.1", "SW1.1"]],
    ["GND", ["BT1.2", "C1.2", "D1.2"]],
    ["SW_OUT", ["C1.1", "R1.1", "SW1.2"]],
    ["N_R1_2", ["D1.1", "R1.2"]],
  ]);
});

test("netlist exports match the checked-in goldens", () => {
  expect(exportSchematicNetlistText(netlist).text).toBe(
    readText("examples/schematic/led-switch.netlist.txt"),
  );
  expect(exportSchematicKicadNetlist(netlist).text).toBe(
    readText("examples/schematic/led-switch.net"),
  );
});

test("light and dark SVG retain the junction and five part bodies", () => {
  for (const ink of ["#111111", "#eeeeee"]) {
    const svg = renderPageSvg(
      new Store(document),
      createDefaultRegistry(),
      pageId,
      { padding: 0, theme: { ink } },
    );
    if (!svg) throw new Error("expected schematic SVG");
    const count = (role: string) =>
      svg.split(`class="schematic-${role}"`).length - 1;
    expect(count("junction")).toBe(1);
    expect(count("battery-cell")).toBe(2);
    expect(count("switch")).toBe(2);
    expect(count("resistor")).toBe(1);
    expect(count("diode")).toBe(2);
    expect(count("capacitor-plate")).toBe(2);
    expect(svg).toContain(`stroke="${ink}"`);
  }
});
