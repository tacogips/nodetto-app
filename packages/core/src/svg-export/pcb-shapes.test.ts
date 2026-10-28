import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "bun:test";
import type {
  Element,
  PcbFootprintSemantic,
  PcbGraphicItem,
  PcbTrackSemantic,
} from "@nodetto/ir";
import { importKicadPcb } from "@nodetto/io";
import { pcbDocumentFromPlan } from "../pcb-board/page.ts";
import { PCB_BOARD_COLOR, pcbViewModel } from "../pcb-board/view.ts";
import { Editor } from "../editor.ts";
import { unionBoxes } from "../geometry.ts";
import { createShapeContext } from "../hit-test.ts";
import { Store } from "../store.ts";
import { createDefaultRegistry } from "../shapes/index.ts";
import { fmt } from "./markup.ts";
import { renderShape } from "./shapes.ts";
import { DEFAULT_SVG_THEME } from "./theme.ts";

const root = resolve(import.meta.dir, "../../../../");
const fixtureText = readFileSync(
  resolve(root, "test-fixtures/kicad/two-layer.kicad_pcb"),
  "utf8",
);
const imported = importKicadPcb(fixtureText, {
  fileName: "two-layer.kicad_pcb",
});
if (!imported.plan) throw new Error("PCB fixture did not produce a plan");
const fixtureDocument = pcbDocumentFromPlan(imported.plan, {
  pageName: imported.plan.title,
});
const registry = createDefaultRegistry();

function makeEditor(elements = fixtureDocument.elements): Editor {
  return new Editor({ document: { ...fixtureDocument, elements } });
}

function groups(svg: string): { id: string; body: string }[] {
  const result: { id: string; body: string }[] = [];
  let cursor = 0;
  while (true) {
    const start = svg.indexOf('<g data-id="', cursor);
    if (start < 0) break;
    const idStart = start + '<g data-id="'.length;
    const idEnd = svg.indexOf('"', idStart);
    const bodyStart = svg.indexOf(">", idEnd) + 1;
    const end = svg.indexOf("</g>", bodyStart);
    if (idEnd < 0 || bodyStart === 0 || end < 0)
      throw new Error("malformed element group in SVG");
    result.push({
      id: svg.slice(idStart, idEnd),
      body: svg.slice(bodyStart, end),
    });
    cursor = end + "</g>".length;
  }
  return result;
}

function tags(group: string): string[] {
  const result: string[] = [];
  let cursor = 0;
  while (cursor < group.length) {
    const path = group.indexOf("<path", cursor);
    const circle = group.indexOf("<circle", cursor);
    const start =
      path < 0 ? circle : circle < 0 ? path : Math.min(path, circle);
    if (start < 0) break;
    const end = group.indexOf(" />", start);
    if (end < 0) throw new Error("malformed primitive tag in SVG");
    result.push(group.slice(start, end + 3));
    cursor = end + 3;
  }
  return result;
}

function pathD(tag: string): string | undefined {
  const start = tag.indexOf(' d="');
  if (start < 0) return undefined;
  const valueStart = start + 4;
  const end = tag.indexOf('"', valueStart);
  return end < 0 ? undefined : tag.slice(valueStart, end);
}

function elementGroup(svg: string, id: string): string {
  const group = groups(svg).find((item) => item.id === id);
  if (!group) throw new Error(`missing SVG group for ${id}`);
  return group.body;
}

function count(haystack: string, needle: string): number {
  let total = 0;
  let cursor = 0;
  while (true) {
    const found = haystack.indexOf(needle, cursor);
    if (found < 0) return total;
    total += 1;
    cursor = found + needle.length;
  }
}

function attr(tag: string, name: string): string | undefined {
  const prefix = `${name}="`;
  const start = tag.indexOf(prefix);
  if (start < 0) return undefined;
  const valueStart = start + prefix.length;
  const end = tag.indexOf('"', valueStart);
  return end < 0 ? undefined : tag.slice(valueStart, end);
}

test("PCB fixture exports every element kind with canvas-equivalent geometry", () => {
  const editor = makeEditor();
  const svg = editor.exportPageSvg({ padding: 16, background: null });
  if (!svg) throw new Error("PCB fixture export was empty");
  expect(svg).not.toContain("unsupported:");

  for (const type of [
    "pcb.track",
    "pcb.via",
    "pcb.zone",
    "pcb.footprint",
    "pcb.graphic",
  ])
    expect(svg).toContain(`data-type="${type}"`);
  const boardElement = fixtureDocument.elements.find(
    (element) => element.type === "pcb.board",
  );
  if (!boardElement) throw new Error("fixture board missing");
  expect(
    renderShape(
      boardElement,
      { x: 0, y: 0, width: 1, height: 1 },
      DEFAULT_SVG_THEME,
    ),
  ).toBe("");

  const tracks = fixtureDocument.elements.filter(
    (element) => element.type === "pcb.track",
  );
  const frontTrack = tracks.find(
    (element) => (element.semantic as PcbTrackSemantic).layer === "F.Cu",
  );
  const backTrack = tracks.find(
    (element) => (element.semantic as PcbTrackSemantic).layer === "B.Cu",
  );
  if (!frontTrack || !backTrack)
    throw new Error("fixture copper tracks missing");
  const frontTrackTags = tags(elementGroup(svg, frontTrack.id));
  const frontTrackTag = frontTrackTags[0];
  if (!frontTrackTag) throw new Error("fixture front track path missing");
  expect(frontTrackTag.startsWith('<path d="')).toBe(true);
  const pathAttributeOrder = [
    frontTrackTag.indexOf(' d="'),
    frontTrackTag.indexOf(' stroke="'),
    frontTrackTag.indexOf(' stroke-width="'),
    frontTrackTag.indexOf(' fill="'),
    frontTrackTag.indexOf(' stroke-linecap="'),
    frontTrackTag.indexOf(' stroke-linejoin="'),
  ];
  expect(
    pathAttributeOrder.every(
      (position, index) =>
        position >= 0 &&
        (index === 0 || position > (pathAttributeOrder[index - 1] ?? -1)),
    ),
  ).toBe(true);
  expect(elementGroup(svg, frontTrack.id)).toContain('stroke="#c83434"');
  expect(elementGroup(svg, backTrack.id)).toContain('stroke="#3466c8"');
  expect(svg).toContain('d="M 230 100 A ');
  expect(svg).toContain(' 292.5 100"');

  const footprints = fixtureDocument.elements.filter(
    (element) => element.type === "pcb.footprint",
  );
  expect(
    footprints.some((element) =>
      elementGroup(svg, element.id).includes('fill="#c83434"'),
    ),
  ).toBe(true);
  const via = fixtureDocument.elements.find(
    (element) => element.type === "pcb.via",
  );
  if (!via) throw new Error("fixture via missing");
  const viaTag = tags(elementGroup(svg, via.id))[0];
  if (!viaTag) throw new Error("fixture via circle missing");
  expect(viaTag.startsWith('<circle cx="')).toBe(true);
  const circleAttributeOrder = [
    viaTag.indexOf(' cx="'),
    viaTag.indexOf(' cy="'),
    viaTag.indexOf(' r="'),
    viaTag.indexOf(' stroke="'),
    viaTag.indexOf(' stroke-width="'),
    viaTag.indexOf(' fill="'),
  ];
  expect(
    circleAttributeOrder.every(
      (position, index) =>
        position >= 0 &&
        (index === 0 || position > (circleAttributeOrder[index - 1] ?? -1)),
    ),
  ).toBe(true);
  expect(elementGroup(svg, via.id)).toContain('stroke="#e0c674"');
  expect(elementGroup(svg, via.id)).toContain('fill="#202020"');

  const zone = fixtureDocument.elements.find(
    (element) => element.type === "pcb.zone",
  );
  if (!zone) throw new Error("fixture zone missing");
  expect(elementGroup(svg, zone.id)).toContain(
    'fill="#3466c8" fill-opacity="0.35"',
  );
  const fillStart = svg.indexOf(' fill="');
  let fillCursor = fillStart;
  while (fillCursor >= 0) {
    const valueStart = fillCursor + ' fill="'.length;
    const valueEnd = svg.indexOf('"', valueStart);
    expect(svg.slice(valueStart, valueEnd).length).not.toBe(9);
    fillCursor = svg.indexOf(' fill="', valueEnd);
  }

  const graphics = fixtureDocument.elements.filter(
    (element) => element.type === "pcb.graphic",
  );
  const silk = graphics.find((element) => {
    const graphic = element.semantic as PcbGraphicItem;
    return graphic.shape.kind === "text" && graphic.shape.text === "Nodetto";
  });
  const edge = graphics.find(
    (element) => (element.semantic as PcbGraphicItem).layer === "Edge.Cuts",
  );
  if (!silk || !edge)
    throw new Error("fixture silk or outline graphic missing");
  expect(elementGroup(svg, silk.id)).toContain('stroke="#f2eecb"');
  expect(
    footprints.some((element) =>
      elementGroup(svg, element.id).includes('stroke="#f2eecb"'),
    ),
  ).toBe(true);
  expect(elementGroup(svg, edge.id)).toContain('stroke="#d0d0d0"');

  for (const element of fixtureDocument.elements) {
    if (element.type === "pcb.board") continue;
    const model = pcbViewModel(element, new Set(), fmt);
    const primitiveTags = tags(elementGroup(svg, element.id));
    expect(primitiveTags).toHaveLength(model.length);
    const modelPaths = model.filter((item) => item.kind === "path");
    const exportedPaths = primitiveTags
      .filter((item) => item.startsWith("<path"))
      .map(pathD);
    expect(exportedPaths).toEqual(modelPaths.map((item) => item.d));
  }
});

test("PCB board rect follows the page background and covers PCB box union", () => {
  const editor = makeEditor();
  const withBackground = editor.exportPageSvg({ background: "#ffffff" });
  if (!withBackground) throw new Error("PCB fixture export was empty");
  expect(count(withBackground, 'data-layer="pcb-board"')).toBe(1);
  const backgroundAt = withBackground.indexOf('fill="#ffffff"');
  const boardAt = withBackground.indexOf('data-layer="pcb-board"');
  const shapesAt = withBackground.indexOf('data-layer="shapes"');
  expect(backgroundAt).toBeGreaterThanOrEqual(0);
  expect(backgroundAt).toBeLessThan(boardAt);
  expect(boardAt).toBeLessThan(shapesAt);

  const store = new Store(fixtureDocument);
  const context = createShapeContext(store, registry, 1);
  const pcbBoxes = fixtureDocument.elements
    .filter(
      (element) =>
        element.type.startsWith("pcb.") && element.type !== "pcb.board",
    )
    .map((element) => {
      const box = registry
        .getOrFallback(element.type)
        .getBounds(element, context);
      return box
        ? {
            ...box,
            width: Math.max(1, box.width),
            height: Math.max(1, box.height),
          }
        : null;
    })
    .filter((box) => box !== null);
  const expected = unionBoxes(pcbBoxes);
  if (!expected) throw new Error("fixture PCB boxes missing");
  const boardTagStart = withBackground.indexOf('<rect data-layer="pcb-board"');
  const boardTagEnd = withBackground.indexOf(" />", boardTagStart);
  const boardTag = withBackground.slice(boardTagStart, boardTagEnd + 3);
  expect(attr(boardTag, "x")).toBe(fmt(expected.x));
  expect(attr(boardTag, "y")).toBe(fmt(expected.y));
  expect(attr(boardTag, "width")).toBe(fmt(expected.width));
  expect(attr(boardTag, "height")).toBe(fmt(expected.height));
  expect(attr(boardTag, "fill")).toBe(PCB_BOARD_COLOR);

  const transparent = editor.exportPageSvg({ background: null });
  expect(transparent).not.toContain('fill="#ffffff"');
  expect(transparent).toContain('data-layer="pcb-board"');

  const track = fixtureDocument.elements.find(
    (element) => element.type === "pcb.track",
  );
  if (!track) throw new Error("fixture track missing");
  editor.selection.set([track.id]);
  const selection = editor.exportSelectionSvg();
  if (!selection) throw new Error("selected track export was empty");
  const trackBox = registry.getOrFallback(track.type).getBounds(track, context);
  if (!trackBox) throw new Error("fixture track bounds missing");
  const selectionBoardStart = selection.indexOf('<rect data-layer="pcb-board"');
  const selectionBoardEnd = selection.indexOf(" />", selectionBoardStart);
  const selectionBoard = selection.slice(
    selectionBoardStart,
    selectionBoardEnd + 3,
  );
  expect(attr(selectionBoard, "x")).toBe(fmt(trackBox.x));
  expect(attr(selectionBoard, "y")).toBe(fmt(trackBox.y));
  expect(attr(selectionBoard, "width")).toBe(fmt(Math.max(1, trackBox.width)));
  expect(attr(selectionBoard, "height")).toBe(
    fmt(Math.max(1, trackBox.height)),
  );
});

test("hidden PCB texts and elements are omitted, and export is deterministic", () => {
  const footprint = fixtureDocument.elements.find(
    (element) => element.type === "pcb.footprint",
  );
  if (!footprint) throw new Error("fixture footprint missing");
  const semantic = footprint.semantic as PcbFootprintSemantic;
  const textIndex = semantic.graphics.findIndex(
    (graphic) => graphic.shape.kind === "text",
  );
  if (textIndex < 0) throw new Error("fixture footprint text missing");
  const sourceGraphic = semantic.graphics[textIndex];
  if (!sourceGraphic || sourceGraphic.shape.kind !== "text")
    throw new Error("fixture footprint text missing");
  const hiddenSemantic: PcbFootprintSemantic = {
    ...semantic,
    graphics: semantic.graphics.map((graphic, index) =>
      index === textIndex
        ? {
            ...graphic,
            shape: { ...sourceGraphic.shape, hidden: true },
          }
        : graphic,
    ),
  };
  const hiddenFootprint: Element = { ...footprint, semantic: hiddenSemantic };
  const hiddenEditor = makeEditor(
    fixtureDocument.elements.map((element) =>
      element.id === footprint.id ? hiddenFootprint : element,
    ),
  );
  const hiddenSvg = hiddenEditor.exportPageSvg({ background: null });
  if (!hiddenSvg) throw new Error("hidden text fixture export was empty");
  expect(tags(elementGroup(hiddenSvg, footprint.id))).toHaveLength(
    pcbViewModel(hiddenFootprint).length,
  );
  expect(pcbViewModel(hiddenFootprint).length).toBeLessThan(
    pcbViewModel(footprint).length,
  );

  const track = fixtureDocument.elements.find(
    (element) => element.type === "pcb.track",
  );
  if (!track) throw new Error("fixture track missing");
  const hiddenTrack: Element = {
    ...track,
    visual: { ...track.visual, hidden: true },
  };
  const hiddenTrackEditor = makeEditor(
    fixtureDocument.elements.map((element) =>
      element.id === track.id ? hiddenTrack : element,
    ),
  );
  const hiddenTrackSvg = hiddenTrackEditor.exportPageSvg({ background: null });
  if (!hiddenTrackSvg) throw new Error("hidden track export was empty");
  expect(hiddenTrackSvg).not.toContain(`data-id="${track.id}"`);

  const editor = makeEditor();
  expect(editor.exportPageSvg({ background: null })).toBe(
    editor.exportPageSvg({ background: null }),
  );
});

test("non-PCB pages do not receive a PCB board rect", () => {
  const nonPcb = new Editor({
    document: {
      ...fixtureDocument,
      pages: [{ id: "plain", name: "Plain", kind: "freeform" }],
      elements: [
        {
          id: "generic",
          page: "plain",
          type: "node.generic",
          index: "a1",
          semantic: { label: "plain" },
          visual: { x: 0, y: 0, width: 40, height: 30 },
        },
      ],
    },
  });
  expect(nonPcb.exportPageSvg()).not.toContain("pcb-board");
});
