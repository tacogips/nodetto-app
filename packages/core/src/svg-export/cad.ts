import { coordinate } from "../cad/vec.ts";
import type { CadWireframe } from "../cad/wireframe.ts";
import { DEFAULT_SLIDE_SIZE } from "../presentation/slide-size.ts";
import { fmt, tag, text, wrap } from "./markup.ts";
import {
  DEFAULT_SVG_THEME,
  STROKE_WIDTH,
  type SvgExportOptions,
} from "./theme.ts";

export function cadPageSvgBody(
  { segments }: CadWireframe,
  { stroke, strokeWidth }: { stroke: string; strokeWidth: number },
): string {
  if (!segments.length) return "";
  const commands: string[] = [];
  for (let i = 0; i < segments.length; i += 4) {
    const x1 = fmt(coordinate(segments, i));
    const y1 = fmt(coordinate(segments, i + 1));
    const x2 = fmt(coordinate(segments, i + 2));
    const y2 = fmt(coordinate(segments, i + 3));
    commands.push(`M${x1} ${y1}L${x2} ${y2}`);
  }
  return tag("path", {
    d: commands.join(""),
    stroke,
    "stroke-width": strokeWidth,
    "stroke-linecap": "round",
    fill: "none",
  });
}

export function renderCadPageSvg(
  wireframe: CadWireframe,
  options: SvgExportOptions,
): string | null {
  const { bounds } = wireframe;
  if (!bounds) return null;
  const theme = { ...DEFAULT_SVG_THEME, ...options.theme };
  const margin = Math.max(
    STROKE_WIDTH,
    options.viewport ? 16 : (options.padding ?? 16),
  );
  const captionHeight = theme.fontSize * 1.5;
  const modelWidth = bounds.maxX - bounds.minX;
  const modelHeight = bounds.maxY - bounds.minY;
  const viewport = options.viewport ?? {
    x: 0,
    y: 0,
    width: Math.min(
      DEFAULT_SLIDE_SIZE.width,
      Math.max(theme.fontSize * 12, modelWidth) + margin * 2,
    ),
    height: Math.min(
      DEFAULT_SLIDE_SIZE.height,
      Math.max(theme.fontSize * 5, modelHeight) + margin * 2 + captionHeight,
    ),
  };
  const { x, y, width, height } = viewport;
  if (
    !Object.values(viewport).every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  const inset = Math.min(margin, width / 8, height / 8);
  const caption = Math.min(captionHeight, height / 4);
  const drawingHeight = height - 2 * inset - caption;
  const scale = Math.min(
    (width - 2 * inset) / modelWidth,
    drawingHeight / modelHeight,
  );
  const left = x + (width - modelWidth * scale) / 2;
  const top = y + inset + (drawingHeight - modelHeight * scale) / 2;
  const segments = wireframe.segments.map((value, i) =>
    i % 2 === 0
      ? left + (value - bounds.minX) * scale
      : top + (value - bounds.minY) * scale,
  );
  const body = [
    options.background == null
      ? ""
      : tag("rect", { ...viewport, fill: options.background }),
    cadPageSvgBody(
      { segments, bounds },
      { stroke: theme.ink, strokeWidth: STROKE_WIDTH },
    ),
    text(
      {
        x: x + width / 2,
        y: y + height - inset,
        fill: theme.ink,
        "font-size": Math.min(theme.fontSize, (caption * 2) / 3, width / 12),
        "text-anchor": "middle",
      },
      "Construction view",
    ),
  ]
    .filter(Boolean)
    .join("\n");
  return `${wrap(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width,
      height,
      viewBox: `${fmt(x)} ${fmt(y)} ${fmt(width)} ${fmt(height)}`,
      ...(options.viewport ? { overflow: "hidden" } : {}),
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize,
    },
    `\n${body}\n`,
  )}\n`;
}
