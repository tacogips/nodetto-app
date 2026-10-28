import { describe, expect, test } from "bun:test";
import type {
  PcbFootprintSemantic,
  PcbPad,
  PcbTrackSemantic,
} from "@nodetto/ir";
import { buildPcbDocument } from "./test-builder.ts";
import { computePcbConnectivity } from "./connectivity.ts";
import { computePcbRatsnest } from "./ratsnest.ts";

function pad(): PcbPad {
  return {
    number: "1",
    type: "smd",
    shape: "circle",
    at: [0, 0],
    rotation: 0,
    size: [0.6, 0.6],
    layers: ["F.Cu"],
    net: "GND",
  };
}
function footprint(
  reference: string,
  x: number,
  y: number,
): PcbFootprintSemantic {
  return {
    reference,
    value: "test",
    library: "test:part",
    at: [x, y],
    rotation: 0,
    side: "top",
    pads: [pad()],
    graphics: [],
  };
}
function track(points: PcbTrackSemantic["points"]): PcbTrackSemantic {
  return { layer: "F.Cu", width: 0.2, net: "GND", points };
}

describe("PCB ratsnest", () => {
  test("emits no line for a fully routed net and one after removing its track", () => {
    const footprints = [footprint("A", 0, 0), footprint("B", 4, 0)];
    const routed = buildPcbDocument({
      footprints,
      tracks: [
        track([
          [0, 0],
          [4, 0],
        ]),
      ],
    });
    const connected = computePcbConnectivity(routed, "pcb-page-1");
    expect(computePcbRatsnest(routed, "pcb-page-1", connected)).toEqual([]);
    const open = buildPcbDocument({ footprints });
    const openConnectivity = computePcbConnectivity(open, "pcb-page-1");
    expect(computePcbRatsnest(open, "pcb-page-1", openConnectivity)).toEqual([
      {
        net: "GND",
        from: { footprintId: "fp-A", pad: 0, x: 0, y: 0 },
        to: { footprintId: "fp-B", pad: 0, x: 4, y: 0 },
      },
    ]);
  });

  test("uses Prim and resolves equal-distance candidates by element order then pad", () => {
    const document = buildPcbDocument({
      footprints: [
        footprint("A", 0, 0),
        footprint("B", 2, 0),
        footprint("C", 1, 2),
      ],
    });
    const connectivity = computePcbConnectivity(document, "pcb-page-1");
    expect(computePcbRatsnest(document, "pcb-page-1", connectivity)).toEqual([
      {
        net: "GND",
        from: { footprintId: "fp-A", pad: 0, x: 0, y: 0 },
        to: { footprintId: "fp-B", pad: 0, x: 2, y: 0 },
      },
      {
        net: "GND",
        from: { footprintId: "fp-A", pad: 0, x: 0, y: 0 },
        to: { footprintId: "fp-C", pad: 0, x: 1, y: 2 },
      },
    ]);
  });

  test("treats hidden tracks as absent and handles 5,000 tracks on 500 pads", () => {
    const small = buildPcbDocument({
      footprints: [footprint("A", 0, 0), footprint("B", 4, 0)],
      tracks: [
        track([
          [0, 0],
          [4, 0],
        ]),
      ],
    });
    const hidden = {
      ...small,
      elements: small.elements.map((item) =>
        item.id === "track-1" ? { ...item, visual: { hidden: true } } : item,
      ),
    };
    const hiddenConnectivity = computePcbConnectivity(hidden, "pcb-page-1");
    expect(
      computePcbRatsnest(hidden, "pcb-page-1", hiddenConnectivity),
    ).toHaveLength(1);

    const footprints = Array.from({ length: 500 }, (_, index) =>
      footprint(`P${index}`, index * 10, 0),
    );
    const tracks = Array.from({ length: 5_000 }, (_, index) => {
      const x = 10_000 + index * 4;
      return track([
        [x, 0],
        [x + 1, 0],
      ]);
    });
    const document = buildPcbDocument({ footprints, tracks });
    const connectivity = computePcbConnectivity(document, "pcb-page-1");
    expect(connectivity.pads).toHaveLength(500);
    expect(
      computePcbRatsnest(document, "pcb-page-1", connectivity),
    ).toHaveLength(499);
  });
});
