import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "bun:test";
import { parseDocument } from "@nodetto/io";
import {
  computeBreadboardConnectivity,
  createDefaultRegistry,
  lintBreadboardPage,
  renderPageSvg,
  Store,
  toBreadboardNetlist,
} from "@nodetto/core";
import {
  exportBreadboardBomCsv,
  exportBreadboardKicadNetlist,
  exportBreadboardSpiceNetlist,
} from "@nodetto/io";
import { readIndependently } from "../pcb/oracle.test-support.ts";
import {
  legendClearanceErrors,
  validateExcellon,
  validateGerber,
} from "../pcb/validate.ts";
import { BREADBOARD_PCB_RULES, exportBreadboardPcb } from "./pcb.ts";
import { BREADBOARD_ERC_RULE_IDS } from "./types.ts";

const root = resolve(import.meta.dir, "../../../../");
const readText = (path: string) => readFileSync(resolve(root, path), "utf8");
const examplePath = "examples/breadboard/led-button.jsonl";
const document = parseDocument(readText(examplePath));
const page = document.pages.find(({ kind }) => kind === "breadboard");
if (!page) throw new Error("breadboard example page is missing");
const pageId = page.id;
const connectivity = computeBreadboardConnectivity(document, pageId);
const netlist = toBreadboardNetlist(document, pageId, connectivity);

function svgForExample(): string {
  const store = new Store(document);
  const svg = renderPageSvg(store, createDefaultRegistry(), pageId, {
    padding: 0,
  });
  if (svg === null) throw new Error("expected breadboard SVG");
  return svg;
}

test("example JSONL has clean breadboard lint and the fixed net names", () => {
  expect(lintBreadboardPage(document, pageId)).toEqual([]);
  expect(netlist.nets.map(({ name }) => name).sort()).toEqual(
    ["GND", "VCC", "N_D1_1", "N_R1_1"].sort(),
  );
  expect(netlist.components.map(({ reference }) => reference)).toEqual([
    "BT1",
    "D1",
    "R1",
    "SW1",
  ]);
});

test("BOM CSV matches the checked-in golden", () => {
  expect(exportBreadboardBomCsv(netlist).text).toBe(
    readText("examples/breadboard/led-button.bom.csv"),
  );
});

test("KiCad netlist matches the checked-in golden", () => {
  expect(exportBreadboardKicadNetlist(netlist).text).toBe(
    readText("examples/breadboard/led-button.net"),
  );
});

test("SPICE netlist matches the checked-in golden", () => {
  expect(exportBreadboardSpiceNetlist(netlist).text).toBe(
    readText("examples/breadboard/led-button.cir"),
  );
});

test("example SVG keeps the half-board and original part notation", () => {
  const svg = svgForExample();
  expect(svg.split('class="breadboard-board-hole"').length - 1).toBe(400);
  expect(svg.split('class="breadboard-resistor-band-').length - 1).toBe(4);
  expect(svg.split('class="breadboard-led-flat"').length - 1).toBe(1);
  expect(BREADBOARD_ERC_RULE_IDS).toHaveLength(13);
});

test("PCB Gerber and drill files match the checked-in goldens", () => {
  const pcb = exportBreadboardPcb(document, pageId, { name: "led-button" });
  if (typeof pcb === "string") throw new Error(pcb);
  // The example puts two leads in e7 and e11 on purpose (user QA Q2).
  expect(pcb.warnings).toHaveLength(2);
  for (const file of pcb.files) {
    expect(file.text).toBe(readText(`examples/breadboard/${file.path}`));
    const drill = file.path.endsWith(".DRL");
    expect(
      drill ? validateExcellon(file.text, pcb) : validateGerber(file.text, pcb),
    ).toEqual([]);
    expect(
      readIndependently(file.text, drill ? "drill" : "gerber").warnings,
    ).toEqual([]);
  }
  const text = (extension: string) =>
    pcb.files.find((file) => file.path === `led-button.${extension}`)?.text ??
    "";
  expect(
    legendClearanceErrors({
      gto: text("GTO"),
      gts: text("GTS"),
      outline: pcb,
      padClearance: BREADBOARD_PCB_RULES.legendPadClearance,
      edgeClearance: BREADBOARD_PCB_RULES.legendEdgeClearance,
    }),
  ).toEqual([]);
});
