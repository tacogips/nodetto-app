import { describe, expect, test } from "bun:test";
import { SCHEMATIC_ELEMENT_TYPES, type Element } from "@nodetto/ir";
import { schematicShapeUtils } from "../shapes/schematic.ts";
import { schematicNotation } from "./notation.ts";
import { schematicDefaultSemantic, schematicLocalBox } from "./symbols.ts";

const ink = { ink: "#111", muted: "#222", surface: "#333", accent: "#444" };
function element(
  type: string,
  semantic: unknown = {},
  visual: object = {},
): Element {
  return {
    id: "e",
    type,
    semantic,
    visual: { x: 0, y: 0, ...visual },
  } as Element;
}
const roles = [
  "resistor",
  "capacitor-plate",
  "inductor",
  "diode",
  "diode",
  "bjt-arrow",
  "mosfet-gate",
  "switch",
  "pot-wiper",
  "battery-cell",
  "source-circle",
  "connector-pin",
  "ic-body",
  "power-ground",
  "wire",
  "junction",
  "label",
  "no-connect",
];
describe("schematic notation", () => {
  test("IC body edges follow pin sides", () => {
    const ic = element(
      "schematic.ic",
      schematicDefaultSemantic("schematic.ic"),
    );
    const result = schematicNotation(ic, schematicLocalBox(ic), ink);
    const body = result.body.find((p) => p.role === "ic-body");
    expect(body?.kind).toBe("polygon");
    if (body?.kind !== "polygon") throw new Error("missing IC body");
    expect(body.points).toEqual([
      { x: 25, y: 5 },
      { x: 85, y: 5 },
      { x: 85, y: 55 },
      { x: 25, y: 55 },
      { x: 25, y: 5 },
    ]);
    expect(body.fill).toBe(ink.surface);
    expect(body.stroke).toBe(ink.ink);
    expect(body.strokeWidth).toBe(1.5);
    const pins = result.body.filter((p) => p.role === "ic-pin");
    expect(pins).toHaveLength(8);
    for (const pin of pins) {
      if (pin.kind !== "path") throw new Error("missing IC pin path");
      const end = / L ([\d.-]+) ([\d.-]+)$/.exec(pin.d);
      expect(end).not.toBeNull();
      const x = Number(end?.[1]);
      const y = Number(end?.[2]);
      expect([25, 85]).toContain(x);
      expect(y).toBeGreaterThanOrEqual(5);
      expect(y).toBeLessThanOrEqual(55);
    }
    const fourSide = element(
      "schematic.ic",
      schematicDefaultSemantic("schematic.ic", {
        pins: ["left", "right", "top", "bottom"].map((side, i) => ({
          number: i + 1,
          name: "",
          side,
        })),
      }),
    );
    const fourBody = schematicNotation(
      fourSide,
      schematicLocalBox(fourSide),
      ink,
    ).body.find((p) => p.role === "ic-body");
    expect(fourBody?.kind === "polygon" && fourBody.points).toEqual([
      { x: 25, y: 25 },
      { x: 85, y: 25 },
      { x: 85, y: 45 },
      { x: 25, y: 45 },
      { x: 25, y: 25 },
    ]);
    const empty = element("schematic.ic", { pins: [] });
    expect(
      schematicNotation(empty, schematicLocalBox(empty), ink).body,
    ).toEqual([]);
  });
  test("covers every type and its designated role", () => {
    SCHEMATIC_ELEMENT_TYPES.forEach((type, index) => {
      const part =
        index < 14
          ? schematicDefaultSemantic(
              type as Parameters<typeof schematicDefaultSemantic>[0],
            )
          : type === "schematic.wire"
            ? {
                points: [
                  { x: 0, y: 0 },
                  { x: 20, y: 0 },
                ],
              }
            : { net: "SIG" };
      const el = element(type, part);
      const box =
        index < 14
          ? schematicLocalBox(el)
          : { x: 0, y: 0, width: 20, height: 20 };
      expect(
        schematicNotation(el, box, ink).body.some(
          (p) => p.role === roles[index],
        ),
      ).toBe(true);
    });
  });
  test("mirrors body, preserves labels and uses supplied palette", () => {
    const normal = element("schematic.resistor", {
      reference: "R1",
      value: "1k",
    });
    const box = schematicLocalBox(normal);
    const a = schematicNotation(normal, box, ink);
    const b = schematicNotation(
      element(normal.type, normal.semantic, { flipX: true }),
      box,
      ink,
    );
    const pathA = a.body.find((p) => p.role === "resistor");
    const pathB = b.body.find((p) => p.role === "resistor");
    expect(pathA?.kind).toBe("path");
    if (pathA?.kind !== "path" || pathB?.kind !== "path")
      throw new Error("missing resistor");
    const coords = (d: string) =>
      [...d.matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].map((m) => [
        Number(m[1]),
        Number(m[2]),
      ]);
    expect(coords(pathB.d)).toEqual(
      coords(pathA.d).map(([x, y]) => [box.width - (x ?? 0), y]),
    );
    expect(b.labels).toEqual(a.labels);
    for (const p of a.body) expect(p.stroke).toBe(ink.ink);
  });
  test("rotates label anchors without rotating text and displays variants", () => {
    const normal = element("schematic.capacitor", {
      reference: "C1",
      value: "10u",
      polarized: true,
    });
    const box = schematicLocalBox(normal);
    const a = schematicNotation(normal, box, ink);
    const b = schematicNotation(
      element(normal.type, normal.semantic, { rotation: 90 }),
      box,
      ink,
    );
    expect(a.body.some((p) => p.role === "capacitor-plus")).toBe(true);
    expect(b.labels[0]).not.toEqual(a.labels[0]);
    expect(b.labels.every((p) => p.kind === "text" && !("rotation" in p))).toBe(
      true,
    );
  });
  test("connects component leads and renders semantic variants", () => {
    for (const [type, ends] of [
      ["schematic.capacitor", [22, 28]],
      ["schematic.diode", [18, 30]],
      ["schematic.battery", [22, 28]],
    ] as const) {
      const el = element(type, {});
      const result = schematicNotation(el, schematicLocalBox(el), ink);
      const stubs = result.body.filter((p) => p.role === "pin-stub");
      expect(stubs[0]?.kind === "path" && stubs[0].d).toContain(
        `L ${ends[0]} 15`,
      );
      expect(stubs[1]?.kind === "path" && stubs[1].d).toContain(
        `M ${ends[1]} 15`,
      );
    }
    for (const [type, semantic, role] of [
      ["schematic.power", { style: "rail", net: "VCC" }, "power-rail"],
      ["schematic.switch", { style: "push" }, "switch-push"],
      ["schematic.led", {}, "led-arrow"],
    ] as const) {
      const el = element(type, semantic);
      expect(
        schematicNotation(el, schematicLocalBox(el), ink).body.some(
          (p) => p.role === role,
        ),
      ).toBe(true);
    }
  });
  test("positions wire offsets within the actual page bounds", () => {
    const wire = element(
      "schematic.wire",
      {
        points: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
        ],
      },
      { x: 100, y: 200 },
    );
    const util = schematicShapeUtils.find(
      (entry) => entry.type === "schematic.wire",
    );
    const box = util?.getBounds(wire, {} as never);
    expect(box).toEqual({ x: 97, y: 197, width: 46, height: 6 });
    if (!box) throw new Error("wire bounds missing");
    const primitive = schematicNotation(wire, box, ink).body[0];
    expect(primitive?.kind === "path" && primitive.d).toBe("M 3 3 L 43 3");
  });
});
