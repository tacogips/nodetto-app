// PcbDesign to the file set board houses take as an upload: one Gerber file
// per layer with Protel-style extensions, and an Excellon drill file.

import { excellonDrill } from "./excellon.ts";
import { GerberLayer } from "./gerber.ts";
import type { PcbDesign, PcbFile } from "./model.ts";

/** The writers make two-layer boards. */
export const PCB_LAYER_COUNT = 2;

export interface PcbFabricationOptions {
  /** Base name of every file; the extension names the layer. */
  readonly name: string;
  /** `%TF.GenerationSoftware` value: `vendor,application[,version]`. */
  readonly generator: string;
  /** Names the producer on the drill file's first comment line. */
  readonly drillTitle: string;
}

/**
 * Top and bottom copper (GTL, GBL), solder mask (GTS, GBS, negative), top
 * silkscreen (GTO), outline (GKO) and plated holes (DRL), in that order.
 */
export function pcbFabricationFiles(
  design: PcbDesign,
  options: PcbFabricationOptions,
): readonly PcbFile[] {
  const { rules } = design;
  const top = new GerberLayer("Copper,L1,Top");
  const bottom = new GerberLayer("Copper,L2,Bot");
  const maskTop = new GerberLayer("Soldermask,Top", "Negative");
  const maskBottom = new GerberLayer("Soldermask,Bot", "Negative");
  for (const pad of design.pads) {
    top.flash(pad.shape, rules.pad, pad.at);
    bottom.flash(pad.shape, rules.pad, pad.at);
    maskTop.flash(pad.shape, rules.maskOpening, pad.at);
    maskBottom.flash(pad.shape, rules.maskOpening, pad.at);
  }
  for (const trace of design.topTraces) top.stroke(trace.width, trace.points);
  for (const trace of design.bottomTraces)
    bottom.stroke(trace.width, trace.points);

  const legend = new GerberLayer("Legend,Top");
  for (const stroke of design.legend)
    legend.stroke(rules.legendLine, stroke.points);

  const outline = new GerberLayer("Profile,NP");
  outline.stroke(rules.edgeLine, [
    { x: 0, y: 0 },
    { x: design.width, y: 0 },
    { x: design.width, y: design.height },
    { x: 0, y: design.height },
    { x: 0, y: 0 },
  ]);

  const gerber = (extension: string, layer: GerberLayer): PcbFile => ({
    path: `${options.name}.${extension}`,
    text: layer.text(options.generator),
  });
  return [
    gerber("GTL", top),
    gerber("GBL", bottom),
    gerber("GTS", maskTop),
    gerber("GBS", maskBottom),
    gerber("GTO", legend),
    gerber("GKO", outline),
    {
      path: `${options.name}.DRL`,
      text: excellonDrill(
        design.pads.map((pad) => ({ diameter: rules.drill, at: pad.at })),
        options.drillTitle,
        PCB_LAYER_COUNT,
      ),
    },
  ];
}
