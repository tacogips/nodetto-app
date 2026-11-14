// Deterministic SVG export of a page or a selection.
//
// String concatenation rather than DOM construction, because this package
// must run wherever the core runs — a Bun test, a worker, a headless export
// — and because a serializer that owns every byte can promise the one thing
// an export needs to promise: the same document renders to the same file.
//
// It is a second renderer, not the Solid one reused. The canvas draws box
// shapes as HTML so the browser can clip and ellipsize text for it; an SVG
// file has no such help, so the geometry that both agree on lives in the
// core (`geoOutline`, the bounds helpers, `connectorDecoration`) and the
// per-type text layout is written out here against the same constants.
//
// The renderer lives under `svg-export/`; this module is its public face.

export { wrapTextLines } from "./text-layout.ts";
export { escapeXml } from "./svg-export/markup.ts";
export {
  DEFAULT_SVG_THEME,
  type SvgExportOptions,
  type SvgTheme,
} from "./svg-export/theme.ts";
export {
  renderArtboardSvg,
  renderElementsSvg,
  renderPageSvg,
  renderSelectionSvg,
} from "./svg-export/document.ts";
