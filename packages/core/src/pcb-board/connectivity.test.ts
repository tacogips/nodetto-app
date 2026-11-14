import { describe, expect, test } from "bun:test";
import type {
  PcbFootprintSemantic,
  PcbPad,
  PcbTrackSemantic,
  PcbViaSemantic,
  PcbZoneSemantic,
} from "@nodetto/ir";
import { buildPcbDocument } from "./test-builder.ts";
import {
  computePcbConnectivity,
  pcbNetHighlight,
  pcbNetMembers,
  pcbNetNames,
} from "./connectivity.ts";
import { computePcbRatsnest } from "./ratsnest.ts";

function pad(
  at: readonly [number, number],
  net: string,
  layers: readonly string[] = ["F.Cu"],
  size: readonly [number, number] = [1, 1],
): PcbPad {
  return {
    number: "1",
    type: "smd",
    shape: "circle",
    at,
    rotation: 0,
    size,
    layers,
    net,
  };
}
function footprint(
  reference: string,
  at: readonly [number, number],
  pads: readonly PcbPad[],
): PcbFootprintSemantic {
  return {
    reference,
    value: "test",
    library: "test:part",
    at,
    rotation: 0,
    side: "top",
    pads,
    graphics: [],
  };
}
function track(
  points: readonly (readonly [number, number])[],
  net = "GND",
  layer = "F.Cu",
  width = 0.2,
): PcbTrackSemantic {
  return { layer, width, net, points };
}
function component(
  document: ReturnType<typeof buildPcbDocument>,
  ref: { footprintId: string; pad: number },
  trackId = "track-1",
) {
  const connectivity = computePcbConnectivity(document, "pcb-page-1");
  return (
    connectivity.component({ kind: "pad", ref }) ===
    connectivity.component({ kind: "track", id: trackId })
  );
}

describe("PCB connectivity", () => {
  test("joins same-net pads through tracks and separates them when the track is removed", () => {
    const footprints = [
      footprint("A", [0, 0], [pad([0, 0], "GND")]),
      footprint("B", [4, 0], [pad([0, 0], "GND")]),
    ];
    const joined = buildPcbDocument({
      footprints,
      tracks: [
        track([
          [0, 0],
          [4, 0],
        ]),
      ],
    });
    const conn = computePcbConnectivity(joined, "pcb-page-1");
    expect(
      conn.component({ kind: "pad", ref: { footprintId: "fp-A", pad: 0 } }),
    ).toBe(
      conn.component({ kind: "pad", ref: { footprintId: "fp-B", pad: 0 } }),
    );
    expect(
      computePcbConnectivity(
        buildPcbDocument({ footprints }),
        "pcb-page-1",
      ).component({ kind: "pad", ref: { footprintId: "fp-A", pad: 0 } }),
    ).not.toBe(
      computePcbConnectivity(
        buildPcbDocument({ footprints }),
        "pcb-page-1",
      ).component({ kind: "pad", ref: { footprintId: "fp-B", pad: 0 } }),
    );
  });

  test("uses the pad edge and width tolerance for track endpoints", () => {
    const fp = footprint("A", [0, 0], [pad([0, 0], "GND", ["F.Cu"], [2, 2])]);
    expect(
      component(
        buildPcbDocument({
          footprints: [fp],
          tracks: [
            track([
              [1.1, 0],
              [2, 0],
            ]),
          ],
        }),
        { footprintId: "fp-A", pad: 0 },
      ),
    ).toBe(false);
    expect(
      component(
        buildPcbDocument({
          footprints: [fp],
          tracks: [
            track([
              [0.9, 0],
              [2, 0],
            ]),
          ],
        }),
        { footprintId: "fp-A", pad: 0 },
      ),
    ).toBe(true);
  });

  test("connects and clears ratsnest through the shifted offset pad shape", () => {
    const offsetFootprint = {
      ...footprint(
        "A",
        [10, 10],
        [
          {
            ...pad([0, 0], "GND", ["F.Cu"], [2, 1]),
            shape: "oval" as const,
            drill: { diameter: 0.6, offset: [0.5, 0] as const },
          },
        ],
      ),
      rotation: 90,
    };
    const other = footprint("B", [15, 10], [pad([0, 0], "GND")]);
    const routed = buildPcbDocument({
      footprints: [offsetFootprint, other],
      tracks: [
        track([
          [10, 8.7],
          [15, 10],
        ]),
      ],
    });
    const routedConnectivity = computePcbConnectivity(routed, "pcb-page-1");
    expect(
      routedConnectivity.component({
        kind: "pad",
        ref: { footprintId: "fp-A", pad: 0 },
      }),
    ).toBe(
      routedConnectivity.component({
        kind: "pad",
        ref: { footprintId: "fp-B", pad: 0 },
      }),
    );
    expect(
      computePcbRatsnest(routed, "pcb-page-1", routedConnectivity),
    ).toEqual([]);

    const open = buildPcbDocument({
      footprints: [offsetFootprint, other],
      tracks: [
        track([
          [10, 10.8],
          [15, 10],
        ]),
      ],
    });
    const openConnectivity = computePcbConnectivity(open, "pcb-page-1");
    expect(
      computePcbRatsnest(open, "pcb-page-1", openConnectivity),
    ).toHaveLength(1);
  });

  test("joins a T-junction and never joins crossing copper from another net", () => {
    const tDoc = buildPcbDocument({
      tracks: [
        track([
          [0, 0],
          [2, 0],
        ]),
        track([
          [1, 1],
          [1, 0],
        ]),
      ],
    });
    const tConn = computePcbConnectivity(tDoc, "pcb-page-1");
    expect(tConn.component({ kind: "track", id: "track-1" })).toBe(
      tConn.component({ kind: "track", id: "track-2" }),
    );
    const crossDoc = buildPcbDocument({
      footprints: [
        footprint("A", [0, 0], [pad([0, 0], "A")]),
        footprint("B", [2, 0], [pad([0, 0], "A")]),
      ],
      tracks: [
        track(
          [
            [0, 0],
            [2, 0],
          ],
          "A",
        ),
        track(
          [
            [1, 0],
            [1, 1],
          ],
          "B",
        ),
      ],
    });
    const cross = computePcbConnectivity(crossDoc, "pcb-page-1");
    expect(
      cross.component({ kind: "pad", ref: { footprintId: "fp-A", pad: 0 } }),
    ).toBe(
      cross.component({ kind: "pad", ref: { footprintId: "fp-B", pad: 0 } }),
    );
    expect(cross.component({ kind: "track", id: "track-2" })).not.toBe(
      cross.component({ kind: "track", id: "track-1" }),
    );
    expect(cross.component({ kind: "track", id: "track-2" })).not.toBe(
      cross.component({ kind: "pad", ref: { footprintId: "fp-A", pad: 0 } }),
    );
    const sameNetDoc = buildPcbDocument({
      footprints: [
        footprint("A", [0, 0], [pad([0, 0], "A")]),
        footprint("B", [2, 0], [pad([0, 0], "A")]),
      ],
      tracks: [
        track(
          [
            [0, 0],
            [2, 0],
          ],
          "A",
        ),
        track(
          [
            [1, 0],
            [1, 1],
          ],
          "A",
        ),
      ],
    });
    const sameNet = computePcbConnectivity(sameNetDoc, "pcb-page-1");
    expect(sameNet.component({ kind: "track", id: "track-2" })).toBe(
      sameNet.component({ kind: "track", id: "track-1" }),
    );
  });

  test("uses both chords of an arc track for endpoint contacts", () => {
    const arc: PcbTrackSemantic = {
      ...track([
        [0, 0],
        [2, 0],
      ]),
      mid: [1, 1],
    };
    const document = buildPcbDocument({
      tracks: [
        arc,
        track([
          [1, 1],
          [1, 2],
        ]),
      ],
    });
    const connectivity = computePcbConnectivity(document, "pcb-page-1");
    expect(connectivity.component({ kind: "track", id: "track-1" })).toBe(
      connectivity.component({ kind: "track", id: "track-2" }),
    );
  });

  test("vias bridge their layer span and same-net pads inside B.Cu fills", () => {
    const via: PcbViaSemantic = {
      at: [2, 0],
      diameter: 0.6,
      drill: 0.3,
      layers: ["F.Cu", "B.Cu"],
      net: "GND",
    };
    const layerDoc = buildPcbDocument({
      vias: [via],
      tracks: [
        track(
          [
            [0, 0],
            [2, 0],
          ],
          "GND",
          "F.Cu",
        ),
        track(
          [
            [2, 0],
            [4, 0],
          ],
          "GND",
          "B.Cu",
        ),
      ],
    });
    const layerConn = computePcbConnectivity(layerDoc, "pcb-page-1");
    expect(layerConn.component({ kind: "track", id: "track-1" })).toBe(
      layerConn.component({ kind: "track", id: "track-2" }),
    );
    const zone: PcbZoneSemantic = {
      layers: ["B.Cu"],
      net: "GND",
      outline: [
        [-1, -1],
        [3, -1],
        [3, 1],
      ],
      filled: [
        {
          layer: "B.Cu",
          polygons: [
            [
              [-1, -1],
              [3, -1],
              [3, 1],
              [-1, 1],
            ],
          ],
        },
      ],
    };
    const fillDoc = buildPcbDocument({
      footprints: [
        footprint("A", [0, 0], [pad([0, 0], "GND", ["B.Cu"])]),
        footprint("B", [2, 0], [pad([0, 0], "GND", ["B.Cu"])]),
        footprint("C", [5, 0], [pad([0, 0], "GND", ["B.Cu"])]),
      ],
      zones: [zone],
    });
    const fill = computePcbConnectivity(fillDoc, "pcb-page-1");
    expect(
      fill.component({ kind: "pad", ref: { footprintId: "fp-A", pad: 0 } }),
    ).toBe(
      fill.component({ kind: "pad", ref: { footprintId: "fp-B", pad: 0 } }),
    );
    expect(
      fill.component({ kind: "pad", ref: { footprintId: "fp-A", pad: 0 } }),
    ).not.toBe(
      fill.component({ kind: "pad", ref: { footprintId: "fp-C", pad: 0 } }),
    );
  });

  test("orders members, highlights pads and collects board and used net names", () => {
    const zone: PcbZoneSemantic = {
      layers: ["F.Cu"],
      net: "GND",
      outline: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      filled: [],
    };
    const via: PcbViaSemantic = {
      at: [0, 0],
      diameter: 0.6,
      drill: 0.3,
      layers: ["F.Cu", "B.Cu"],
      net: "GND",
    };
    const document = buildPcbDocument({
      board: { nets: ["GND", "EMPTY", ""] },
      footprints: [
        footprint("A", [0, 0], [pad([0, 0], "GND"), pad([1, 0], "")]),
      ],
      tracks: [
        track([
          [0, 0],
          [1, 0],
        ]),
      ],
      vias: [via],
      zones: [zone],
    });
    const ordered = document.elements
      .filter(
        (item) => item.type !== "pcb.board" && item.type !== "pcb.footprint",
      )
      .map((item) => item.id);
    expect(pcbNetMembers(document, "pcb-page-1", "GND")).toEqual([
      ...ordered,
      "fp-A",
    ]);
    expect(pcbNetHighlight(document, "pcb-page-1", "GND")).toEqual({
      pads: [{ footprintId: "fp-A", pad: 0 }],
      tracks: ["track-1"],
      vias: ["via-1"],
      zones: ["zone-1"],
    });
    expect(pcbNetNames(document, "pcb-page-1")).toEqual(["EMPTY", "GND"]);
  });

  test("ignores hidden copper", () => {
    const doc = buildPcbDocument({
      footprints: [
        footprint("A", [0, 0], [pad([0, 0], "GND")]),
        footprint("B", [3, 0], [pad([0, 0], "GND")]),
      ],
      tracks: [
        track([
          [0, 0],
          [3, 0],
        ]),
      ],
    });
    const hidden = {
      ...doc,
      elements: doc.elements.map((item) =>
        item.id === "track-1" ? { ...item, visual: { hidden: true } } : item,
      ),
    };
    const conn = computePcbConnectivity(hidden, "pcb-page-1");
    expect(
      conn.component({ kind: "pad", ref: { footprintId: "fp-A", pad: 0 } }),
    ).not.toBe(
      conn.component({ kind: "pad", ref: { footprintId: "fp-B", pad: 0 } }),
    );
  });
});
