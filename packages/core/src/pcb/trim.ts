// Trims a design's outline to the area its content uses.

import type { PcbDesign, PcbPoint } from "./model.ts";

export interface PcbTrimOptions {
  /** Space kept around the used area, within the original outline. */
  readonly margin: number;
  /** Legend ink must stay this far inside the trimmed edge. */
  readonly legendEdgeClearance: number;
}

interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function roundMm(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Whole 0.01 mm steps, after rounding to nanometres so 16.9 stays 16.9. */
function hundredths(value: number): number {
  return Math.round(value * 1_000_000) / 10_000;
}

function around(at: PcbPoint, size: number): Bounds {
  return {
    minX: at.x - size / 2,
    minY: at.y - size / 2,
    maxX: at.x + size / 2,
    maxY: at.y + size / 2,
  };
}

/**
 * The used area is every mask opening, trace and ungrouped legend stroke.
 * It grows by `margin`, stays inside the original outline and is rounded
 * outward to 0.01 mm. Everything moves so the origin stays at the
 * bottom-left; a legend group that no longer fits inside the legend edge
 * clearance is dropped whole.
 */
export function trimPcbToUsed(
  design: PcbDesign,
  options: PcbTrimOptions,
): PcbDesign {
  const { rules } = design;
  const used: Bounds[] = [
    ...design.pads.map((pad) => around(pad.at, rules.maskOpening)),
    ...[...design.topTraces, ...design.bottomTraces].flatMap((trace) =>
      trace.points.map((point) => around(point, trace.width)),
    ),
    ...design.legend
      .filter((stroke) => stroke.group === undefined)
      .flatMap((stroke) =>
        stroke.points.map((point) => around(point, rules.legendLine)),
      ),
  ];
  if (used.length === 0) return design;
  const minX = Math.max(
    0,
    Math.floor(
      hundredths(Math.min(...used.map((box) => box.minX)) - options.margin),
    ) / 100,
  );
  const minY = Math.max(
    0,
    Math.floor(
      hundredths(Math.min(...used.map((box) => box.minY)) - options.margin),
    ) / 100,
  );
  const maxX = Math.min(
    design.width,
    Math.ceil(
      hundredths(Math.max(...used.map((box) => box.maxX)) + options.margin),
    ) / 100,
  );
  const maxY = Math.min(
    design.height,
    Math.ceil(
      hundredths(Math.max(...used.map((box) => box.maxY)) + options.margin),
    ) / 100,
  );
  const width = roundMm(maxX - minX);
  const height = roundMm(maxY - minY);
  const move = (point: PcbPoint): PcbPoint => ({
    x: roundMm(point.x - minX),
    y: roundMm(point.y - minY),
  });

  const inset = options.legendEdgeClearance + rules.legendLine / 2;
  const fits = (point: PcbPoint) =>
    point.x >= inset &&
    point.x <= width - inset &&
    point.y >= inset &&
    point.y <= height - inset;
  const legend = design.legend.map((stroke) => ({
    ...stroke,
    points: stroke.points.map(move),
  }));
  const dropped = new Set(
    legend
      .filter(
        (stroke) => stroke.group !== undefined && !stroke.points.every(fits),
      )
      .map((stroke) => stroke.group),
  );

  return {
    width,
    height,
    rules,
    pads: design.pads.map((pad) => ({ ...pad, at: move(pad.at) })),
    topTraces: design.topTraces.map((trace) => ({
      ...trace,
      points: trace.points.map(move),
    })),
    bottomTraces: design.bottomTraces.map((trace) => ({
      ...trace,
      points: trace.points.map(move),
    })),
    legend: legend.filter(
      (stroke) => stroke.group === undefined || !dropped.has(stroke.group),
    ),
  };
}
