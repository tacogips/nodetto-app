import { describe, expect, test } from "bun:test";
import { computeBreadboardConnectivity } from "./connectivity.ts";
import { lintBreadboardPage } from "./erc.ts";
import { buildBreadboardDocument } from "./test-builder.ts";
import {
  breadboardParityFindings,
  breadboardTargetStatus,
  resolveBreadboardReference,
} from "./parity.ts";
import type { BreadboardErcRuleId } from "./types.ts";

const PAGE = "breadboard-page";
function targetPart(reference: string, value: string, pinNumbers = [1, 2]) {
  return {
    reference,
    value,
    pins: pinNumbers.map((number) => ({ number, name: String(number) })),
  };
}

const targetParts = [targetPart("R1", "4.7k"), targetPart("D1", "red")];
const twoNetTarget = {
  parts: targetParts,
  nets: [
    { name: "N_LEFT", nodes: [{ reference: "R1", pin: 1 }] },
    { name: "N_RIGHT", nodes: [{ reference: "D1", pin: 1 }] },
  ],
};

function findings(document: ReturnType<typeof buildBreadboardDocument>) {
  return breadboardParityFindings(
    document,
    PAGE,
    computeBreadboardConnectivity(document, PAGE),
  );
}

function rules(document: ReturnType<typeof buildBreadboardDocument>) {
  return findings(document).map((item) => item.ruleId);
}

function part(id: string, reference: string, value = "4k7") {
  return {
    id,
    type: reference.startsWith("D")
      ? ("breadboard.led" as const)
      : ("breadboard.resistor" as const),
    reference,
    value,
    pin1: { x: id === "r1" ? 20 : 40, y: 50 },
  };
}

describe("breadboard schematic parity", () => {
  test("disables parity without a target card", () => {
    const document = buildBreadboardDocument({ parts: [part("r1", "R1")] });
    expect(findings(document)).toEqual([]);
  });

  test("reports a missing target connection and clears it when routed", () => {
    const document = buildBreadboardDocument({
      parts: [part("r1", "R1"), part("d1", "D1", "red")],
      netlist: {
        parts: targetParts,
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
    });
    const missing = findings(document).find(
      (item) => item.ruleId === "parity-missing-connection",
    );
    expect(missing?.severity).toBe("warning");
    expect(missing?.elementId).toBe("d1");
    expect(missing?.elementIds).toEqual(["d1", "r1"]);
    expect(missing?.message).toContain("N_SIGNAL");
    const routed = {
      ...document,
      elements: document.elements.map((element) =>
        element.id === "d1"
          ? { ...element, visual: { ...element.visual, x: 15 } }
          : element,
      ),
    };
    expect(rules(routed)).not.toContain("parity-missing-connection");
  });

  test("reports extra connections as errors and lists merged nets", () => {
    const document = buildBreadboardDocument({
      parts: [part("r1", "R1"), part("d1", "D1", "red")],
      wires: [
        {
          id: "wire",
          points: [
            { x: 20, y: 50 },
            { x: 40, y: 50 },
          ],
        },
      ],
      netlist: twoNetTarget,
    });
    const extra = findings(document).find(
      (item) => item.ruleId === "parity-extra-connection",
    );
    expect(extra?.severity).toBe("error");
    expect(extra?.elementId).toBe("d1");
    expect(extra?.elementIds).toEqual(["r1", "d1"]);
    expect(extra?.message).toContain("N_LEFT, N_RIGHT");
    expect(
      rules(
        buildBreadboardDocument({
          parts: [part("r1", "R1"), part("d1", "D1", "red")],
          netlist: twoNetTarget,
        }),
      ),
    ).not.toContain("parity-extra-connection");
  });

  test("uses target membership for unlisted bonded button pins", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "button",
          type: "breadboard.button",
          reference: "SW1",
          value: "PUSH",
          pin1: { x: 20, y: 50 },
        },
      ],
      netlist: {
        parts: [targetPart("SW1", "PUSH", [1, 3])],
        nets: [
          { name: "N_LEFT", nodes: [{ reference: "SW1", pin: 1 }] },
          { name: "N_RIGHT", nodes: [{ reference: "SW1", pin: 3 }] },
        ],
      },
    });
    expect(rules(document)).not.toContain("parity-extra-connection");
  });

  test("reports missing and extra parts, suppressing duplicate extra references", () => {
    const document = buildBreadboardDocument({
      parts: [
        part("r1", "R1"),
        part("d1", "D1", "red"),
        { ...part("r2", "R9"), pin1: { x: 60, y: 50 } },
        { ...part("r3", "R9"), pin1: { x: 80, y: 50 } },
      ],
      netlist: {
        parts: [...targetParts, targetPart("C1", "10u")],
        nets: [],
      },
    });
    const parity = findings(document);
    expect(
      parity.find((item) => item.ruleId === "parity-missing-part")?.message,
    ).toContain("C1 (10u)");
    expect(
      parity
        .filter((item) => item.ruleId === "parity-extra-part")
        .map((item) => item.elementId),
    ).toEqual(["r2"]);
    expect(
      parity.find((item) => item.ruleId === "parity-missing-part")?.elementId,
    ).toBe("target-netlist");
    const allPlaced = buildBreadboardDocument({
      parts: [
        part("r1", "R1"),
        part("d1", "D1", "red"),
        { ...part("c1", "C1", "10u"), type: "breadboard.capacitor" as const },
        { ...part("r9", "R9"), pin1: { x: 60, y: 50 } },
      ],
      netlist: {
        parts: [
          ...targetParts,
          targetPart("C1", "10u"),
          targetPart("R9", "4k7"),
        ],
        nets: [],
      },
    });
    expect(rules(allPlaced)).not.toContain("parity-missing-part");
    expect(rules(allPlaced)).not.toContain("parity-extra-part");
  });

  test("compares parsed component values and case-folds nonnumeric values", () => {
    const equivalent = buildBreadboardDocument({
      parts: [part("r1", "R1", "4k7"), part("d1", "D1", "1n4148")],
      netlist: {
        parts: [targetPart("R1", "4.7k"), targetPart("D1", "1N4148")],
        nets: [],
      },
    });
    expect(rules(equivalent)).not.toContain("parity-value-mismatch");
    const mismatch = buildBreadboardDocument({
      parts: [part("r1", "R1", "330")],
      netlist: {
        parts: [targetPart("R1", "220")],
        nets: [],
      },
    });
    expect(
      findings(mismatch).find((item) => item.ruleId === "parity-value-mismatch")
        ?.message,
    ).toContain("330");
  });

  test("reports all rule ids and exposes ordered target status", () => {
    const document = buildBreadboardDocument({
      parts: [
        part("r1", "R1", "330"),
        part("d1", "D1", "red"),
        { ...part("r9", "R9"), pin1: { x: 60, y: 50 } },
      ],
      netlist: {
        parts: [...targetParts, targetPart("C1", "10u")],
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
    });
    const expected: BreadboardErcRuleId[] = [
      "parity-missing-connection",
      "parity-extra-connection",
      "parity-missing-part",
      "parity-extra-part",
      "parity-value-mismatch",
    ];
    const mergedNets = buildBreadboardDocument({
      parts: [part("r1", "R1"), part("d1", "D1", "red")],
      wires: [
        {
          id: "wire",
          points: [
            { x: 20, y: 50 },
            { x: 40, y: 50 },
          ],
        },
      ],
      netlist: twoNetTarget,
    });
    const observed = new Set([...rules(document), ...rules(mergedNets)]);
    expect(expected.every((id) => observed.has(id))).toBe(true);
    expect(breadboardTargetStatus(document, PAGE)).toEqual([
      {
        reference: "R1",
        value: "4.7k",
        status: "value-mismatch",
        elementId: "r1",
      },
      { reference: "D1", value: "red", status: "placed", elementId: "d1" },
      { reference: "C1", value: "10u", status: "missing" },
    ]);
    expect(resolveBreadboardReference(document, PAGE, "D1")).toBe("d1");
  });

  test("lintBreadboardPage appends and sorts parity findings with ERC findings", () => {
    const document = buildBreadboardDocument({
      parts: [part("r1", "R1"), part("d1", "D1", "red")],
      netlist: {
        parts: targetParts,
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
    });
    const all = lintBreadboardPage(document, PAGE);
    expect(
      all.some((item) => item.ruleId === "parity-missing-connection"),
    ).toBe(true);
    const order = new Map(
      document.elements.map((element, index) => [element.id, index]),
    );
    expect(all.map((item) => order.get(item.elementId) ?? -1)).toEqual(
      [...all.map((item) => order.get(item.elementId) ?? -1)].sort(
        (left, right) => left - right,
      ),
    );
  });
});
