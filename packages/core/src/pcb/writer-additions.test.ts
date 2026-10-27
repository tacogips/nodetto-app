import { expect, test } from "bun:test";
import { excellonDrill } from "./excellon.ts";
import { readExcellon } from "./excellon-read.ts";
import { GerberLayer } from "./gerber.ts";
import { readGerber } from "./gerber-read.ts";
import { readIndependently } from "./oracle.test-support.ts";

const p = (x: number, y: number) => ({ x, y });

test("rectangle and obround flashes read back with shared aperture codes", () => {
  const layer = new GerberLayer("Copper,L1,Top");
  layer.flash("square", 2, p(1, 1));
  layer.flashAperture({ kind: "rectangle", width: 2, height: 2 }, p(2, 1));
  layer.flashAperture({ kind: "rectangle", width: 2, height: 1 }, p(3, 1));
  layer.flashAperture({ kind: "obround", width: 1, height: 2 }, p(4, 1));

  const source = layer.text("Nodetto,Test");
  const image = readGerber(source);
  expect(image.warnings).toEqual([]);
  expect(image.objects).toMatchObject([
    {
      kind: "flash",
      aperture: { kind: "rectangle", width: 2, height: 2 },
      at: p(1, 1),
    },
    {
      kind: "flash",
      aperture: { kind: "rectangle", width: 2, height: 2 },
      at: p(2, 1),
    },
    {
      kind: "flash",
      aperture: { kind: "rectangle", width: 2, height: 1 },
      at: p(3, 1),
    },
    {
      kind: "flash",
      aperture: { kind: "obround", width: 1, height: 2 },
      at: p(4, 1),
    },
  ]);
  expect(source.match(/%ADD\d+R,2\.000000X2\.000000\*%/g)).toHaveLength(1);
});

test("regions read back linear contours and arc direction and centre", () => {
  const square = new GerberLayer("Copper,L1,Top");
  square.region([
    {
      start: p(0, 0),
      segments: [
        { to: p(2, 0) },
        { to: p(2, 2) },
        { to: p(0, 2) },
        { to: p(0, 0) },
      ],
    },
  ]);
  expect(readGerber(square.text("Nodetto,Test")).objects).toMatchObject([
    {
      kind: "region",
      contours: [
        {
          start: p(0, 0),
          segments: [
            { to: p(2, 0) },
            { to: p(2, 2) },
            { to: p(0, 2) },
            { to: p(0, 0) },
          ],
        },
      ],
    },
  ]);

  const curved = new GerberLayer("Copper,L1,Top");
  curved.region([
    {
      start: p(0, 0),
      segments: [
        { to: p(2, 0), arc: { center: p(1, 0), clockwise: false } },
        { to: p(0, 0) },
      ],
    },
  ]);
  const image = readGerber(curved.text("Nodetto,Test"));
  expect(image.warnings).toEqual([]);
  expect(image.objects).toMatchObject([
    {
      kind: "region",
      contours: [
        {
          segments: [
            { to: p(2, 0), arc: { center: p(1, 0), clockwise: false } },
            { to: p(0, 0) },
          ],
        },
      ],
    },
  ]);
});

test("region-only layers are accepted by the independent reader", () => {
  const layer = new GerberLayer("Copper,L1,Top");
  layer.region([
    {
      start: p(0, 0),
      segments: [
        { to: p(2, 0) },
        { to: p(2, 2) },
        { to: p(0, 2) },
        { to: p(0, 0) },
      ],
    },
  ]);

  const source = layer.text("Nodetto,Test");
  expect(readIndependently(source, "gerber").warnings).toEqual([]);
  const image = readGerber(source);
  expect(image.warnings).toEqual([]);
  expect(image.objects).toMatchObject([
    {
      kind: "region",
      contours: [
        {
          segments: [
            { to: p(2, 0) },
            { to: p(2, 2) },
            { to: p(0, 2) },
            { to: p(0, 0) },
          ],
        },
      ],
    },
  ]);
});

test("arcs use one multi-quadrant declaration and return to linear mode", () => {
  const layer = new GerberLayer("Copper,L1,Top");
  layer.arc(0.2, p(1, 0), p(0, 1), p(0, 0), false);
  layer.arc(0.2, p(0, 1), p(-1, 0), p(0, 0), false);
  const source = layer.text("Nodetto,Test");
  expect(source.match(/G75\*/g)).toHaveLength(1);
  expect(source.match(/G03\*/g)).toHaveLength(2);
  expect(source.match(/D01\*\nG01\*/g)).toHaveLength(2);
  expect(readGerber(source).objects).toMatchObject([
    {
      kind: "draw",
      from: p(1, 0),
      to: p(0, 1),
      arc: { center: p(0, 0), clockwise: false },
    },
    {
      kind: "draw",
      from: p(0, 1),
      to: p(-1, 0),
      arc: { center: p(0, 0), clockwise: false },
    },
  ]);

  const linear = new GerberLayer("Copper,L1,Top");
  linear.flash("circle", 0.5, p(0, 0));
  linear.stroke(0.2, [p(0, 0), p(1, 1)]);
  expect(linear.text("Nodetto,Test")).not.toMatch(/G75|G0[23]/);
});

test("Excellon plated defaults stay byte-identical and non-plated slots round-trip", () => {
  const hits = [{ diameter: 1, at: p(1.2346, 2) }];
  const legacy = excellonDrill(hits, "Nodetto,Test", 2);
  expect(excellonDrill(hits, "Nodetto,Test", 2, {})).toBe(legacy);
  expect(excellonDrill(hits, "Nodetto,Test", 2, { plating: "plated" })).toBe(
    legacy,
  );

  const source = excellonDrill(hits, "Nodetto,Test", 2, {
    plating: "nonPlated",
    slots: [
      { diameter: 0.8, from: p(3, 4), to: p(5.1236, 4) },
      { diameter: 1, from: p(6, 7), to: p(8, 7) },
    ],
  });
  expect(source).toContain("non-plated holes");
  expect(source).toContain("; #@! TF.FileFunction,NonPlated,1,2,NPTH");
  expect(source.match(/^T\d+C[\d.]+$/gm)).toEqual(["T1C0.800", "T2C1.000"]);
  expect(source).toContain("X3.000Y4.000G85X5.124Y4.000");
  const image = readExcellon(source);
  expect(image.warnings).toEqual([]);
  expect(image.plating).toBe("nonPlated");
  expect(image.slots).toEqual([
    { diameter: 0.8, from: p(3, 4), to: p(5.124, 4) },
    { diameter: 1, from: p(6, 7), to: p(8, 7) },
  ]);
  expect(image.holes).toEqual([{ diameter: 1, at: p(1.235, 2) }]);
});

test("independent Gerber and drill parsers accept arcs, regions, and slots", () => {
  const gerber = new GerberLayer("Copper,L1,Top");
  gerber.flashAperture({ kind: "circle", diameter: 0.2 }, p(-1, 0));
  gerber.region([
    {
      start: p(0, 0),
      segments: [
        { to: p(2, 0), arc: { center: p(1, 0), clockwise: false } },
        { to: p(0, 0) },
      ],
    },
  ]);
  gerber.arc(0.2, p(1, 0), p(0, 1), p(0, 0), false);
  const source = gerber.text("Nodetto,Test");
  expect(source.match(/^%ADD/gm)).toHaveLength(1);
  expect(readIndependently(source, "gerber").warnings).toEqual([]);

  const drill = excellonDrill([], "Nodetto,Test", 2, {
    slots: [{ diameter: 0.8, from: p(1, 2), to: p(3, 2) }],
  });
  expect(readIndependently(drill, "drill").warnings).toEqual([]);
});
