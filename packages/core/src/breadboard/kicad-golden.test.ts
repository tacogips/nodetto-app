import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "bun:test";
import { importKicad, parseDocument } from "@nodetto/io";
import { BREADBOARD_PART_TYPES } from "@nodetto/ir";
import {
  computeBreadboardConnectivity,
  computeBreadboardRatsnest,
  layoutBreadboardImport,
  lintBreadboardPage,
} from "@nodetto/core";
import { breadboardPins } from "./catalogue.ts";

const root = resolve(import.meta.dir, "../../../../");
const readText = (path: string) => readFileSync(resolve(root, path), "utf8");
const example = parseDocument(readText("examples/breadboard/led-button.jsonl"));
const examplePage = example.pages.find(({ kind }) => kind === "breadboard");
if (!examplePage) throw new Error("breadboard example page is missing");
const partSignature = (document: typeof example) =>
  document.elements
    .filter((element) =>
      BREADBOARD_PART_TYPES.includes(
        element.type as (typeof BREADBOARD_PART_TYPES)[number],
      ),
    )
    .map((element) => ({
      reference: (element.semantic as { reference: string }).reference,
      value: (element.semantic as { value: string }).value,
      type: element.type as (typeof BREADBOARD_PART_TYPES)[number],
    }))
    .sort((a, b) => a.reference.localeCompare(b.reference));
const targetElement = (
  target: NonNullable<ReturnType<typeof importKicad>["plan"]>["target"],
) =>
  ({
    id: "target-netlist",
    page: examplePage.id,
    type: "breadboard.netlist",
    index: "z999",
    semantic: target,
    visual: { x: 400, y: 0 },
  }) as const;

for (const fixtureName of ["led-button.kicad_sch", "led-button.net"]) {
  test(`${fixtureName} target matches the built example with no lint findings`, () => {
    const imported = importKicad(
      readText(`test-fixtures/kicad/${fixtureName}`),
      {
        fileName: fixtureName,
      },
    );
    expect(imported.plan).toBeDefined();
    if (!imported.plan) return;
    const document = {
      ...example,
      elements: [...example.elements, targetElement(imported.plan.target)],
    };
    expect(lintBreadboardPage(document, examplePage.id)).toEqual([]);
  });
}

test("our KiCad golden imports back to the example parts and net partition", () => {
  const imported = importKicad(readText("examples/breadboard/led-button.net"), {
    fileName: "led-button.net",
  });
  expect(imported.plan).toBeDefined();
  if (!imported.plan) return;
  const actualConnectivity = computeBreadboardConnectivity(
    example,
    examplePage.id,
  );
  const actualPartition = new Set<string>();
  for (const net of actualConnectivity.nets) {
    const refs = net.pins.map(({ elementId, pin }) => {
      const part = example.elements.find(({ id }) => id === elementId);
      return `${(part?.semantic as { reference?: string }).reference}.${pin}`;
    });
    actualPartition.add(refs.sort().join("|"));
  }
  const importedPartition = new Set(
    imported.plan.target.nets.map((net) =>
      net.nodes
        .map(({ reference, pin }) => `${reference}.${pin}`)
        .sort()
        .join("|"),
    ),
  );
  expect(importedPartition).toEqual(actualPartition);
  expect(imported.plan.target.nets.map(({ name }) => name).sort()).toEqual(
    ["GND", "VCC", "N_D1_1", "N_R1_1"].sort(),
  );
  expect(
    imported.plan.parts.map(({ reference, value, type }) => ({
      reference,
      value,
      type,
    })),
  ).toEqual(partSignature(example));
});

test("staged import ratsnest clears after placing parts and wires", () => {
  const imported = importKicad(readText("test-fixtures/kicad/led-button.net"), {
    fileName: "led-button.net",
  });
  expect(imported.plan).toBeDefined();
  if (!imported.plan) return;
  const staged = layoutBreadboardImport(imported.plan);
  const stagedPage = staged.pages[0];
  if (!stagedPage) throw new Error("staged page is missing");
  const stagedConnectivity = computeBreadboardConnectivity(
    staged,
    stagedPage.id,
  );
  expect(
    computeBreadboardRatsnest(staged, stagedPage.id, stagedConnectivity).length,
  ).toBeGreaterThan(0);
  const exampleParts = new Map(
    example.elements
      .filter((element) =>
        BREADBOARD_PART_TYPES.includes(
          element.type as (typeof BREADBOARD_PART_TYPES)[number],
        ),
      )
      .map((element) => [
        (element.semantic as { reference: string }).reference,
        element,
      ]),
  );
  const placed = {
    ...staged,
    elements: staged.elements
      .map((element) => {
        const reference = (element.semantic as { reference?: string })
          .reference;
        const source = reference ? exampleParts.get(reference) : undefined;
        return source &&
          BREADBOARD_PART_TYPES.includes(
            element.type as (typeof BREADBOARD_PART_TYPES)[number],
          )
          ? { ...element, visual: source.visual }
          : element;
      })
      .concat(
        example.elements
          .filter((element) => element.type === "breadboard.wire")
          .map((wire, index) => ({
            ...wire,
            id: `placed-wire-${index + 1}`,
            page: stagedPage.id,
            index: `zz${index}`,
          })),
      ),
  };
  const placedConnectivity = computeBreadboardConnectivity(
    placed,
    stagedPage.id,
  );
  expect(
    computeBreadboardRatsnest(placed, stagedPage.id, placedConnectivity),
  ).toEqual([]);
  expect(
    lintBreadboardPage(placed, stagedPage.id).map(({ ruleId }) => ruleId),
  ).not.toContain("parity-missing-connection");
});

test("example part pins remain on the shared hole lattice", () => {
  for (const element of example.elements) {
    if (
      !BREADBOARD_PART_TYPES.includes(
        element.type as (typeof BREADBOARD_PART_TYPES)[number],
      )
    )
      continue;
    for (const pin of breadboardPins(element)) {
      expect(pin.x % 10).toBe(0);
      expect(pin.y % 10).toBe(0);
    }
  }
});
