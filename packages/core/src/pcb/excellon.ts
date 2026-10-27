// Excellon writer for plated through holes, in decimal millimetres.

import type { PcbPoint } from "./model.ts";

export interface DrillHit {
  readonly diameter: number;
  readonly at: PcbPoint;
}

export interface DrillSlotHit {
  readonly diameter: number;
  readonly from: PcbPoint;
  readonly to: PcbPoint;
}

export interface ExcellonDrillOptions {
  readonly plating?: "plated" | "nonPlated";
  readonly slots?: readonly DrillSlotHit[];
}

/** Coordinates always carry three decimals, so no reader guesses zero suppression. */
export function excellonDrill(
  hits: readonly DrillHit[],
  generator: string,
  layers: number,
  options?: ExcellonDrillOptions,
): string {
  const slots = options?.slots ?? [];
  const plating = options?.plating ?? "plated";
  const diameters = [
    ...new Set([
      ...hits.map((hit) => hit.diameter),
      ...slots.map((slot) => slot.diameter),
    ]),
  ].sort((left, right) => left - right);
  const tools = diameters.map((diameter, index) => ({
    code: `T${index + 1}`,
    diameter,
  }));
  const lines = [
    "M48",
    `; ${generator} drill file: ${plating === "plated" ? "plated holes" : "non-plated holes"}, millimetres, absolute, decimal point coordinates`,
    plating === "plated"
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
      if (hit.diameter === tool.diameter)
        lines.push(`X${hit.at.x.toFixed(3)}Y${hit.at.y.toFixed(3)}`);
    for (const slot of slots)
      if (slot.diameter === tool.diameter)
        lines.push(
          `X${slot.from.x.toFixed(3)}Y${slot.from.y.toFixed(3)}G85X${slot.to.x.toFixed(3)}Y${slot.to.y.toFixed(3)}`,
        );
  }
  lines.push("M30", "");
  return lines.join("\n");
}
