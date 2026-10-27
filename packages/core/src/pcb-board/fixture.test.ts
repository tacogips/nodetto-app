import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "bun:test";
import {
  arcCenter,
  boardToFootprint,
  computePcbConnectivity,
  computePcbRatsnest,
  exportPcbBoard,
  footprintToBoard,
  outlineContains,
  padCopperOutline,
  padShapeCenter,
  pcbDocumentFromPlan,
  pcbNetMembers,
} from "@nodetto/core";
import type {
  Element,
  PcbFootprintSemantic,
  PcbTrackSemantic,
} from "@nodetto/ir";
import { assertValidDocument } from "@nodetto/ir";
import { parseDocument, serializeDocument, importKicadPcb } from "@nodetto/io";
import { Editor } from "../editor.ts";
import { readExcellon } from "../pcb/excellon-read.ts";
import { readGerber } from "../pcb/gerber-read.ts";

const root = resolve(import.meta.dir, "../../../../");
const fixturePath = resolve(root, "test-fixtures/kicad/two-layer.kicad_pcb");
const fixtureText = readFileSync(fixturePath, "utf8");
const close = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
const itemSemantic = <T>(element: Element): T => element.semantic as T;
const expectDocumentDataEqual = (
  actual: ReturnType<typeof parseDocument>,
  expected: ReturnType<typeof parseDocument>,
) => {
  expect(actual).toMatchObject({
    schemaVersion: expected.schemaVersion,
    id: expected.id,
    title: expected.title,
    pages: expected.pages,
  });
  expect(actual.elements).toHaveLength(expected.elements.length);
  for (const element of expected.elements)
    expect(actual.elements.find(({ id }) => id === element.id)).toEqual(
      element,
    );
};

test("KiCad PCB fixture imports completely and survives edited JSONL round trips", () => {
  const imported = importKicadPcb(fixtureText, {
    fileName: "two-layer.kicad_pcb",
  });
  expect(
    imported.diagnostics.filter(({ severity }) => severity === "error"),
  ).toEqual([]);
  const plan = imported.plan;
  if (!plan) throw new Error("fixture import did not produce a plan");

  const document = pcbDocumentFromPlan(plan, { pageName: plan.title });
  assertValidDocument(document);
  const page = document.pages[0];
  if (!page || page.kind !== "pcb") throw new Error("PCB page is missing");
  const counts = new Map<string, number>();
  for (const element of document.elements)
    counts.set(element.type, (counts.get(element.type) ?? 0) + 1);
  expect(Object.fromEntries(counts)).toEqual({
    "pcb.board": 1,
    "pcb.graphic": plan.graphics.length,
    "pcb.zone": plan.zones.length,
    "pcb.track": plan.tracks.length,
    "pcb.via": plan.vias.length,
    "pcb.footprint": plan.footprints.length,
  });
  expect(
    document.elements.find(({ type }) => type === "pcb.board")?.semantic,
  ).toEqual(plan.board);
  expect(
    document.elements
      .filter(({ type }) => type === "pcb.graphic")
      .map(({ semantic }) => semantic),
  ).toEqual([...plan.graphics]);
  expect(
    document.elements
      .filter(({ type }) => type === "pcb.zone")
      .map(({ semantic }) => semantic),
  ).toEqual([...plan.zones]);
  expect(
    document.elements
      .filter(({ type }) => type === "pcb.track")
      .map(({ semantic }) => semantic),
  ).toEqual([...plan.tracks]);
  expect(
    document.elements
      .filter(({ type }) => type === "pcb.via")
      .map(({ semantic }) => semantic),
  ).toEqual([...plan.vias]);
  expect(
    document.elements
      .filter(({ type }) => type === "pcb.footprint")
      .map(({ semantic }) => semantic),
  ).toEqual([...plan.footprints]);
  expect(
    (plan.board.nets ?? []).every((net) =>
      (
        document.elements.find(({ type }) => type === "pcb.board")
          ?.semantic as {
          nets: readonly string[];
        }
      ).nets.includes(net),
    ),
  ).toBe(true);
  const netNames = new Set(plan.board.nets ?? []);
  for (const element of document.elements) {
    if (element.type === "pcb.footprint")
      for (const pad of itemSemantic<PcbFootprintSemantic>(element).pads)
        if (pad.net) expect(netNames.has(pad.net)).toBe(true);
    if (
      element.type === "pcb.track" ||
      element.type === "pcb.via" ||
      element.type === "pcb.zone"
    )
      if (itemSemantic<{ net: string }>(element).net)
        expect(netNames.has(itemSemantic<{ net: string }>(element).net)).toBe(
          true,
        );
  }

  const before = serializeDocument(document);
  expect(serializeDocument(parseDocument(before))).toBe(before);
  expectDocumentDataEqual(parseDocument(before), document);

  const editor = new Editor({ document });
  const j1 = document.elements.find(
    (element) =>
      element.type === "pcb.footprint" &&
      itemSemantic<PcbFootprintSemantic>(element).reference === "J1",
  );
  if (!j1) throw new Error("J1 fixture footprint is missing");
  const j1Before = itemSemantic<PcbFootprintSemantic>(j1);
  const attachedEnds: {
    trackId: string;
    pointIndex: number;
    local: readonly [number, number];
  }[] = [];
  for (const element of document.elements) {
    if (element.type !== "pcb.track") continue;
    const track = itemSemantic<PcbTrackSemantic>(element);
    for (const [pointIndex, point] of track.points.entries()) {
      for (const pad of j1Before.pads) {
        if (outlineContains(padCopperOutline(j1Before, pad), point))
          attachedEnds.push({
            trackId: element.id,
            pointIndex,
            local: boardToFootprint(j1Before, point),
          });
      }
    }
  }
  expect(attachedEnds.length).toBeGreaterThan(0);
  editor.moveElements([
    {
      id: j1.id,
      x: (j1Before.at[0] + 1.27) * 10,
      y: j1Before.at[1] * 10,
    },
  ]);
  const edited = editor.getSnapshot();
  const j1AfterElement = edited.elements.find(({ id }) => id === j1.id);
  if (!j1AfterElement) throw new Error("moved J1 disappeared");
  const j1After = itemSemantic<PcbFootprintSemantic>(j1AfterElement);
  for (const attached of attachedEnds) {
    const track = edited.elements.find(({ id }) => id === attached.trackId);
    if (!track) throw new Error("attached track disappeared");
    const point =
      itemSemantic<PcbTrackSemantic>(track).points[attached.pointIndex];
    if (!point) throw new Error("attached track endpoint disappeared");
    const local = boardToFootprint(j1After, point);
    close(local[0], attached.local[0], 1e-6);
    close(local[1], attached.local[1], 1e-6);
  }
  editor.rotatePcbFootprints([j1.id], 90);
  editor.addPcbTrack(page.id, {
    layer: "F.Cu",
    width: 0.25,
    net: "SPARE",
    points: [
      [48, 18],
      [49, 18],
    ],
  });
  editor.addPcbVia(page.id, {
    at: [49, 19],
    diameter: 0.6,
    drill: 0.3,
    net: "SPARE",
  });
  const editedText = serializeDocument(editor.getSnapshot());
  expect(serializeDocument(parseDocument(editedText))).toBe(editedText);
  expectDocumentDataEqual(parseDocument(editedText), editor.getSnapshot());
});

test("fixture ratsnest responds to deleting and undoing the SIG link", () => {
  const result = importKicadPcb(fixtureText, {
    fileName: "two-layer.kicad_pcb",
  });
  if (!result.plan) throw new Error("fixture import did not produce a plan");
  const document = pcbDocumentFromPlan(result.plan, {
    pageName: result.plan.title,
  });
  const page = document.pages[0];
  if (!page) throw new Error("PCB page is missing");
  const initial = computePcbRatsnest(
    document,
    page.id,
    computePcbConnectivity(document, page.id),
  );
  expect(initial).toHaveLength(0);
  const sigTrack = document.elements.find(
    (element) =>
      element.type === "pcb.track" &&
      itemSemantic<PcbTrackSemantic>(element).net === "SIG",
  );
  if (!sigTrack) throw new Error("fixture SIG track is missing");
  const editor = new Editor({ document });
  editor.deleteElements([sigTrack.id]);
  const disconnected = editor.getSnapshot();
  const lines = computePcbRatsnest(
    disconnected,
    page.id,
    computePcbConnectivity(disconnected, page.id),
  );
  expect(lines).toHaveLength(1);
  expect(lines[0]?.net).toBe("SIG");
  expect(
    new Set([lines[0]?.from.footprintId, lines[0]?.to.footprintId]),
  ).toEqual(
    new Set(
      document.elements
        .filter(
          (element) =>
            element.type === "pcb.footprint" &&
            itemSemantic<PcbFootprintSemantic>(element).pads.some(
              (pad) => pad.net === "SIG",
            ),
        )
        .map(({ id }) => id),
    ),
  );
  editor.undo();
  const restored = editor.getSnapshot();
  expect(
    computePcbRatsnest(
      restored,
      page.id,
      computePcbConnectivity(restored, page.id),
    ),
  ).toHaveLength(0);
});

test("GND net membership equals an independent semantic scan", () => {
  const result = importKicadPcb(fixtureText, {
    fileName: "two-layer.kicad_pcb",
  });
  if (!result.plan) throw new Error("fixture import did not produce a plan");
  const document = pcbDocumentFromPlan(result.plan, {
    pageName: result.plan.title,
  });
  const page = document.pages[0];
  if (!page) throw new Error("PCB page is missing");
  const expected = document.elements
    .filter((element) => {
      if (element.page !== page.id) return false;
      if (element.type === "pcb.footprint")
        return itemSemantic<PcbFootprintSemantic>(element).pads.some(
          (pad) => pad.net === "GND",
        );
      if (
        element.type === "pcb.track" ||
        element.type === "pcb.via" ||
        element.type === "pcb.zone"
      )
        return itemSemantic<{ net: string }>(element).net === "GND";
      return false;
    })
    .map(({ id }) => id)
    .sort();
  expect(pcbNetMembers(document, page.id, "GND").sort()).toEqual(expected);
});

test("fixture Gerbers and Excellon read back geometry and exports are deterministic", () => {
  const result = importKicadPcb(fixtureText, {
    fileName: "two-layer.kicad_pcb",
  });
  if (!result.plan) throw new Error("fixture import did not produce a plan");
  const document = pcbDocumentFromPlan(result.plan, {
    pageName: result.plan.title,
  });
  const page = document.pages[0];
  if (!page) throw new Error("PCB page is missing");
  const first = exportPcbBoard(document, page.id, { name: "two-layer" });
  if (typeof first === "string") throw new Error(first);
  const second = exportPcbBoard(document, page.id, { name: "two-layer" });
  if (typeof second === "string") throw new Error(second);
  expect(first.files).toEqual(second.files);
  const file = (suffix: string) => {
    const found = first.files.find(({ path }) => path.endsWith(suffix));
    if (!found) throw new Error(`fixture export is missing ${suffix}`);
    return found.text;
  };
  const gerbers = [".GTL", ".GBL", ".GTS", ".GBS", ".GTO", ".GBO", ".GKO"];
  for (const suffix of gerbers)
    expect(readGerber(file(suffix)).warnings).toEqual([]);
  const copperByLayer = new Map([
    ["F.Cu", readGerber(file(".GTL"))],
    ["B.Cu", readGerber(file(".GBL"))],
  ]);
  const top = copperByLayer.get("F.Cu");
  if (!top) throw new Error("top copper Gerber is missing");
  const tracks = document.elements.filter(({ type }) => type === "pcb.track");
  expect(top.objects.some(({ kind }) => kind === "region")).toBe(true);
  const topBounds = top.objects.flatMap((object) => {
    if (object.kind === "flash") return [object.at];
    if (object.kind === "draw") return [object.from, object.to];
    return object.contours.flatMap((contour) => [
      contour.start,
      ...contour.segments.map(({ to }) => to),
    ]);
  });
  expect(topBounds.length).toBeGreaterThan(tracks.length);
  const outline = readGerber(file(".GKO"));
  const outlinePoints = outline.objects.flatMap((object) =>
    object.kind === "draw"
      ? [object.from, object.to]
      : object.kind === "region"
        ? object.contours.flatMap((contour) => [
            contour.start,
            ...contour.segments.map(({ to }) => to),
          ])
        : [object.at],
  );
  expect(outlinePoints.length).toBeGreaterThan(0);
  const outlineMinX = Math.min(...outlinePoints.map(({ x }) => x));
  const outlineMaxY = Math.max(...outlinePoints.map(({ y }) => y));
  close(
    Math.max(...outlinePoints.map(({ x }) => x)) - outlineMinX,
    first.width,
    1e-6,
  );
  close(
    outlineMaxY - Math.min(...outlinePoints.map(({ y }) => y)),
    first.height,
    1e-6,
  );
  const toGerber = (point: readonly [number, number]) => ({
    x: point[0] - outlineMinX,
    y: outlineMaxY - point[1],
  });
  for (const fp of result.plan.footprints) {
    for (const pad of fp.pads) {
      if (pad.type === "np_thru_hole") continue;
      const layers = pad.layers.includes("*.Cu")
        ? ["F.Cu", "B.Cu"]
        : pad.layers.filter((layer) => layer === "F.Cu" || layer === "B.Cu");
      const center = toGerber(padShapeCenter(fp, pad));
      for (const layer of layers) {
        const gerber = copperByLayer.get(layer);
        if (!gerber) throw new Error(`missing ${layer} Gerber`);
        const found = gerber.objects.some((object) => {
          if (object.kind === "flash")
            return (
              Math.abs(object.at.x - center.x) <= 1e-6 &&
              Math.abs(object.at.y - center.y) <= 1e-6
            );
          if (object.kind !== "region") return false;
          return object.contours.some((contour) => {
            const points = [
              contour.start,
              ...contour.segments.map(({ to }) => to),
            ];
            const centerX =
              (Math.min(...points.map(({ x }) => x)) +
                Math.max(...points.map(({ x }) => x))) /
              2;
            const centerY =
              (Math.min(...points.map(({ y }) => y)) +
                Math.max(...points.map(({ y }) => y))) /
              2;
            return (
              Math.abs(centerX - center.x) <= 1e-6 &&
              Math.abs(centerY - center.y) <= 1e-6
            );
          });
        });
        expect(found, `${fp.reference} pad ${pad.number} on ${layer}`).toBe(
          true,
        );
      }
    }
  }
  for (const element of tracks) {
    const track = itemSemantic<PcbTrackSemantic>(element);
    const gerber = copperByLayer.get(track.layer);
    if (!gerber) throw new Error(`missing ${track.layer} Gerber`);
    const draws = gerber.objects.filter((object) => object.kind === "draw");
    for (const [index, from] of track.points.slice(0, -1).entries()) {
      if (!from) continue;
      const to = track.points[index + 1];
      if (!to) throw new Error("track segment endpoint is missing");
      const expectedFrom = toGerber(from);
      const expectedTo = toGerber(to);
      const draw = draws.find((object) => {
        if (
          object.kind !== "draw" ||
          Boolean(object.arc) !== Boolean(track.mid)
        )
          return false;
        const forward =
          Math.abs(object.from.x - expectedFrom.x) <= 1e-6 &&
          Math.abs(object.from.y - expectedFrom.y) <= 1e-6 &&
          Math.abs(object.to.x - expectedTo.x) <= 1e-6 &&
          Math.abs(object.to.y - expectedTo.y) <= 1e-6;
        const reverse =
          Math.abs(object.from.x - expectedTo.x) <= 1e-6 &&
          Math.abs(object.from.y - expectedTo.y) <= 1e-6 &&
          Math.abs(object.to.x - expectedFrom.x) <= 1e-6 &&
          Math.abs(object.to.y - expectedFrom.y) <= 1e-6;
        return forward || reverse;
      });
      expect(draw).toBeDefined();
      if (track.mid) {
        const boardCenter = arcCenter(from, track.mid, to);
        if (!boardCenter) throw new Error("fixture arc has no circle center");
        const center = toGerber(boardCenter);
        if (draw?.kind !== "draw" || !draw.arc)
          throw new Error("fixture arc track did not read back as an arc");
        close(draw.arc.center.x, center.x, 1e-6);
        close(draw.arc.center.y, center.y, 1e-6);
      }
    }
  }
  const bottom = copperByLayer.get("B.Cu");
  const zonePolygon = result.plan.zones
    .flatMap((zone) => zone.filled)
    .find(({ layer }) => layer === "B.Cu")?.polygons[0];
  if (!bottom || !zonePolygon)
    throw new Error("fixture B.Cu zone fill is missing");
  const zoneReadBack = bottom.objects.some(
    (object) =>
      object.kind === "region" &&
      object.contours.some((contour) => {
        const points = [contour.start, ...contour.segments.map(({ to }) => to)];
        return zonePolygon.every(([x, y]) => {
          const expected = toGerber([x, y]);
          return points.some(
            (point) =>
              Math.abs(point.x - expected.x) <= 1e-6 &&
              Math.abs(point.y - expected.y) <= 1e-6,
          );
        });
      }),
  );
  expect(zoneReadBack).toBe(true);

  const plated = readExcellon(file(".DRL"));
  const nonPlated = readExcellon(file("-NPTH.DRL"));
  expect(plated.warnings).toEqual([]);
  expect(nonPlated.warnings).toEqual([]);
  const allPads = result.plan.footprints.flatMap((fp) =>
    fp.pads.map((pad) => ({ fp, pad })),
  );
  const platedPads = allPads.filter(
    ({ pad }) => pad.type === "thru_hole" && pad.drill,
  );
  const expectedViaCount = result.plan.vias.length;
  expect(plated.holes.length + plated.slots.length).toBe(
    expectedViaCount + platedPads.length,
  );
  for (const { fp, pad } of platedPads) {
    const anchor = footprintToBoard(fp, pad.at);
    const expected = [
      anchor[0] - outlineMinX,
      outlineMaxY - anchor[1],
    ] as const;
    const diameter = pad.drill?.diameter ?? 0;
    if (pad.drill?.slot) {
      const slot = plated.slots.find(
        ({ diameter: actual }) => Math.abs(actual - diameter) <= 0.0005,
      );
      if (!slot)
        throw new Error(
          `missing slot drill for ${fp.reference} pad ${pad.number}`,
        );
      close((slot.from.x + slot.to.x) / 2, expected[0], 0.0005);
      close((slot.from.y + slot.to.y) / 2, expected[1], 0.0005);
      close(
        Math.hypot(slot.to.x - slot.from.x, slot.to.y - slot.from.y),
        pad.drill.slot[1] - pad.drill.slot[0],
        0.0005,
      );
    } else {
      const hole = plated.holes.find(
        ({ at, diameter: actual }) =>
          Math.abs(actual - diameter) <= 0.0005 &&
          Math.abs(at.x - expected[0]) <= 0.0005 &&
          Math.abs(at.y - expected[1]) <= 0.0005,
      );
      expect(hole).toBeDefined();
    }
  }
  for (const via of result.plan.vias) {
    const expected = toGerber(via.at);
    const hole = plated.holes.find(
      ({ at, diameter }) =>
        Math.abs(diameter - via.drill) <= 0.0005 &&
        Math.abs(at.x - expected.x) <= 0.0005 &&
        Math.abs(at.y - expected.y) <= 0.0005,
    );
    expect(hole).toBeDefined();
  }
  const h1 = result.plan.footprints.find(({ reference }) => reference === "H1");
  const h1Pad = h1?.pads.find(({ type }) => type === "np_thru_hole");
  if (!h1 || !h1Pad?.drill)
    throw new Error("H1 mounting hole is missing from the fixture");
  const h1At = toGerber(footprintToBoard(h1, h1Pad.at));
  const mountingHole = nonPlated.holes.find(
    ({ at, diameter }) =>
      Math.abs(diameter - h1Pad.drill?.diameter!) <= 0.0005 &&
      Math.abs(at.x - h1At.x) <= 0.0005 &&
      Math.abs(at.y - h1At.y) <= 0.0005,
  );
  expect(mountingHole).toBeDefined();
  const u1 = result.plan.footprints.find(({ reference }) => reference === "U1");
  const u1Pad = u1?.pads.find(({ number }) => number === "1");
  if (!u1 || !u1Pad || !u1Pad.drill?.slot)
    throw new Error("U1 pad 1 offset slot is missing");
  const u1Anchor = footprintToBoard(u1, u1Pad.at);
  close(u1Anchor[0], 40, 1e-6);
  close(u1Anchor[1], 10, 1e-6);
  const slot = plated.slots.find(
    ({ diameter }) => Math.abs(diameter - 0.8) <= 0.0005,
  );
  if (!slot) throw new Error("U1 pad 1 Excellon slot is missing");
  close((slot.from.x + slot.to.x) / 2, 40, 0.0005);
  close((slot.from.y + slot.to.y) / 2, 10, 0.0005);
  const copperCenter = toGerber(padShapeCenter(u1, u1Pad));
  const offsetPadRegion = top.objects.find(
    (object) =>
      object.kind === "region" &&
      object.contours.some((contour) => {
        const points = [contour.start, ...contour.segments.map(({ to }) => to)];
        const centerX =
          (Math.min(...points.map(({ x }) => x)) +
            Math.max(...points.map(({ x }) => x))) /
          2;
        const centerY =
          (Math.min(...points.map(({ y }) => y)) +
            Math.max(...points.map(({ y }) => y))) /
          2;
        return (
          Math.abs(centerX - copperCenter.x) <= 1e-6 &&
          Math.abs(centerY - copperCenter.y) <= 1e-6
        );
      }),
  );
  expect(offsetPadRegion).toBeDefined();
});
