import { describe, expect, test } from "bun:test";
import { PAGE_KINDS } from "./types.ts";
import { getElementTypeDefinition } from "./registry.ts";
import {
  BREADBOARD_ELEMENT_TYPES,
  BREADBOARD_PART_TYPES,
  compareReferences,
  isBreadboardPartType,
  parseComponentValue,
} from "./index.ts";

const examples: ReadonlyArray<readonly [string, unknown]> = [
  ["breadboard.board", { size: "half" }],
  [
    "breadboard.wire",
    {
      color: "red",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    },
  ],
  ["breadboard.resistor", { reference: "R1", value: "220", span: 4, bands: 4 }],
  ["breadboard.led", { reference: "D1", value: "red", color: "red" }],
  [
    "breadboard.capacitor",
    { reference: "C1", value: "100n", style: "ceramic", span: 1 },
  ],
  ["breadboard.diode", { reference: "D2", value: "1N4148", span: 4 }],
  [
    "breadboard.transistor",
    { reference: "Q1", value: "NPN", polarity: "npn", pinout: "EBC" },
  ],
  ["breadboard.button", { reference: "SW1", value: "PUSH" }],
  ["breadboard.potentiometer", { reference: "RV1", value: "10k" }],
  ["breadboard.ic", { reference: "U1", value: "IC", pinCount: 8 }],
  ["breadboard.header", { reference: "J1", value: "HEADER", pinCount: 4 }],
  ["breadboard.battery", { reference: "BT1", value: "5V" }],
  [
    "breadboard.netlist",
    {
      source: "board.net",
      format: "kicad_net",
      parts: [{ reference: "R1", value: "220", type: "breadboard.resistor" }],
      nets: [{ name: "GND", nodes: [{ reference: "R1", pin: 1 }] }],
    },
  ],
];

function issues(type: string, semantic: unknown) {
  return (
    getElementTypeDefinition(type)?.validateSemantic(semantic, "semantic") ?? []
  );
}

describe("breadboard IR", () => {
  test("validates all 13 structural payloads and rejects bad enums", () => {
    for (const [type, semantic] of examples) {
      expect(issues(type, semantic)).toEqual([]);
      const field =
        type === "breadboard.board"
          ? "size"
          : type === "breadboard.wire"
            ? "color"
            : type === "breadboard.led"
              ? "color"
              : type === "breadboard.capacitor"
                ? "style"
                : type === "breadboard.transistor"
                  ? "polarity"
                  : type === "breadboard.netlist"
                    ? "format"
                    : undefined;
      if (field)
        expect(
          issues(type, {
            ...(semantic as Record<string, unknown>),
            [field]: "invalid",
          }).some((issue) => issue.path === `semantic.${field}`),
        ).toBe(true);
    }
  });

  test("validates IC counts, wire points and netlist pins and types", () => {
    expect(
      issues("breadboard.ic", { reference: "U1", value: "", pinCount: 7 }).map(
        (item) => item.code,
      ),
    ).toContain("breadboard.pinCountOdd");
    expect(
      issues("breadboard.ic", { reference: "U1", value: "", pinCount: 42 })
        .length,
    ).toBeGreaterThan(0);
    expect(
      issues("breadboard.wire", { color: "red", points: [{ x: 0, y: 0 }] }).map(
        (item) => item.code,
      ),
    ).toContain("breadboard.wirePoints");
    const base = {
      source: "net",
      format: "kicad_net",
      parts: [],
      nets: [{ name: "N", nodes: [{ reference: "R1", pin: 0 }] }],
    };
    expect(
      issues("breadboard.netlist", {
        ...base,
        parts: [{ reference: "X1", value: "", type: "breadboard.board" }],
      }).length,
    ).toBeGreaterThan(0);
    expect(issues("breadboard.netlist", base).length).toBeGreaterThan(0);
  });

  test("parses component values and SI prefixes", () => {
    const values: ReadonlyArray<readonly [string, number | undefined]> = [
      ["220", 220],
      ["4.7k", 4700],
      ["4k7", 4700],
      ["10u", 1e-5],
      ["10\u00b5", 1e-5],
      ["100n", 1e-7],
      ["1M", 1e6],
      ["1m", 0.001],
      ["2R2", 2.2],
      ["1R", 1],
      ["1R", 1],
      ["0R", 0],
      ["5V", 5],
      [" 10k ", 10000],
      ["220ohm", 220],
      ["abc", undefined],
      ["", undefined],
      ["1..2", undefined],
    ];
    for (const [text, expected] of values)
      expect(parseComponentValue(text)).toBe(expected);
  });

  test("sorts references naturally and exposes pinned type collections", () => {
    expect(["R10", "R2", "R?", "C1", "R1"].sort(compareReferences)).toEqual([
      "C1",
      "R1",
      "R2",
      "R10",
      "R?",
    ]);
    expect(isBreadboardPartType("breadboard.wire")).toBe(false);
    expect(BREADBOARD_ELEMENT_TYPES).toHaveLength(13);
    expect(BREADBOARD_PART_TYPES).toHaveLength(10);
    expect(PAGE_KINDS).toContain("breadboard");
  });
});
