import type { CaptureBackend } from "./capture-command.ts";
import { fontOptions } from "./raster-backend.ts";

// captureRasterPlan has already bounded the continuous scale and dimensions.
export const captureBackend: CaptureBackend = {
  async rasterize(svg, scale, fontDir, fallback = false) {
    const { Resvg } = await import("@resvg/resvg-js");
    return new Resvg(svg, {
      fitTo: { mode: "zoom", value: scale },
      font: fontOptions(fontDir, fallback),
    })
      .render()
      .asPng();
  },
};
