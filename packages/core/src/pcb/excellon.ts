// Excellon writer for plated through holes, in decimal millimetres.

import type { PcbPoint } from "./model.ts";

export interface DrillHit {
  readonly diameter: number;
  readonly at: PcbPoint;
}

/** Coordinates always carry three decimals, so no reader guesses zero suppression. */
export function excellonDrill(
  hits: readonly DrillHit[],
  generator: string,
  layers: number,
): string {
  const diameters = [...new Set(hits.map((hit) => hit.diameter))].sort(
    (left, right) => left - right,
  );
  const tools = diameters.map((diameter, index) => ({
    code: `T${index + 1}`,
    diameter,
  }));
  const lines = [
    "M48",
    `; ${generator} drill file: plated holes, millimetres, absolute, decimal point coordinates`,
    `; #@! TF.FileFunction,Plated,1,${layers},PTH`,
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
  }
  lines.push("M30", "");
  return lines.join("\n");
}
