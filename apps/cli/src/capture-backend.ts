import type { CaptureBackend } from "./capture-command.ts";
import { fontOptions } from "./raster-backend.ts";

export function captureRenderInput(svg: string): {
  svg: string;
  resources: ReadonlyMap<string, Buffer>;
  mimes: ReadonlyMap<number, string>;
} {
  const resources = new Map<string, Buffer>();
  const mimes = new Map<number, string>();
  const pattern =
    /<image id="nodetto-capture-asset-(\d+)" href="data:image\/(png|jpeg|gif|webp);base64,([^"]+)"\/>/g;
  for (const match of svg.matchAll(pattern)) {
    const index = Number(match[1]);
    const mime = match[2];
    const payload = match[3];
    if (mime === undefined || payload === undefined) continue;
    mimes.set(index, `image/${mime}`);
    if (mime !== "webp")
      resources.set(
        `https://nodetto.invalid/capture-asset/${index}`,
        Buffer.from(payload, "base64"),
      );
  }
  return { svg, resources, mimes };
}

// captureRasterPlan has already bounded the continuous scale and dimensions.
export const captureBackend: CaptureBackend = {
  async rasterize(svg, scale, fontDir, fallback = false) {
    const { Resvg } = await import("@resvg/resvg-js");
    const { resources } = captureRenderInput(svg);
    const resvg = new Resvg(svg, {
      fitTo: { mode: "zoom", value: scale },
      font: fontOptions(fontDir, fallback),
    });
    for (const url of new Set(resvg.imagesToResolve())) {
      const data = resources.get(url);
      if (data) resvg.resolveImage(url, data);
    }
    return resvg.render().asPng();
  },
};
