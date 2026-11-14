export interface SlideSize {
  readonly width: number;
  readonly height: number;
}
export const PRESENTATION_MARGIN = 24;
export function fitSlide(
  source: SlideSize,
  viewport: SlideSize,
  margin = PRESENTATION_MARGIN,
): { scale: number; x: number; y: number; width: number; height: number } {
  const { width: sw, height: sh } = source;
  const { width: vw, height: vh } = viewport;
  if (
    ![sw, sh, vw, vh, margin].every(Number.isFinite) ||
    sw <= 0 ||
    sh <= 0 ||
    vw <= 0 ||
    vh <= 0
  ) {
    return {
      scale: 0,
      width: 0,
      height: 0,
      x: Number.isFinite(vw) ? vw / 2 : 0,
      y: Number.isFinite(vh) ? vh / 2 : 0,
    };
  }
  const m = Math.min(Math.max(0, margin), vw / 4, vh / 4);
  const scale = Math.min((vw - 2 * m) / sw, (vh - 2 * m) / sh);
  const width = sw * scale;
  const height = sh * scale;
  return { scale, width, height, x: (vw - width) / 2, y: (vh - height) / 2 };
}
