import { describe, expect, test } from "bun:test";
import type {
  Element,
  PcbFootprintSemantic,
  PcbTrackSemantic,
} from "@nodetto/ir";
import { pcbViewModel } from "./pcb-view.ts";

function element(type: string, semantic: unknown): Element {
  return {
    id: "e1",
    page: "p1",
    type,
    index: "a1",
    semantic,
    visual: {},
  } as Element;
}

describe("PCB page view model", () => {
  test("scales tracks from millimetres to page units and skips hidden layers", () => {
    const track: PcbTrackSemantic = {
      layer: "F.Cu",
      width: 0.25,
      net: "GND",
      points: [
        [1, 2],
        [3, 4],
      ],
    };
    const [view] = pcbViewModel(element("pcb.track", track));
    expect(view).toMatchObject({
      kind: "path",
      d: "M 10 20 L 30 40",
      width: 2.5,
      stroke: "#c83434",
    });
    expect(
      pcbViewModel(element("pcb.track", track), new Set(["F.Cu"])),
    ).toEqual([]);
  });

  test("uses SVG arc tracks and draws offset pad copper away from its anchor hole", () => {
    const arc: PcbTrackSemantic = {
      layer: "B.Cu",
      width: 0.4,
      net: "SIG",
      points: [
        [1, 0],
        [-1, 0],
      ],
      mid: [0, -1],
    };
    expect(pcbViewModel(element("pcb.track", arc))[0]?.kind).toBe("path");
    expect(
      (pcbViewModel(element("pcb.track", arc))[0] as { d: string }).d,
    ).toContain(" A ");
    const footprint: PcbFootprintSemantic = {
      reference: "U1",
      value: "IC",
      library: "",
      at: [10, 10],
      rotation: 90,
      side: "top",
      pads: [
        {
          number: "1",
          type: "thru_hole",
          shape: "oval",
          at: [0, 0],
          rotation: 0,
          size: [2, 1],
          layers: ["*.Cu"],
          net: "GND",
          drill: { diameter: 0.6, offset: [0.5, 0] },
        },
      ],
      graphics: [],
    };
    const views = pcbViewModel(element("pcb.footprint", footprint));
    const copper = views.find(
      (view) => view.kind === "path" && view.layer === "*.Cu",
    ) as { d: string };
    expect(copper.d).toBe(
      "M 95 100 L 95 90 A 5 5 0 0 1 105 90 L 105 100 A 5 5 0 0 1 95 100",
    );
    const hole = views.find(
      (view) => view.kind === "circle" && view.layer === "holes",
    );
    expect(hole).toMatchObject({ cx: 100, cy: 100, r: 3 });
    const slotFootprint: PcbFootprintSemantic = {
      ...footprint,
      pads: [
        {
          ...footprint.pads[0]!,
          drill: { diameter: 0.6, slot: [1.2, 0.6], offset: [0.5, 0] },
        },
      ],
    };
    expect(
      pcbViewModel(element("pcb.footprint", slotFootprint)).find(
        (view) => view.kind === "path" && view.layer === "holes",
      ),
    ).toMatchObject({
      d: "M 103 103 L 103 97 A 3 3 0 0 0 97 97 L 97 103 A 3 3 0 0 0 103 103 Z",
    });
    const unrotatedSlot = pcbViewModel(
      element("pcb.footprint", {
        ...slotFootprint,
        at: [0, 0],
        rotation: 0,
      }),
    ).find((view) => view.kind === "path" && view.layer === "holes");
    expect(unrotatedSlot).toMatchObject({
      d: "M -3 3 L 3 3 A 3 3 0 0 0 3 -3 L -3 -3 A 3 3 0 0 0 -3 3 Z",
    });
  });

  test("draws board graphics and filled zone layers while skipping hidden fills", () => {
    const graphic = element("pcb.graphic", {
      layer: "Edge.Cuts",
      width: 0.1,
      fill: false,
      shape: { kind: "line", start: [1, 2], end: [4, 6] },
    });
    expect(pcbViewModel(graphic)[0]).toMatchObject({
      d: "M 10 20 L 40 60",
      stroke: "#d0d0d0",
    });
    const zone = element("pcb.zone", {
      layers: ["F.Cu"],
      net: "GND",
      outline: [
        [0, 0],
        [4, 0],
        [4, 3],
      ],
      filled: [
        {
          layer: "F.Cu",
          polygons: [
            [
              [0, 0],
              [4, 0],
              [4, 3],
            ],
          ],
        },
        {
          layer: "B.Cu",
          polygons: [
            [
              [0, 0],
              [4, 0],
              [4, 3],
            ],
          ],
        },
      ],
    });
    expect(pcbViewModel(zone)).toHaveLength(3);
    expect(pcbViewModel(zone, new Set(["B.Cu"]))).toHaveLength(2);
  });

  test("text stroke paths retain the y-up to page-y-down orientation", () => {
    const graphic = element("pcb.graphic", {
      layer: "F.SilkS",
      width: 0.1,
      fill: false,
      shape: {
        kind: "text",
        text: "T",
        at: [5, 7],
        rotation: 0,
        size: [1, 1],
        thickness: 0.1,
      },
    });
    const views = pcbViewModel(graphic);
    expect(views.length).toBeGreaterThan(0);
    expect(views[0]).toMatchObject({
      kind: "path",
      d: "M 46.66666666666667 65 L 53.33333333333333 65",
    });
    expect(views[1]).toMatchObject({ kind: "path", d: "M 50 65 L 50 75" });
    const mirrored = pcbViewModel(
      element("pcb.graphic", {
        layer: "F.SilkS",
        width: 0.1,
        fill: false,
        shape: {
          kind: "text",
          text: "T",
          at: [5, 7],
          rotation: 0,
          size: [1, 1],
          thickness: 0.1,
          justify: { mirror: true },
        },
      }),
    );
    expect(mirrored[0]).toMatchObject({
      kind: "path",
      d: "M 53.33333333333333 65 L 46.66666666666667 65",
    });
  });
});
