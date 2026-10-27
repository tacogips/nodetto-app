// PCB fabrication output: a board-agnostic design model, Gerber and Excellon
// writers, outline trimming and silkscreen helpers. Files in this folder
// import only each other (see boundary.test.ts), so it can become a package.

export {
  excellonDrill,
  type DrillHit,
  type DrillSlotHit,
  type ExcellonDrillOptions,
} from "./excellon.ts";
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
export {
  GerberLayer,
  type GerberApertureShape,
  type GerberContourSegment,
  type GerberRegionContour,
} from "./gerber.ts";
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
export {
  type DrillHole,
  type DrillImage,
  type DrillSlot,
  ExcellonReadError,
  isExcellon,
  readExcellon,
} from "./excellon-read.ts";
export {
  aperturePieces,
  flattenContour,
  type GerberShape,
  gerberShape,
  type OutlineArea,
  type OutlineContour,
  type OutlinePiece,
  type OutlinePoint,
  outlineBounds,
} from "./gerber-outline.ts";
export {
  type GerberAperture,
  type GerberArc,
  type GerberContour,
  type GerberImage,
  type GerberObject,
  type GerberPolarity,
  GerberReadError,
  type GerberSegment,
  type MacroPrimitive,
  readGerber,
} from "./gerber-read.ts";
export {
  identifyLayer,
  layerName,
  type PcbLayerKind,
  type PcbLayerRole,
  type PcbLayerSide,
} from "./layers.ts";
