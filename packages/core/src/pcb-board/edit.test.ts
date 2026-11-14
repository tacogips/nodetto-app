import { describe, expect, test } from "bun:test";
import type {
  PcbFootprintSemantic,
  PcbTrackSemantic,
  PcbViaSemantic,
} from "@nodetto/ir";
import { Editor } from "../editor.ts";
import { canRotateElement } from "../rotation.ts";
import { counterIds, seededRng } from "../test-helpers.ts";
import { buildPcbDocument } from "./test-builder.ts";

const footprint = (at: readonly [number, number] = [1, 2]) =>
  ({
    reference: "R1",
    value: "1k",
    library: "",
    at,
    rotation: 300,
    side: "top",
    pads: [],
    graphics: [],
  }) satisfies PcbFootprintSemantic;

function editorFor(spec: Parameters<typeof buildPcbDocument>[0] = {}) {
  return new Editor({
    document: buildPcbDocument(spec),
    idSource: counterIds("pcb"),
    rng: seededRng(9),
  });
}

describe("PCB editing contracts", () => {
  test("uses semantic anchors for absolute move targets without accumulating", () => {
    const editor = editorFor({ footprints: [footprint()] });
    const id = editor.store
      .getPageElements("pcb-page-1")
      .find((item) => item.type === "pcb.footprint")?.id as string;
    editor.selection.set([id]);
    expect(editor.movableSelection()).toEqual([{ id, x: 10, y: 20 }]);
    editor.moveElements([{ id, x: 15, y: 20 }]);
    editor.moveElements([{ id, x: 20, y: 20 }]);
    expect((editor.store.get(id)?.semantic as PcbFootprintSemantic).at).toEqual(
      [2, 2],
    );
    expect(editor.store.get(id)?.visual).toEqual({});
  });

  test("moves vias, tracks, zones and graphics through semantic coordinates", () => {
    const editor = editorFor({
      tracks: [
        {
          layer: "F.Cu",
          width: 0.25,
          net: "",
          points: [
            [1, 1],
            [2, 1],
          ],
        },
      ],
      vias: [
        {
          at: [1, 2],
          diameter: 0.6,
          drill: 0.3,
          layers: ["F.Cu", "B.Cu"],
          net: "",
        },
      ],
      zones: [
        {
          layers: ["F.Cu"],
          net: "",
          outline: [
            [0, 0],
            [2, 0],
            [2, 2],
          ],
          filled: [
            {
              layer: "F.Cu",
              polygons: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                ],
              ],
            },
          ],
        },
      ],
      graphics: [
        {
          layer: "Edge.Cuts",
          width: 0.05,
          fill: false,
          shape: { kind: "line", start: [1, 1], end: [2, 1] },
        },
      ],
    });
    for (const item of editor.store.getPageElements("pcb-page-1")) {
      if (!item.type.startsWith("pcb.") || item.type === "pcb.board") continue;
      const anchor =
        item.type === "pcb.via"
          ? (item.semantic as PcbViaSemantic).at
          : item.type === "pcb.track"
            ? (item.semantic as PcbTrackSemantic).points[0]
            : item.type === "pcb.zone"
              ? (
                  item.semantic as {
                    outline: readonly (readonly [number, number])[];
                  }
                ).outline[0]
              : (
                  item.semantic as {
                    shape: { start: readonly [number, number] };
                  }
                ).shape.start;
      editor.moveElements([
        {
          id: item.id,
          x: (anchor?.[0] ?? 0) * 10 + 10,
          y: (anchor?.[1] ?? 0) * 10,
        },
      ]);
      expect(editor.store.get(item.id)?.visual).toEqual({});
    }
    const movedZone = editor.store
      .getPageElements("pcb-page-1")
      .find((item) => item.type === "pcb.zone");
    expect(
      (
        movedZone?.semantic as {
          filled: readonly {
            polygons: readonly (readonly (readonly number[])[])[];
          }[];
        }
      ).filled[0]?.polygons[0]?.[0],
    ).toEqual([1, 0]);
  });

  test("rotates footprints semantically, normalizes angles, and skips locked footprints", () => {
    const doc = buildPcbDocument({
      footprints: [footprint(), { ...footprint([4, 4]), reference: "R2" }],
    });
    const elements = doc.elements.map((item) =>
      item.type === "pcb.footprint" &&
      item.semantic &&
      (item.semantic as PcbFootprintSemantic).reference === "R2"
        ? { ...item, visual: { locked: true } }
        : item,
    );
    const editor = new Editor({
      document: { ...doc, elements },
      idSource: counterIds("pcb"),
    });
    const [first, locked] = editor.store
      .getPageElements("pcb-page-1")
      .filter((item) => item.type === "pcb.footprint");
    editor.rotatePcbFootprints([first?.id as string, locked?.id as string], 90);
    editor.rotatePcbFootprints([first?.id as string], 90);
    expect(
      (editor.store.get(first?.id as string)?.semantic as PcbFootprintSemantic)
        .rotation,
    ).toBe(120);
    expect(
      (editor.store.get(locked?.id as string)?.semantic as PcbFootprintSemantic)
        .rotation,
    ).toBe(300);
    expect(editor.store.get(first?.id as string)?.visual).toEqual({});
    expect(canRotateElement(first as NonNullable<typeof first>)).toBe(false);
  });

  test("adds rounded tracks and vias between their z-order categories", () => {
    const editor = editorFor({
      tracks: [
        {
          layer: "F.Cu",
          width: 0.25,
          net: "",
          points: [
            [0, 0],
            [1, 0],
          ],
        },
      ],
      vias: [
        {
          at: [1, 1],
          diameter: 0.6,
          drill: 0.3,
          layers: ["F.Cu", "B.Cu"],
          net: "",
        },
      ],
      footprints: [footprint()],
    });
    const trackId = editor.addPcbTrack("pcb-page-1", {
      layer: "F.Cu",
      width: 0.25,
      net: "",
      points: [
        [2.0000004, 0],
        [3, 0],
      ],
    });
    const viaId = editor.addPcbVia("pcb-page-1", {
      at: [3.0000004, 0],
      diameter: 0.6,
      drill: 0.3,
      net: "",
    });
    const addedTrack = editor.store.get(trackId) as NonNullable<
      ReturnType<typeof editor.store.get>
    >;
    const addedVia = editor.store.get(viaId);
    expect((addedTrack.semantic as PcbTrackSemantic).points[0]).toEqual([2, 0]);
    expect(addedTrack.visual).toEqual({});
    expect(addedVia?.visual).toEqual({});
    expect((addedVia?.semantic as PcbViaSemantic).at).toEqual([3, 0]);
    const items = editor.store.getPageElements("pcb-page-1");
    const firstVia = items.find((item) => item.type === "pcb.via");
    const firstFootprint = items.find((item) => item.type === "pcb.footprint");
    expect(addedTrack.index < (firstVia?.index ?? "")).toBe(true);
    expect(
      (items.find((item) => item.type === "pcb.track")?.index ?? "") <
        (addedVia?.index ?? ""),
    ).toBe(true);
    expect((addedVia?.index ?? "") < (firstFootprint?.index ?? "")).toBe(true);
    expect(
      editor.addPcbVia("missing-page", {
        at: [0, 0],
        diameter: 0.6,
        drill: 0.3,
        net: "",
      }),
    ).toBe("");
    expect(
      editor.store
        .getPageElements("pcb-page-1")
        .filter((item) => item.type === "pcb.via"),
    ).toHaveLength(2);
  });
});
