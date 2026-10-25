import { describe, expect, test } from "bun:test";
import {
  breadboardNetHighlight,
  breadboardNetMembers,
  computeBreadboardConnectivity,
  toBreadboardNetlist,
} from "./connectivity.ts";
import { buildBreadboardDocument } from "./test-builder.ts";

describe("breadboard connectivity", () => {
  test("joins pins on a terminal strip but keeps the centre channel split", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
          semantic: { span: 0 },
        },
        {
          id: "r2",
          type: "breadboard.resistor",
          reference: "R2",
          pin1: { x: 20, y: 90 },
          semantic: { span: 0 },
        },
        {
          id: "r3",
          type: "breadboard.resistor",
          reference: "R3",
          pin1: { x: 20, y: 120 },
          semantic: { span: 0 },
        },
      ],
    });
    const graph = computeBreadboardConnectivity(document, "breadboard-page");
    expect(graph.netOfPin({ elementId: "r1", pin: 1 })).toBe(
      graph.netOfPin({ elementId: "r2", pin: 1 }),
    );
    expect(graph.netOfPin({ elementId: "r1", pin: 1 })).not.toBe(
      graph.netOfPin({ elementId: "r3", pin: 1 }),
    );
    expect(
      graph.nets[graph.netOfPin({ elementId: "r1", pin: 1 }) ?? -1]?.strips,
    ).toContainEqual({ boardId: "board-1", strip: "col:1:top" });
  });

  test("joins rails to terminal strips through wire endpoints and highlights all members", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
          semantic: { span: 0 },
        },
      ],
      wires: [
        {
          id: "w1",
          points: [
            { x: 20, y: 20 },
            { x: 20, y: 50 },
          ],
        },
      ],
    });
    const graph = computeBreadboardConnectivity(document, "breadboard-page");
    const net = graph.netOfWire("w1");
    expect(net).toBe(graph.netOfPin({ elementId: "r1", pin: 1 }));
    expect(graph.wireEndOnHoleOrPin("w1", 0)).toBe(true);
    expect(graph.wireEndOnHoleOrPin("w1", 1)).toBe(true);
    const highlight = breadboardNetHighlight(graph, { wireId: "w1" });
    expect(highlight.wireIds).toEqual(["w1"]);
    expect(highlight.pins).toContainEqual({ elementId: "r1", pin: 1 });
    expect(highlight.strips).toContainEqual({
      boardId: "board-1",
      strip: "col:1:top",
    });
    expect(highlight.strips).toContainEqual({
      boardId: "board-1",
      strip: "rail:T+",
    });
    expect(highlight.holes.length).toBeGreaterThan(1);
    expect(
      breadboardNetMembers(document, "breadboard-page", graph, {
        wireId: "w1",
      }),
    ).toEqual(["r1", "w1"]);
  });

  test("unifies button bonds and ignores hidden wires", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "sw",
          type: "breadboard.button",
          reference: "SW1",
          pin1: { x: 20, y: 50 },
        },
      ],
      wires: [
        {
          id: "hidden",
          points: [
            { x: 20, y: 50 },
            { x: 100, y: 100 },
          ],
          hidden: true,
        },
      ],
    });
    const graph = computeBreadboardConnectivity(document, "breadboard-page");
    expect(graph.netOfPin({ elementId: "sw", pin: 1 })).toBe(
      graph.netOfPin({ elementId: "sw", pin: 2 }),
    );
    expect(graph.netOfWire("hidden")).toBeUndefined();
  });

  test("projects components and unconnected pins in stable reference order", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r10",
          type: "breadboard.resistor",
          reference: "R10",
          pin1: { x: 20, y: 50 },
        },
        {
          id: "r2",
          type: "breadboard.resistor",
          reference: "R2",
          pin1: { x: 20, y: 90 },
        },
        {
          id: "c1",
          type: "breadboard.capacitor",
          reference: "C1",
          pin1: { x: 30, y: 50 },
        },
        {
          id: "ru",
          type: "breadboard.resistor",
          reference: "R?",
          pin1: { x: 20, y: 130 },
        },
      ],
    });
    const graph = computeBreadboardConnectivity(document, "breadboard-page");
    const netlist = toBreadboardNetlist(document, "breadboard-page", graph);
    expect(netlist.components.map(({ reference }) => reference)).toEqual([
      "C1",
      "R2",
      "R10",
      "R?",
    ]);
    expect(netlist.nets.map((net) => net.code)).toEqual(
      netlist.nets.map((_, index) => index + 1),
    );
    expect(netlist.nets.some((net) => net.nodes.length === 1)).toBe(true);
  });

  test("uses battery names and deterministic fallback names", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "battery",
          type: "breadboard.battery",
          reference: "BT1",
          pin1: { x: 700, y: 100 },
        },
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
        },
      ],
    });
    const netlist = toBreadboardNetlist(
      document,
      "breadboard-page",
      computeBreadboardConnectivity(document, "breadboard-page"),
    );
    expect(
      netlist.nets.find((net) =>
        net.nodes.some((node) => node.reference === "BT1" && node.pin === 2),
      )?.name,
    ).toBe("GND");
    expect(
      netlist.nets.find((net) =>
        net.nodes.some((node) => node.reference === "BT1" && node.pin === 1),
      )?.name,
    ).toBe("VCC");
    expect(netlist.nets.some((net) => net.name.startsWith("N_R1_"))).toBe(true);
  });

  test("assigns overlapping holes to the topmost board", () => {
    const document = buildBreadboardDocument({
      boards: [{ id: "lower" }, { id: "upper" }],
      parts: [
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
        },
      ],
    });
    const graph = computeBreadboardConnectivity(document, "breadboard-page");
    const net = graph.netOfPin({ elementId: "r", pin: 1 });
    expect(graph.nets[net ?? -1]?.strips).toEqual([
      { boardId: "upper", strip: "col:1:top" },
    ]);
  });

  test("adds net codes to colliding fallback names", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "a",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 700, y: 100 },
        },
        {
          id: "bb",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 700, y: 200 },
        },
      ],
    });
    const netlist = toBreadboardNetlist(
      document,
      "breadboard-page",
      computeBreadboardConnectivity(document, "breadboard-page"),
    );
    expect(netlist.nets.map((net) => net.name)).toEqual([
      "N_R1_1",
      "N_R1_2",
      "N_R1_1_3",
      "N_R1_2_4",
    ]);
  });
});
