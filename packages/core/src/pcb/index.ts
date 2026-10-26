// PCB fabrication output: a board-agnostic design model, Gerber and Excellon
// writers, outline trimming and silkscreen helpers. Files in this folder
// import only each other (see boundary.test.ts), so it can become a package.

export { excellonDrill, type DrillHit } from "./excellon.ts";
export {
  PCB_LAYER_COUNT,
  pcbFabricationFiles,
  type PcbFabricationOptions,
} from "./fabrication.ts";
export {
  strokeFontSupports,
  strokeText,
  strokeTextWidth,
  type StrokePoint,
} from "./font.ts";
export { GerberLayer } from "./gerber.ts";
export {
  boxClearOfKeepouts,
  clipLegendStroke,
  type LegendKeepout,
  type LegendRect,
} from "./legend.ts";
export type {
  PadShape,
  PcbDesign,
  PcbDesignRules,
  PcbFile,
  PcbLegendStroke,
  PcbPad,
  PcbPoint,
  PcbTrace,
} from "./model.ts";
export { trimPcbToUsed, type PcbTrimOptions } from "./trim.ts";
