import { describe, expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import type { Document, Element, PcbFootprintSemantic } from "@nodetto/ir";
import { creationFor, Tool } from "./tools.ts";
import type { ToolKind } from "./tools.ts";
import { shapePaletteGroups, workspaceShapes } from "./shape-palette.ts";
import {
  pcbSnapTarget,
  pcbTrackDraft,
  pcbViaInput,
} from "./pcb-interaction.ts";
import type { PcbToolOptions } from "./pcb-state.ts";
import { createInteraction } from "./interaction.ts";
import {
  pcbHiddenLayers,
  pcbToolOptions,
  setPcbLayerHidden,
  setPcbToolOptions,
} from "./pcb-state.ts";

const options: PcbToolOptions = {
  layer: "F.Cu",
  net: "SIG",
  width: 0.25,
  viaDiameter: 0.6,
  viaDrill: 0.3,
};
function documentWith(semantic: PcbFootprintSemantic): Document {
  const footprint: Element = {
    id: "fp",
    page: "p1",
    type: "pcb.footprint",
    index: "a1",
    semantic,
    visual: {},
  } as Element;
  return {
    schemaVersion: 1,
    id: "d1",
    title: "test",
    pages: [{ id: "p1", name: "PCB", kind: "pcb" }],
    elements: [footprint],
  };
}
const footprint: PcbFootprintSemantic = {
  reference: "U1",
  value: "",
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
      layers: ["F.Cu"],
      net: "GND",
      drill: { diameter: 0.6, offset: [0.5, 0] },
    },
  ],
  graphics: [],
};
function liveInteraction(
  kind: "pcb" | "breadboard" = "pcb",
  tool: ToolKind = Tool.PcbTrack,
) {
  const editor = new Editor();
  editor.setPageKind(editor.currentPageId, kind);
  let currentTool = tool;
  const interaction = createInteraction(editor, {
    tool: () => currentTool,
    setTool: (next) => {
      currentTool = next;
    },
    container: () => undefined,
  });
  return { editor, interaction, pageId: editor.currentPageId };
}
function key(keyValue: string): KeyboardEvent {
  return {
    key: keyValue,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    isComposing: false,
    target: null,
    preventDefault() {},
  } as unknown as KeyboardEvent;
}
function pointer(x: number, y: number): PointerEvent {
  return {
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 1,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: null,
    stopPropagation() {},
    preventDefault() {},
  } as unknown as PointerEvent;
}
function resetOptions(): void {
  setPcbToolOptions(options);
}
describe("PCB canvas interactions", () => {
  test("snaps to the pad anchor rather than its drill-offset copper centre", () => {
    expect(pcbSnapTarget(documentWith(footprint), "p1", [10, 9])).toMatchObject(
      { point: [10, 10], net: "GND", layer: "F.Cu" },
    );
  });
  test("track draft finishes and cancels, with start snap net taking precedence", () => {
    const start = {
      point: [1, 2] as const,
      net: "GND",
      layer: "F.Cu",
      elementId: "fp",
    };
    const first = pcbTrackDraft(
      null,
      { kind: "start", point: [1, 2], target: start },
      options,
    );
    const second = pcbTrackDraft(
      first.draft,
      { kind: "vertex", point: [3, 4] },
      options,
    );
    const finished = pcbTrackDraft(
      second.draft,
      { kind: "finish", point: [3, 4] },
      options,
    );
    expect(finished.draft).toBeNull();
    expect(finished.input).toMatchObject({
      layer: "F.Cu",
      net: "GND",
      width: 0.25,
      points: [
        [1, 2],
        [3, 4],
      ],
    });
    expect(
      pcbTrackDraft(first.draft, { kind: "cancel" }, options).draft,
    ).toBeNull();
  });
  test("via options are used on empty space and snapped net wins over tool net", () => {
    expect(pcbViaInput([2, 3], undefined, options)).toMatchObject({
      at: [2, 3],
      diameter: 0.6,
      drill: 0.3,
      net: "SIG",
    });
    expect(
      pcbViaInput(
        [2, 3],
        { point: [1, 1], net: "GND", layer: "F.Cu", elementId: "x" },
        options,
      ),
    ).toMatchObject({ at: [1, 1], net: "GND" });
  });
  test("PCB palette tools have non-null creations and a PCB category", () => {
    expect(workspaceShapes("pcb").map((item) => item.tool)).toEqual([
      Tool.PcbTrack,
      Tool.PcbVia,
    ]);
    expect(creationFor(Tool.PcbTrack)).not.toBeNull();
    expect(creationFor(Tool.PcbVia)).not.toBeNull();
    expect(
      shapePaletteGroups("pcb").some((group) => group.label === "PCB"),
    ).toBe(true);
  });
  test("Track starts on a pad anchor and Enter commits with the snapped net", () => {
    resetOptions();
    const { editor, interaction, pageId } = liveInteraction();
    editor.createElement("pcb.footprint", { semantic: footprint });
    interaction.placeTool(Tool.PcbTrack, { x: 100, y: 100 });
    expect(interaction.pcbDraft()).toEqual([{ x: 100, y: 100 }]);
    interaction.placeTool(Tool.PcbTrack, { x: 200, y: 200 });
    interaction.onKeyDown(key("Enter"));
    const tracks = editor.store
      .getPageElements(pageId)
      .filter((entry) => entry.type === "pcb.track");
    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.semantic).toMatchObject({
      layer: "F.Cu",
      net: "GND",
      width: 0.25,
      points: [
        [10, 10],
        [20, 20],
      ],
    });
  });
  test("Escape cancels and Enter after one Track click creates nothing", () => {
    const oneClick = liveInteraction();
    oneClick.interaction.placeTool(Tool.PcbTrack, { x: 20, y: 20 });
    oneClick.interaction.onKeyDown(key("Enter"));
    expect(
      oneClick.editor.store
        .getPageElements(oneClick.pageId)
        .filter((entry) => entry.type === "pcb.track"),
    ).toHaveLength(0);
    const cancelled = liveInteraction();
    cancelled.interaction.placeTool(Tool.PcbTrack, { x: 20, y: 20 });
    cancelled.interaction.placeTool(Tool.PcbTrack, { x: 40, y: 40 });
    cancelled.interaction.onKeyDown(key("Escape"));
    expect(
      cancelled.editor.store
        .getPageElements(cancelled.pageId)
        .filter((entry) => entry.type === "pcb.track"),
    ).toHaveLength(0);
    expect(cancelled.interaction.pcbDraft()).toBeNull();
  });
  test("Via tool creates a via and R rotates a selected footprint", () => {
    resetOptions();
    const via = liveInteraction("pcb", Tool.PcbVia);
    via.interaction.placeTool(Tool.PcbVia, { x: 25, y: 35 });
    expect(
      via.editor.store
        .getPageElements(via.pageId)
        .find((entry) => entry.type === "pcb.via")?.semantic,
    ).toMatchObject({ at: [2.5, 3.5], diameter: 0.6, drill: 0.3, net: "SIG" });
    const rotate = liveInteraction();
    const id = rotate.editor.createElement("pcb.footprint", {
      semantic: footprint,
    });
    rotate.editor.selection.set([id]);
    rotate.interaction.onKeyDown(key("r"));
    expect(
      (rotate.editor.store.get(id)?.semantic as PcbFootprintSemantic).rotation,
    ).toBe(180);
  });
  test("configured options apply on empty space, snapped pad net wins, and hidden layers cannot be hit", () => {
    setPcbToolOptions({ layer: "B.Cu", net: "SIG", width: 0.4 });
    const empty = liveInteraction();
    empty.interaction.placeTool(Tool.PcbTrack, { x: 200, y: 200 });
    empty.interaction.placeTool(Tool.PcbTrack, { x: 300, y: 300 });
    empty.interaction.onKeyDown(key("Enter"));
    expect(
      empty.editor.store
        .getPageElements(empty.pageId)
        .find((entry) => entry.type === "pcb.track")?.semantic,
    ).toMatchObject({ layer: "B.Cu", net: "SIG", width: 0.4 });
    setPcbToolOptions(options);
    const net = liveInteraction();
    net.editor.createElement("pcb.footprint", { semantic: footprint });
    net.interaction.placeTool(Tool.PcbTrack, { x: 100, y: 100 });
    net.interaction.placeTool(Tool.PcbTrack, { x: 200, y: 200 });
    net.interaction.onKeyDown(key("Enter"));
    expect(
      net.editor.store
        .getPageElements(net.pageId)
        .find((entry) => entry.type === "pcb.track")?.semantic,
    ).toMatchObject({ net: "GND" });
    const hidden = liveInteraction("pcb", Tool.Select);
    const id = hidden.editor.createElement("pcb.footprint", {
      semantic: footprint,
    });
    const shown = liveInteraction("pcb", Tool.Select);
    const shownId = shown.editor.createElement("pcb.footprint", {
      semantic: footprint,
    });
    shown.interaction.onPointerDown(pointer(100, 100));
    expect(shown.editor.selection.has(shownId)).toBe(true);
    setPcbLayerHidden(hidden.pageId, "F.Cu", true);
    hidden.interaction.onPointerDown(pointer(100, 100));
    expect(hidden.editor.selection.has(id)).toBe(false);
    expect(pcbHiddenLayers(hidden.pageId).has("F.Cu")).toBe(true);
    setPcbLayerHidden(hidden.pageId, "F.Cu", false);
  });
  test("invalid tool options retain the previous transient values", () => {
    resetOptions();
    expect(setPcbToolOptions({ width: 0 })).toBe(false);
    expect(setPcbToolOptions({ viaDiameter: 0.2 })).toBe(false);
    expect(pcbToolOptions()).toEqual(options);
  });
  test("footprint dragging applies one delta and attached track endpoints follow", () => {
    const { editor, interaction, pageId } = liveInteraction("pcb", Tool.Select);
    const id = editor.createElement("pcb.footprint", { semantic: footprint });
    const trackId = editor.createElement("pcb.track", {
      semantic: {
        layer: "F.Cu",
        width: 0.25,
        net: "GND",
        points: [
          [10, 10],
          [15, 10],
        ],
      },
    });
    const bounds = editor.getBounds(id);
    if (!bounds) throw new Error("Expected footprint bounds");
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    interaction.onPointerDown(pointer(x, y));
    interaction.onPointerMove(pointer(x + 20, y + 20));
    interaction.onPointerUp(pointer(x + 20, y + 20));
    expect((editor.store.get(id)?.semantic as PcbFootprintSemantic).at).toEqual(
      [12, 12],
    );
    expect(editor.store.get(trackId)?.semantic).toMatchObject({
      points: [
        [12, 12],
        [15, 10],
      ],
    });
    expect(editor.store.getPageElements(pageId)).toHaveLength(2);
  });
  test("PCB tools do not place generic elements on breadboard pages", () => {
    const { editor, interaction, pageId } = liveInteraction(
      "breadboard",
      Tool.PcbVia,
    );
    interaction.placeTool(Tool.PcbVia, { x: 100, y: 100 });
    expect(editor.store.getPageElements(pageId)).toHaveLength(0);
  });
});
