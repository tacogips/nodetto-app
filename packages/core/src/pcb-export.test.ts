import { expect, test } from "bun:test";
import {
  type Document,
  type Element,
  type GroupSemantic,
  type PathSemantic,
  validateDocument,
} from "@nodetto/ir";
import polygonClipping, { type Polygon } from "polygon-clipping";
import { isZip, readZip } from "@nodetto/io";
import {
  encodePcbExportZip,
  exportPcbPage,
  fabricationLayerGroups,
  PcbExportError,
} from "./pcb-export.ts";
import { importPcbFiles, type PcbImportFile } from "./pcb-import.ts";
import {
  gerberShape,
  outlineBounds,
  readExcellon,
  readGerber,
} from "./pcb/index.ts";
import { flattenStroke } from "./stroke-path.ts";

const HEADER = [
  "%FSLAX46Y46*%",
  "%MOMM*%",
  "%ADD10C,0.200000*%",
  "%ADD11C,1.000000*%",
  "%ADD12R,1.500000X1.000000*%",
];
const gerber = (fileFunction: string, ...body: string[]) =>
  [`%TF.FileFunction,${fileFunction}*%`, ...HEADER, ...body, "M02*"].join("\n");
const mm = (value: number) => String(Math.round(value * 1_000_000));
const at = (x: number, y: number) => `X${mm(x)}Y${mm(y)}`;

/** A 30 x 20 mm board: a copper pour with a pad-sized hole and a pad inside it. */
const BOARD: readonly PcbImportFile[] = [
  {
    name: "demo-Edge_Cuts.gm1",
    text: gerber(
      "Profile,NP",
      "D10*",
      `${at(0, 0)}D02*`,
      `${at(30, 0)}D01*`,
      `${at(30, 20)}D01*`,
      `${at(0, 20)}D01*`,
      `${at(0, 0)}D01*`,
    ),
  },
  {
    name: "demo-F_Cu.gtl",
    text: gerber(
      "Copper,L1,Top",
      "G36*",
      `${at(2, 2)}D02*`,
      `${at(14, 2)}D01*`,
      `${at(14, 18)}D01*`,
      `${at(2, 18)}D01*`,
      `${at(2, 2)}D01*`,
      "G37*",
      "%LPC*%",
      "G36*",
      `${at(6, 8)}D02*`,
      `${at(10, 8)}D01*`,
      `${at(10, 12)}D01*`,
      `${at(6, 12)}D01*`,
      `${at(6, 8)}D01*`,
      "G37*",
      "%LPD*%",
      "D11*",
      `${at(8, 10)}D03*`,
      `${at(20, 10)}D03*`,
      "D12*",
      `${at(25, 5)}D03*`,
      "D10*",
      `${at(20, 10)}D02*`,
      `${at(25, 5)}D01*`,
    ),
  },
  {
    name: "demo-B_Cu.gbl",
    text: gerber("Copper,L2,Bot", "D11*", `${at(8, 10)}D03*`),
  },
  {
    name: "demo-F_Mask.gts",
    text: gerber("Soldermask,Top", "D11*", `${at(20, 10)}D03*`),
  },
  {
    name: "demo-F_SilkS.gto",
    text: gerber(
      "Legend,Top",
      "D10*",
      `${at(18, 15)}D02*`,
      `${at(28, 15)}D01*`,
    ),
  },
  {
    name: "demo-PTH.drl",
    text: [
      "M48",
      "; #@! TF.FileFunction,Plated,1,2,PTH",
      "METRIC",
      "T1C0.8",
      "T2C1.0",
      "%",
      "T1",
      "X8.0Y10.0",
      "X20.0Y10.0",
      "T2",
      "X22.0Y16.0G85X26.0Y16.0",
      "M30",
    ].join("\n"),
  },
  {
    name: "demo-NPTH.drl",
    text: [
      "M48",
      "; #@! TF.FileFunction,NonPlated,1,2,NPTH",
      "METRIC",
      "T1C3.2",
      "%",
      "T1",
      "X3.0Y3.0",
      "M30",
    ].join("\n"),
  },
];

const imported = (files: readonly PcbImportFile[] = BOARD): Document =>
  importPcbFiles(files, { pageName: "demo" }).document;

const groupOf = (document: Document, file: string): Element => {
  const group = fabricationLayerGroups(document, "pcb-page-1").find(
    (element) =>
      (element.semantic as GroupSemantic).fabricationLayer?.file === file,
  );
  if (!group) throw new Error(`no group for ${file}`);
  return group;
};

const membersOf = (document: Document, file: string): Element[] => {
  const ids = new Set(
    (groupOf(document, file).semantic as GroupSemantic).memberIds,
  );
  return document.elements.filter((element) => ids.has(element.id));
};

/** Filled area of a layer group's paths, from their page contours. */
const layerArea = (document: Document, file: string): number => {
  const polygons: Polygon[] = [];
  for (const element of membersOf(document, file)) {
    const rings = (element.semantic as PathSemantic).contours.map((contour) =>
      flattenStroke(contour.points, true, 0.001).map(
        (point): [number, number] => [point.x, point.y],
      ),
    );
    const signed = (ring: readonly [number, number][]) =>
      ring.reduce((sum, [x, y], index) => {
        const [nx, ny] = ring[(index + 1) % ring.length] as [number, number];
        return sum + x * ny - nx * y;
      }, 0);
    const outerSign = Math.sign(signed(rings[0] ?? []));
    for (const ring of rings) {
      const last = polygons.at(-1);
      if (Math.sign(signed(ring)) !== outerSign && last) last.push(ring);
      else polygons.push([ring]);
    }
  }
  const [first, ...rest] = polygons;
  if (!first) return 0;
  return polygonClipping.union(first, ...rest).reduce(
    (sum, polygon) =>
      sum +
      polygon.reduce((inner, ring, index) => {
        let doubled = 0;
        for (let i = 0; i < ring.length - 1; i++) {
          const [ax, ay] = ring[i] as [number, number];
          const [bx, by] = ring[i + 1] as [number, number];
          doubled += ax * by - bx * ay;
        }
        return inner + (index === 0 ? 1 : -1) * Math.abs(doubled / 2);
      }, 0),
    0,
  );
};

const reimport = (document: Document): Document =>
  imported(
    exportPcbPage(document, "pcb-page-1").files.map((file) => ({
      name: file.path,
      text: file.text,
    })),
  );

const gerberBounds = (text: string) =>
  outlineBounds(
    readGerber(text)
      .objects.map(gerberShape)
      .flatMap((shape) => shape.pieces.map((piece) => piece.area)),
  );

const fileText = (document: Document, path: string): string => {
  const file = exportPcbPage(document, "pcb-page-1").files.find(
    (candidate) => candidate.path === path,
  );
  if (!file) throw new Error(`no ${path}`);
  return file.text;
};

test("Gerber import tags each layer group with its layer and page placement", () => {
  const document = imported();
  expect(
    validateDocument(document).filter((issue) => issue.severity === "error"),
  ).toEqual([]);
  const copper = (groupOf(document, "demo-F_Cu.gtl").semantic as GroupSemantic)
    .fabricationLayer;
  expect(copper).toEqual({
    kind: "copper",
    side: "top",
    file: "demo-F_Cu.gtl",
    unitsPerMm: 10,
    originX: -5.1,
    originY: 25.1,
  });
  expect(
    (groupOf(document, "demo-NPTH.drl").semantic as GroupSemantic)
      .fabricationLayer?.plating,
  ).toBe("nonPlated");
});

test("an unedited board exports every layer under its file name with the same artwork", () => {
  const document = imported();
  const report = exportPcbPage(document, "pcb-page-1");
  expect(report.warnings).toEqual([]);
  expect(report.files.map((file) => file.path).sort()).toEqual(
    BOARD.map((file) => file.name).sort(),
  );
  for (const file of report.files)
    if (!file.path.endsWith(".drl"))
      expect(readGerber(file.text).warnings).toEqual([]);
  const again = reimport(document);
  for (const file of BOARD) {
    if (file.name.endsWith(".drl")) continue;
    const before = layerArea(document, file.name);
    expect(before).toBeGreaterThan(0);
    expect(
      Math.abs(layerArea(again, file.name) - before) / before,
    ).toBeLessThan(0.002);
  }
  // The pad inside the pour's hole survives the hole's clear region.
  const copper = readGerber(fileText(document, "demo-F_Cu.gtl"));
  expect(copper.objects.some((object) => object.polarity === "clear")).toBe(
    true,
  );
  expect(layerArea(again, "demo-F_Cu.gtl")).toBeCloseTo(
    layerArea(document, "demo-F_Cu.gtl"),
    -1,
  );
});

test("drill layers export as holes and slots with their plating", () => {
  const document = imported();
  const plated = readExcellon(fileText(document, "demo-PTH.drl"));
  expect(plated.plating).toBe("plated");
  expect(plated.warnings).toEqual([]);
  expect(
    plated.holes
      .map((hole) => [hole.at.x, hole.at.y, hole.diameter])
      .sort((a, b) => (a[0] as number) - (b[0] as number)),
  ).toEqual([
    [8, 10, 0.8],
    [20, 10, 0.8],
  ]);
  expect(plated.slots).toEqual([
    { from: { x: 22, y: 16 }, to: { x: 26, y: 16 }, diameter: 1 },
  ]);
  const nonPlated = readExcellon(fileText(document, "demo-NPTH.drl"));
  expect(nonPlated.plating).toBe("nonPlated");
  expect(nonPlated.holes).toEqual([{ at: { x: 3, y: 3 }, diameter: 3.2 }]);
});

/** Adds `added` to the page as members of the layer groups of `files`. */
const withMembers = (
  document: Document,
  edit: (element: Element) => Element | undefined,
  added: readonly (readonly [string, Element])[],
): Document => {
  const groups = new Map(
    added.map(([file, element]) => [groupOf(document, file).id, element.id]),
  );
  return {
    ...document,
    elements: [
      ...document.elements.flatMap((element): Element[] => {
        const extra = groups.get(element.id);
        const changed = extra
          ? {
              ...element,
              semantic: {
                ...(element.semantic as GroupSemantic),
                memberIds: [
                  ...(element.semantic as GroupSemantic).memberIds,
                  extra,
                ],
              },
            }
          : edit(element);
        return changed ? [changed] : [];
      }),
      ...added.map(([, element]) => element),
    ],
  };
};

test("edits on the page reach the files: moved, rotated, deleted and added shapes", () => {
  const document = imported();
  const copperBefore = gerberBounds(fileText(document, "demo-F_Cu.gtl"));
  const moved = new Set(
    membersOf(document, "demo-F_Cu.gtl").map((element) => element.id),
  );
  const drillFlashes = membersOf(document, "demo-PTH.drl").find(
    (element) => (element.semantic as PathSemantic).name === "Flashes",
  );
  const silkLine = membersOf(document, "demo-F_SilkS.gto")[0];
  // Page (x, y) is board (x / 10 - 5.1, 25.1 - y / 10) in millimetres.
  const edited = withMembers(
    document,
    (element) => {
      if (element.id === drillFlashes?.id) return undefined;
      if (moved.has(element.id))
        return {
          ...element,
          visual: { ...element.visual, x: (element.visual.x ?? 0) + 20 },
        };
      if (element.id === silkLine?.id)
        return { ...element, visual: { ...element.visual, rotation: 90 } };
      return element;
    },
    [
      [
        "demo-F_SilkS.gto",
        {
          id: "added-rect",
          page: "pcb-page-1",
          type: "shape.geo",
          index: "z0",
          semantic: { geo: "rect", label: "" },
          // Board 5..10 x 15..17 mm.
          visual: { x: 101, y: 81, width: 50, height: 20 },
        },
      ],
      [
        "demo-PTH.drl",
        {
          id: "added-hole",
          page: "pcb-page-1",
          type: "shape.geo",
          index: "z1",
          semantic: { geo: "ellipse", label: "" },
          // A 1.2 mm hole at board (15, 5).
          visual: { x: 195, y: 195, width: 12, height: 12 },
        },
      ],
    ],
  );
  const copperAfter = gerberBounds(fileText(edited, "demo-F_Cu.gtl"));
  expect(copperAfter?.minX).toBeCloseTo((copperBefore?.minX ?? 0) + 2, 6);
  expect(copperAfter?.maxY).toBeCloseTo(copperBefore?.maxY ?? 0, 6);
  expect(readExcellon(fileText(edited, "demo-PTH.drl")).holes).toEqual([
    { at: { x: 15, y: 5 }, diameter: 1.2 },
  ]);
  // The 10 mm line along y = 15 now stands upright about its centre (23, 15).
  const silk = gerberBounds(fileText(edited, "demo-F_SilkS.gto"));
  expect(silk?.minX).toBeCloseTo(5, 6);
  expect(silk?.maxX).toBeCloseTo(23.1, 6);
  expect(silk?.maxY).toBeCloseTo(20.1, 6);
});

test("shapes without a filled outline are reported, and a page needs Gerber layers", () => {
  const document = imported();
  const withText = withMembers(document, (element) => element, [
    [
      "demo-F_SilkS.gto",
      {
        id: "note",
        page: "pcb-page-1",
        type: "text.note",
        index: "z0",
        semantic: { text: "REV B" },
        visual: { x: 10, y: 10 },
      },
    ],
  ]);
  expect(exportPcbPage(withText, "pcb-page-1").warnings).toEqual([
    "demo-F_SilkS.gto: 1 text.note element(s) have no filled outline and are left out",
  ]);
  expect(() => exportPcbPage(document, "missing")).toThrow(PcbExportError);
});

test("the files zip into one board house upload", () => {
  const zip = encodePcbExportZip(exportPcbPage(imported(), "pcb-page-1"));
  expect(isZip(zip)).toBe(true);
  expect(
    readZip(zip)
      .map((entry) => entry.path)
      .sort(),
  ).toEqual(BOARD.map((file) => file.name).sort());
});

test("fabrication layers are validated", () => {
  const document = imported();
  const group = groupOf(document, "demo-F_Cu.gtl");
  const broken: Document = {
    ...document,
    elements: document.elements.map((element) =>
      element.id === group.id
        ? {
            ...element,
            semantic: {
              ...(element.semantic as GroupSemantic),
              fabricationLayer: {
                kind: "copper",
                side: "middle",
                unitsPerMm: 0,
                originX: 0,
                originY: 0,
              },
            },
          }
        : element,
    ),
  };
  expect(
    validateDocument(broken)
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.path.replace(/^.*fabricationLayer/, "")),
  ).toEqual([".side", ".unitsPerMm"]);
});

test("the board outline goes back as cut lines: lines, arcs and added shapes", () => {
  const rounded: PcbImportFile = {
    name: "round-Edge_Cuts.gm1",
    text: [
      "%TF.FileFunction,Profile,NP*%",
      "%FSLAX46Y46*%",
      "%MOMM*%",
      "%ADD10C,0.150000*%",
      "D10*",
      "G75*",
      `${at(2, 0)}D02*`,
      `${at(20, 0)}D01*`,
      `G03*${at(22, 2)}I0J${mm(2)}D01*`,
      `G01*${at(22, 12)}D01*`,
      `${at(0, 12)}D01*`,
      `${at(0, 2)}D01*`,
      `G02*${at(2, 0)}I${mm(2)}J0D01*`,
      "M02*",
    ].join("\n"),
  };
  const document = imported([rounded]);
  const exported = readGerber(fileText(document, "round-Edge_Cuts.gm1"));
  expect(exported.warnings).toEqual([]);
  const draws = exported.objects.map((object) => {
    if (object.kind !== "draw") throw new Error(`a ${object.kind} object`);
    expect(object.aperture).toEqual({ kind: "circle", diameter: 0.15 });
    const point = (p: { x: number; y: number }) =>
      [Number(p.x.toFixed(4)), Number(p.y.toFixed(4))].join(",");
    const ends = [point(object.from), point(object.to)].sort().join(" ");
    return object.arc ? `arc ${ends} about ${point(object.arc.center)}` : ends;
  });
  expect(draws.sort()).toEqual(
    [
      "0,12 0,2",
      "0,12 22,12",
      "2,0 20,0",
      "22,12 22,2",
      "arc 0,2 2,0 about 2,2",
      "arc 20,0 22,2 about 20,2",
    ].sort(),
  );

  const cut = withMembers(document, (element) => element, [
    [
      "round-Edge_Cuts.gm1",
      {
        id: "slot-cut",
        page: "pcb-page-1",
        type: "shape.geo",
        index: "z0",
        semantic: { geo: "rect", label: "" },
        // A 4 x 2 mm cut-out at board 5..9 x 5..7.
        visual: { x: 100.75, y: 120.75, width: 40, height: 20 },
      },
    ],
  ]);
  const report = exportPcbPage(cut, "pcb-page-1");
  expect(report.warnings).toEqual([
    "round-Edge_Cuts.gm1: 1 shape(s) are cut along their edges with 0.15 mm lines",
  ]);
  const edges = readGerber(
    report.files.find((file) => file.path === "round-Edge_Cuts.gm1")
      ?.text as string,
  ).objects.length;
  expect(edges).toBe(6 + 4);
});
