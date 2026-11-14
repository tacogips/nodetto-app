import { describe, expect, test } from "bun:test";
import {
  BREADBOARD_ELEMENT_TYPES,
  BREADBOARD_PITCH,
  type Element,
} from "@nodetto/ir";
import { breadboardNotation } from "./notation.ts";
import { boardLayout } from "./board.ts";
import { breadboardDefaultSemantic, breadboardLocalBox } from "./catalogue.ts";

function element(
  type: string,
  semantic?: Record<string, unknown>,
  rotation = 0,
): Element {
  const data =
    semantic ??
    (breadboardDefaultSemantic(
      type as (typeof BREADBOARD_ELEMENT_TYPES)[number],
    ) as Record<string, unknown>);
  const visual: Element["visual"] = { x: 0, y: 0, rotation };
  if (type === "breadboard.board") {
    const size =
      data.size === "full" || data.size === "mini" ? data.size : "half";
    const layout = boardLayout(size);
    Object.assign(visual, {
      width: layout.width * BREADBOARD_PITCH,
      height: layout.height * BREADBOARD_PITCH,
    });
  } else if (type === "breadboard.netlist") {
    Object.assign(visual, { width: 160, height: 40 });
  } else if (type === "breadboard.wire") {
    Object.assign(visual, { x: 0, y: 0 });
  } else {
    const local = breadboardLocalBox(
      type as Parameters<typeof breadboardLocalBox>[0],
      data as never,
    );
    Object.assign(visual, {
      width: local.width * BREADBOARD_PITCH,
      height: local.height * BREADBOARD_PITCH,
    });
  }
  return {
    id: type,
    page: "page-1",
    type,
    index: "a0",
    semantic: data,
    visual,
  };
}
function box(item: Element): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (item.type === "breadboard.board") {
    const layout = boardLayout(
      (item.semantic as { size: "half" | "full" | "mini" }).size,
    );
    return {
      x: 0,
      y: 0,
      width: layout.width * BREADBOARD_PITCH,
      height: layout.height * BREADBOARD_PITCH,
    };
  }
  if (item.type === "breadboard.netlist")
    return { x: 0, y: 0, width: 160, height: 40 };
  if (item.type === "breadboard.wire")
    return { x: -2.25, y: -2.25, width: 14.5, height: 4.5 };
  const local = breadboardLocalBox(
    item.type as Parameters<typeof breadboardLocalBox>[0],
    item.semantic as never,
  );
  return {
    x: 0,
    y: 0,
    width: local.width * BREADBOARD_PITCH,
    height: local.height * BREADBOARD_PITCH,
  };
}

describe("breadboardNotation", () => {
  test("draws every breadboard type with stable roles", () => {
    const expected: Readonly<Record<string, readonly string[]>> = {
      "breadboard.board": [
        "board",
        "board-hole",
        "board-channel",
        "rail-plus",
        "rail-minus",
        "board-label",
      ],
      "breadboard.wire": ["wire-outline", "wire-color", "wire-end"],
      "breadboard.resistor": [
        "resistor-leads",
        "resistor-body",
        "resistor-band-1",
        "resistor-band-2",
        "resistor-band-3",
        "resistor-band-4",
      ],
      "breadboard.led": ["led-dome", "led-flat"],
      "breadboard.capacitor": ["capacitor-disc"],
      "breadboard.diode": ["diode-band"],
      "breadboard.transistor": ["transistor-body"],
      "breadboard.button": ["button-body"],
      "breadboard.potentiometer": ["potentiometer-body"],
      "breadboard.ic": ["ic-notch", "ic-pin1", "ic-leg"],
      "breadboard.header": ["header-pin"],
      "breadboard.battery": ["battery-plus", "battery-minus"],
      "breadboard.netlist": ["netlist-card", "netlist-label"],
    };
    for (const type of BREADBOARD_ELEMENT_TYPES) {
      const notation = breadboardNotation(element(type), box(element(type)));
      expect(notation.body.length, type).toBeGreaterThan(0);
      const roles = new Set(notation.body.map(({ role }) => role));
      for (const role of expected[type] ?? [])
        expect(roles.has(role), `${type}:${role}`).toBe(true);
    }
  });

  test("draws the pinned number of holes for each board size", () => {
    for (const [size, count] of [
      ["half", 400],
      ["full", 830],
      ["mini", 170],
    ] as const) {
      const item = element("breadboard.board", { size });
      const result = breadboardNotation(item, box(item));
      expect(
        result.body.filter(({ role }) => role === "board-hole"),
      ).toHaveLength(count);
    }
  });

  test("marks polarized parts and suppresses bands for unrepresentable values", () => {
    const led = element("breadboard.led");
    expect(
      breadboardNotation(led, box(led)).body.filter(
        ({ role }) => role === "led-flat",
      ),
    ).toHaveLength(1);
    const cap = element("breadboard.capacitor", {
      reference: "C1",
      value: "10u",
      style: "electrolytic",
      span: 2,
    });
    expect(
      breadboardNotation(cap, box(cap)).body.filter(
        ({ role }) => role === "cap-minus-stripe",
      ),
    ).toHaveLength(1);
    const ic = element("breadboard.ic");
    const icRoles = breadboardNotation(ic, box(ic)).body.map(
      ({ role }) => role,
    );
    expect(icRoles.filter((role) => role === "ic-notch")).toHaveLength(1);
    expect(icRoles.filter((role) => role === "ic-pin1")).toHaveLength(1);
    const bad = element("breadboard.resistor", {
      reference: "R1",
      value: "4.75k",
      span: 4,
      bands: 4,
    });
    expect(
      breadboardNotation(bad, box(bad)).body.filter(({ role }) =>
        role.startsWith("resistor-band-"),
      ),
    ).toHaveLength(0);
  });

  test("pre-rotates the external part label and dims inert target cards", () => {
    const led = element("breadboard.led", undefined, 90);
    const label = breadboardNotation(led, box(led)).labels[0];
    expect(label?.kind).toBe("text");
    if (label?.kind === "text") {
      expect(label.rotate).toBeUndefined();
      expect(label.x).toBeGreaterThan(box(led).width);
    }
    const card = element("breadboard.netlist", {
      source: "x.net",
      format: "kicad_net",
      parts: [],
      nets: [],
    });
    expect(
      breadboardNotation(card, box(card), { inert: true }).body.every(
        (primitive) => primitive.opacity === 0.5,
      ),
    ).toBe(true);
  });
});
