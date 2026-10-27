import { describe, expect, test } from "bun:test";
import type { PcbFootprintSemantic, PcbTrackSemantic } from "@nodetto/ir";
import { roundNm } from "@nodetto/ir";
import { Editor } from "../editor.ts";
import { counterIds, seededRng } from "../test-helpers.ts";
import { buildPcbDocument } from "./test-builder.ts";

const footprint = (
  reference: string,
  at: readonly [number, number] = [0, 0],
  rotation = 0,
  layers: readonly string[] = ["F.Cu"],
): PcbFootprintSemantic => ({
  reference,
  value: "pad",
  library: "",
  at,
  rotation,
  side: "top",
  pads: [
    {
      number: "1",
      type: "smd",
      shape: "circle",
      at: [0, 0],
      rotation: 0,
      size: [1, 1],
      layers,
      net: "N1",
    },
  ],
  graphics: [],
});

function makeEditor(
  tracks: readonly PcbTrackSemantic[],
  footprints: readonly PcbFootprintSemantic[] = [footprint("R1")],
) {
  const editor = new Editor({
    document: buildPcbDocument({ tracks, footprints }),
    idSource: counterIds("follow"),
    rng: seededRng(3),
  });
  const ids = {
    footprint: editor.store
      .getPageElements("pcb-page-1")
      .find((item) => item.type === "pcb.footprint")?.id as string,
    tracks: editor.store
      .getPageElements("pcb-page-1")
      .filter((item) => item.type === "pcb.track")
      .map((item) => item.id),
  };
  return { editor, ids };
}

const line = (points: readonly (readonly [number, number])[], layer = "F.Cu") =>
  ({
    layer,
    width: 0.25,
    net: "N1",
    points,
  }) satisfies PcbTrackSemantic;

describe("PCB track follow", () => {
  test("moves an attached endpoint and undo restores footprint and track together", () => {
    const { editor, ids } = makeEditor([
      line([
        [0, 0],
        [4, 0],
      ]),
    ]);
    editor.moveElements([{ id: ids.footprint, x: 20, y: 0 }]);
    expect(
      (editor.store.get(ids.tracks[0] as string)?.semantic as PcbTrackSemantic)
        .points,
    ).toEqual([
      [2, 0],
      [4, 0],
    ]);
    expect(
      (editor.store.get(ids.footprint)?.semantic as PcbFootprintSemantic).at,
    ).toEqual([2, 0]);
    editor.undo();
    expect(
      (editor.store.get(ids.tracks[0] as string)?.semantic as PcbTrackSemantic)
        .points,
    ).toEqual([
      [0, 0],
      [4, 0],
    ]);
    expect(
      (editor.store.get(ids.footprint)?.semantic as PcbFootprintSemantic).at,
    ).toEqual([0, 0]);
  });

  test("preserves an off-center endpoint through footprint rotation", () => {
    const { editor, ids } = makeEditor([
      line([
        [0.2, 0],
        [4, 0],
      ]),
    ]);
    editor.rotatePcbFootprints([ids.footprint], 90);
    expect(
      (editor.store.get(ids.tracks[0] as string)?.semantic as PcbTrackSemantic)
        .points[0],
    ).toEqual([0, -0.2]);
  });

  test("does not follow endpoints outside pads or on a non-shared copper layer", () => {
    const { editor, ids } = makeEditor([
      line([
        [0.7, 0],
        [4, 0],
      ]),
      line(
        [
          [0, 0],
          [5, 0],
        ],
        "B.Cu",
      ),
    ]);
    editor.moveElements([{ id: ids.footprint, x: 20, y: 0 }]);
    expect(
      (editor.store.get(ids.tracks[0] as string)?.semantic as PcbTrackSemantic)
        .points[0],
    ).toEqual([0.7, 0]);
    expect(
      (editor.store.get(ids.tracks[1] as string)?.semantic as PcbTrackSemantic)
        .points[0],
    ).toEqual([0, 0]);
  });

  test("moves two endpoints and leaves track interior points unchanged", () => {
    const { editor, ids } = makeEditor(
      [
        line([
          [0, 0],
          [1, 1],
          [2, 0],
        ]),
      ],
      [footprint("R1"), footprint("R2", [2, 0])],
    );
    const footprints = editor.store
      .getPageElements("pcb-page-1")
      .filter((item) => item.type === "pcb.footprint");
    editor.moveElements(
      footprints.map((item) => ({
        id: item.id,
        x: (item.semantic as PcbFootprintSemantic).at[0] * 10 + 10,
        y: (item.semantic as PcbFootprintSemantic).at[1] * 10,
      })),
    );
    expect(
      (editor.store.get(ids.tracks[0] as string)?.semantic as PcbTrackSemantic)
        .points,
    ).toEqual([
      [1, 0],
      [1, 1],
      [3, 0],
    ]);
  });

  test("does not follow a track already moved in the same batch", () => {
    const { editor, ids } = makeEditor([
      line([
        [0, 0],
        [4, 0],
      ]),
    ]);
    editor.moveElements([
      { id: ids.footprint, x: 10, y: 0 },
      { id: ids.tracks[0] as string, x: 10, y: 0 },
    ]);
    expect(
      (editor.store.get(ids.tracks[0] as string)?.semantic as PcbTrackSemantic)
        .points,
    ).toEqual([
      [1, 0],
      [5, 0],
    ]);
  });

  test("adjusts an arc midpoint by its rotated and scaled sagitta", () => {
    const arc: PcbTrackSemantic = {
      ...line([
        [0, 0],
        [4, 0],
      ]),
      mid: [2, -1],
    };
    const { editor, ids } = makeEditor([arc]);
    editor.moveElements([{ id: ids.footprint, x: 0, y: 20 }]);
    const oldStart = [0, 0] as const;
    const oldEnd = [4, 0] as const;
    const oldMid = [2, -1] as const;
    const newStart = [0, 2] as const;
    const newEnd = [4, 0] as const;
    const oldChord = [oldEnd[0] - oldStart[0], oldEnd[1] - oldStart[1]];
    const newChord = [newEnd[0] - newStart[0], newEnd[1] - newStart[1]];
    const oldLength = Math.sqrt(
      oldChord[0] * oldChord[0] + oldChord[1] * oldChord[1],
    );
    const newLength = Math.sqrt(
      newChord[0] * newChord[0] + newChord[1] * newChord[1],
    );
    const cosine =
      (oldChord[0] * newChord[0] + oldChord[1] * newChord[1]) /
      (oldLength * newLength);
    const sine =
      (oldChord[0] * newChord[1] - oldChord[1] * newChord[0]) /
      (oldLength * newLength);
    const scale = newLength / oldLength;
    const oldChordMid = [
      (oldStart[0] + oldEnd[0]) / 2,
      (oldStart[1] + oldEnd[1]) / 2,
    ];
    const oldSagitta = [oldMid[0] - oldChordMid[0], oldMid[1] - oldChordMid[1]];
    const newChordMid = [
      (newStart[0] + newEnd[0]) / 2,
      (newStart[1] + newEnd[1]) / 2,
    ];
    const expectedMid = [
      roundNm(
        newChordMid[0] +
          (oldSagitta[0] * cosine - oldSagitta[1] * sine) * scale,
      ),
      roundNm(
        newChordMid[1] +
          (oldSagitta[0] * sine + oldSagitta[1] * cosine) * scale,
      ),
    ] as const;
    const actualMid = (
      editor.store.get(ids.tracks[0] as string)?.semantic as PcbTrackSemantic
    ).mid as readonly [number, number];
    expect(expectedMid).toEqual([1.5, 0]);
    expect(actualMid).toEqual(expectedMid);

    const startDistance = Math.sqrt(
      (actualMid[0] - newStart[0]) ** 2 + (actualMid[1] - newStart[1]) ** 2,
    );
    const endDistance = Math.sqrt(
      (actualMid[0] - newEnd[0]) ** 2 + (actualMid[1] - newEnd[1]) ** 2,
    );
    expect(Math.abs(startDistance - endDistance)).toBeLessThan(1e-6);
    const sagitta = [
      actualMid[0] - newChordMid[0],
      actualMid[1] - newChordMid[1],
    ];
    expect(
      Math.abs(sagitta[0] * newChord[0] + sagitta[1] * newChord[1]),
    ).toBeLessThan(1e-6);
  });

  test("inspector-style footprint semantic updates also run follow", () => {
    const { editor, ids } = makeEditor([
      line([
        [0, 0],
        [4, 0],
      ]),
    ]);
    const semantic = editor.store.get(ids.footprint)
      ?.semantic as PcbFootprintSemantic;
    editor.apply([
      {
        type: "updateSemantic",
        id: ids.footprint,
        semantic: { ...semantic, at: [0, 1] },
      },
    ]);
    expect(
      (editor.store.get(ids.tracks[0] as string)?.semantic as PcbTrackSemantic)
        .points[0],
    ).toEqual([0, 1]);
  });
});
