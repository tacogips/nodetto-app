import { describe, expect, test } from "bun:test";
import { computeBreadboardConnectivity } from "./connectivity.ts";
import { buildBreadboardDocument } from "./test-builder.ts";
import { computeBreadboardRatsnest } from "./ratsnest.ts";

const PAGE = "breadboard-page";
function targetPart(reference: string, value: string) {
  return {
    reference,
    value,
    pins: [1, 2].map((number) => ({ number, name: String(number) })),
  };
}

const target = {
  parts: [
    targetPart("R1", "220"),
    targetPart("D1", "red"),
    targetPart("C1", "10u"),
  ],
  nets: [
    {
      name: "N_SIGNAL",
      nodes: [
        { reference: "R1", pin: 1 },
        { reference: "D1", pin: 1 },
        { reference: "C1", pin: 1 },
      ],
    },
  ],
};

function ratsnest(document: ReturnType<typeof buildBreadboardDocument>) {
  return computeBreadboardRatsnest(
    document,
    PAGE,
    computeBreadboardConnectivity(document, PAGE),
  );
}

describe("breadboard ratsnest", () => {
  test("returns no lines when the target card is absent", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 40, y: 50 },
        },
      ],
    });
    expect(ratsnest(document)).toEqual([]);
  });

  test("connects separate target pins with a named line", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
        },
        {
          id: "d1",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 40, y: 50 },
        },
      ],
      netlist: {
        parts: target.parts.slice(0, 2),
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
    expect(ratsnest(document)).toEqual([
      {
        targetNet: "N_SIGNAL",
        from: { elementId: "r1", pin: 1, x: 20, y: 50 },
        to: { elementId: "d1", pin: 1, x: 40, y: 50 },
      },
    ]);
  });

  test("removes a target line when a wire joins its pins", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
        },
        {
          id: "d1",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 40, y: 50 },
        },
      ],
      wires: [
        {
          id: "wire",
          points: [
            { x: 20, y: 50 },
            { x: 40, y: 50 },
          ],
        },
      ],
      netlist: {
        parts: target.parts.slice(0, 2),
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
    expect(ratsnest(document)).toEqual([]);
  });

  test("uses target node order to break equal-distance Prim ties", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 40, y: 50 },
        },
        {
          id: "d1",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 20, y: 50 },
        },
        {
          id: "c1",
          type: "breadboard.capacitor",
          reference: "C1",
          pin1: { x: 60, y: 50 },
        },
      ],
      netlist: target,
    });
    expect(
      ratsnest(document).map((line) => [
        line.from.elementId,
        line.to.elementId,
      ]),
    ).toEqual([
      ["r1", "d1"],
      ["r1", "c1"],
    ]);
  });

  test("uses the first visible target card", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
        },
        {
          id: "d1",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 40, y: 50 },
        },
      ],
      netlist: {
        parts: target.parts.slice(0, 2),
        nets: [
          {
            name: "FIRST",
            nodes: [
              { reference: "R1", pin: 1 },
              { reference: "D1", pin: 1 },
            ],
          },
        ],
      },
    });
    const firstCard = document.elements.find(
      (element) => element.id === "target-netlist",
    );
    if (!firstCard) throw new Error("test target card was not built");
    const withSecondCard = {
      ...document,
      elements: [
        ...document.elements,
        {
          ...firstCard,
          id: "second-target-netlist",
          index: "z",
          semantic: {
            source: "second.net",
            format: "kicad_net",
            parts: [
              { reference: "R1", value: "220", type: "breadboard.resistor" },
              { reference: "D1", value: "red", type: "breadboard.led" },
            ],
            nets: [
              {
                name: "SECOND",
                nodes: [
                  { reference: "R1", pin: 1 },
                  { reference: "D1", pin: 1 },
                ],
              },
            ],
          },
        },
      ],
    };
    expect(ratsnest(withSecondCard)[0]?.targetNet).toBe("FIRST");
  });

  test("emits a Prim tree and removes links as pins become connected", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
        },
        {
          id: "d1",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 40, y: 50 },
        },
        {
          id: "c1",
          type: "breadboard.capacitor",
          reference: "C1",
          pin1: { x: 60, y: 50 },
        },
      ],
      netlist: target,
    });
    const lines = ratsnest(document);
    expect(lines).toHaveLength(2);
    expect(
      lines.map((line) => [line.from.elementId, line.to.elementId]),
    ).toEqual([
      ["r1", "d1"],
      ["d1", "c1"],
    ]);
    const connected = {
      ...document,
      elements: document.elements.map((element) =>
        element.id === "d1"
          ? { ...element, visual: { ...element.visual, x: 15 } }
          : element,
      ),
    };
    expect(ratsnest(connected)).toHaveLength(1);
  });

  test("tracks target pin positions after a part moves", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
        },
        {
          id: "d1",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 40, y: 50 },
        },
      ],
      netlist: {
        parts: target.parts.slice(0, 2),
        nets: target.nets
          .slice(0, 1)
          .map((net) => ({ ...net, nodes: net.nodes.slice(0, 2) })),
      },
    });
    const moved = {
      ...document,
      elements: document.elements.map((element) =>
        element.id === "d1"
          ? { ...element, visual: { ...element.visual, x: 75 } }
          : element,
      ),
    };
    expect(ratsnest(moved)[0]?.to).toEqual({
      elementId: "d1",
      pin: 1,
      x: 80,
      y: 50,
    });
  });
});
