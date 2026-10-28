// Excellon writer for drilled holes and slots, in decimal millimetres.

import type { PcbPoint } from "./model.ts";

export interface DrillHit {
  readonly diameter: number;
  readonly at: PcbPoint;
}

/** A slot drilled from one centre to another (G85). */
export interface DrillSlotHit {
  readonly diameter: number;
  readonly from: PcbPoint;
  readonly to: PcbPoint;
}

export interface ExcellonOptions {
  /** Plated (the default) or non-plated holes. */
  readonly plating?: "plated" | "nonPlated";
  readonly slots?: readonly DrillSlotHit[];
}

function xy(point: PcbPoint): string {
  return `X${point.x.toFixed(3)}Y${point.y.toFixed(3)}`;
}

/** Coordinates always carry three decimals, so no reader guesses zero suppression. */
export function excellonDrill(
  hits: readonly DrillHit[],
  generator: string,
  layers: number,
  options: ExcellonOptions = {},
): string {
  const slots = options.slots ?? [];
  const diameters = [
    ...new Set([...hits, ...slots].map((hit) => hit.diameter)),
  ].sort((left, right) => left - right);
  const tools = diameters.map((diameter, index) => ({
    code: `T${index + 1}`,
    diameter,
  }));
  const plated = options.plating !== "nonPlated";
  const lines = [
    "M48",
    `; ${generator} drill file: ${plated ? "plated" : "non-plated"} holes, millimetres, absolute, decimal point coordinates`,
    plated
      ? `; #@! TF.FileFunction,Plated,1,${layers},PTH`
      : `; #@! TF.FileFunction,NonPlated,1,${layers},NPTH`,
    "FMAT,2",
    "METRIC",
    ...tools.map((tool) => `${tool.code}C${tool.diameter.toFixed(3)}`),
    "%",
    "G90",
    "G05",
  ];
  for (const tool of tools) {
    lines.push(tool.code);
    for (const hit of hits)
      if (hit.diameter === tool.diameter) lines.push(xy(hit.at));
    for (const slot of slots)
      if (slot.diameter === tool.diameter)
        lines.push(`${xy(slot.from)}G85${xy(slot.to)}`);
  }
  lines.push("M30", "");
  return lines.join("\n");
}
