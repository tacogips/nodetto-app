import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Element,
  MAX_PATH_CONTOURS,
  MAX_PATH_POINTS,
  type PathSemantic,
  validateDocument,
} from "@nodetto/ir";
import { importPcbFiles, importPcbPage, PcbImportError } from "./pcb-import.ts";
import { compoundPathGeometry } from "./shapes/compound-path.ts";

const HEADER = [
  "%FSLAX46Y46*%",
  "%MOMM*%",
  "%ADD10C,0.200000*%",
  "%ADD11C,1.000000*%",
];
const gerber = (fileFunction: string, ...body: string[]) =>
  [`%TF.FileFunction,${fileFunction}*%`, ...HEADER, ...body, "M02*"].join("\n");

const OUTLINE = gerber(
  "Profile,NP",
  "D10*",
  "X0Y0D02*",
  "X20000000Y0D01*",
  "X20000000Y10000000D01*",
  "X0Y10000000D01*",
  "X0Y0D01*",
);

const paths = (elements: readonly Element[], group: string) => {
  const layer = elements.find(
    (element) =>
      element.type === "group" &&
      String(element.visual.layerName).startsWith(group),
  );
  const members = new Set(
    (layer?.semantic as { memberIds: string[] } | undefined)?.memberIds,
  );
  return elements.filter((element) => members.has(element.id));
};

const contourCount = (elements: readonly Element[]) =>
  elements.reduce(
    (sum, element) => sum + (element.semantic as PathSemantic).contours.length,
    0,
  );

test("layers become named groups of paths in board coordinates, painted bottom first", () => {
  const report = importPcbFiles([
    {
      name: "b.gto",
      text: gerber(
        "Legend,Top",
        "D10*",
        "X1000000Y1000000D02*",
        "X5000000Y1000000D01*",
      ),
    },
    {
      name: "b.gbl",
      text: gerber("Copper,L2,Bot", "D11*", "X2000000Y2000000D03*"),
    },
    { name: "b.gm1", text: OUTLINE },
    {
      name: "b.gts",
      text: gerber("Soldermask,Top", "D11*", "X2000000Y2000000D03*"),
    },
  ]);
  expect(report.warnings).toEqual([]);
  expect(
    validateDocument(report.document).filter(
      (issue) => issue.severity === "error",
    ),
  ).toEqual([]);
  expect(report.size.width).toBeCloseTo(20.2, 6);
  expect(report.size.height).toBeCloseTo(10.2, 6);
  const groups = report.document.elements.filter(
    (element) => element.type === "group",
  );
  expect(groups.map((group) => group.visual.layerName)).toEqual([
    "Bottom copper (b.gbl)",
    "Top solder mask (b.gts)",
    "Top silkscreen (b.gto)",
    "Board outline (b.gm1)",
  ]);
  expect(groups.map((group) => group.visual.hidden === true)).toEqual([
    false,
    true,
    false,
    false,
  ]);
  // The pad at (2, 2) mm: 10 units per mm, a 5 mm margin, y flipped.
  const [pad] = paths(report.document.elements, "Bottom copper");
  const box = pad?.visual;
  expect(box?.x).toBeCloseTo((2 - 0.5 - -0.1 + 5) * 10, 6);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeCloseTo(
    (10.1 - 2 + 0.5 + 5) * 10,
    6,
  );
  expect((pad?.semantic as PathSemantic).name).toBe("Pads");
});

test("clear polarity cuts earlier dark objects, not later ones", () => {
  const silk = gerber(
    "Legend,Top",
    "D10*",
    "X0Y0D02*",
    "X10000000Y0D01*",
    "%LPC*%",
    "D11*",
    "X5000000Y0D03*",
    "%LPD*%",
    "D10*",
    "X0Y5000000D02*",
    "X10000000Y5000000D01*",
  );
  const page = importPcbPage([{ name: "silk.gto", text: silk }]);
  const lines = paths(page.elements, "Top silkscreen");
  // The first line is split in two around the clear pad; the later line is whole.
  expect(contourCount(lines)).toBe(3);
});

test("large layers split into paths within the document limits", () => {
  const flashes: string[] = ["D11*"];
  for (let index = 0; index < 2 * MAX_PATH_CONTOURS + 10; index++)
    flashes.push(
      `X${(index % 100) * 2000000}Y${Math.floor(index / 100) * 2000000}D03*`,
    );
  const page = importPcbPage([
    { name: "big.gtl", text: gerber("Copper,L1,Top", ...flashes) },
  ]);
  const pads = paths(page.elements, "Top copper");
  expect(pads.length).toBeGreaterThanOrEqual(3);
  for (const element of pads) {
    const semantic = element.semantic as PathSemantic;
    expect(semantic.contours.length).toBeLessThanOrEqual(MAX_PATH_CONTOURS);
    expect(
      semantic.contours.reduce(
        (sum, contour) => sum + contour.points.length,
        0,
      ),
    ).toBeLessThanOrEqual(MAX_PATH_POINTS);
  }
  expect(contourCount(pads)).toBe(2 * MAX_PATH_CONTOURS + 10);
});

test("a ring keeps its hole in the same path as its outer edge", () => {
  const ring = gerber(
    "Copper,L1,Top",
    "D10*",
    "G75*",
    "X1000000Y0D02*",
    "G03X1000000Y0I-1000000J0D01*",
  );
  const [element] = paths(
    importPcbPage([{ name: "ring.gtl", text: ring }]).elements,
    "Top copper",
  );
  expect((element?.semantic as PathSemantic).contours).toHaveLength(2);
});

test("drill files draw holes and slots; ids avoid reserved ones; readable errors", () => {
  const drill = [
    "M48",
    "METRIC",
    "T1C1.0",
    "%",
    "T1",
    "X1.0Y1.0",
    "X2.0Y1.0G85X4.0Y1.0",
    "M30",
  ].join("\n");
  const page = importPcbPage(
    [
      { name: "b.drl", text: drill },
      { name: "b.gm1", text: OUTLINE },
    ],
    { pageId: "p2", reservedIds: new Set(["pcb-board"]) },
  );
  expect(page.elements.every((element) => element.page === "p2")).toBe(true);
  expect(page.elements.some((element) => element.id === "pcb-board")).toBe(
    false,
  );
  expect(contourCount(paths(page.elements, "Drill"))).toBe(2);
  expect(() => importPcbPage([{ name: "x.gbr", text: "not gerber" }])).toThrow(
    PcbImportError,
  );
  const partial = importPcbPage([
    { name: "x.gbr", text: "%FSLAX46Y46*" },
    { name: "b.gm1", text: OUTLINE },
  ]);
  expect(partial.warnings).toEqual([
    { file: "x.gbr", message: "skipped: unterminated % extended command" },
  ]);
});

test("the breadboard example's fabrication files import without warnings", () => {
  const examples = join(import.meta.dir, "../../../examples/breadboard");
  const files = ["GTL", "GBL", "GTS", "GBS", "GTO", "GKO", "DRL"].map(
    (extension) => ({
      name: `led-button.${extension}`,
      text: readFileSync(join(examples, `led-button.${extension}`), "utf8"),
    }),
  );
  const report = importPcbFiles(files, { title: "LED button" });
  expect(report.warnings).toEqual([]);
  expect(report.layers.map((layer) => layer.name)).toEqual([
    "Bottom solder mask",
    "Bottom copper",
    "Top copper",
    "Top solder mask",
    "Top silkscreen",
    "Drill",
    "Board outline",
  ]);
  // The half breadboard's outline, drawn with its line width.
  expect(report.size.width).toBeGreaterThan(83.82);
  expect(report.size.width).toBeLessThan(84.1);
});

test("each path renders its points where they are, even when Bezier handles overshoot", () => {
  // An arc from 30 to 150 degrees: its handles reach above the curve's top.
  const arc = gerber(
    "Legend,Top",
    "D10*",
    "G75*",
    "X8660254Y5000000D02*",
    "G03X-8660254Y5000000I-8660254J-5000000D01*",
  );
  const page = importPcbPage([
    { name: "arc.gto", text: arc },
    { name: "b.gm1", text: OUTLINE },
  ]);
  for (const element of page.elements.filter(
    (item) => item.type === "draw.path",
  )) {
    const geometry = compoundPathGeometry(element);
    const original = (element.semantic as PathSemantic).contours;
    geometry?.contours.forEach((contour, index) =>
      contour.forEach((point, at) => {
        expect(point.x + (geometry.box.x ?? 0)).toBeCloseTo(
          original[index]?.points[at]?.x ?? Number.NaN,
          6,
        );
        expect(point.y + (geometry.box.y ?? 0)).toBeCloseTo(
          original[index]?.points[at]?.y ?? Number.NaN,
          6,
        );
      }),
    );
  }
});
