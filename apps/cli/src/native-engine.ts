import { applyQuiet, extractQuiet } from "./warnings.ts";
// Build-time entry point for the shared diagram engine embedded in the Rust
// executable. It imports no Node/Bun APIs; OS operations belong to Rust.
import { runCli } from "./commands.ts";
import { type CaptureBackend, captureCommand } from "./capture-command.ts";
import { exportCommand } from "./export-command.ts";
import { compareCommand } from "./compare-command.ts";
import { openCommand } from "./open-command.ts";
import { bundleCommand } from "./bundle-command.ts";
import { desktopOpenLink } from "./open-link.ts";
import { pdfLayout, buildPdfTextLayer, nativePdfSpec } from "@nodetto/core";
import { COMMAND_HELP, OVERVIEW } from "./help.ts";

declare const native: {
  path(path: string): string;
  readText(path: string): string;
  readBytes(path: string): Uint8Array;
  listDir(path: string): string;
  writeBytes(path: string, data: Uint8Array): void;
  captureDir(): string;
  captureAbsolute(path: string): string;
  writeCapture(
    path: string,
    bytes: Uint8Array,
    replace: boolean,
  ): "written" | "identical" | "exists";
  digest(bytes: Uint8Array): string;
  nmeshDecode(data: string): Uint8Array;
  nmeshCapture(
    data: string,
    maxVertices: number,
    needTarget: boolean,
  ): Uint8Array;
  nmeshBounds(data: string): Uint8Array | null;
  captureSolid(
    scene: Uint8Array,
    format: "png" | "jpg",
    quality: number,
  ): Uint8Array;
  captureEncode(
    png: Uint8Array,
    format: "jpg",
    quality: number,
    background: string,
  ): Uint8Array;
  ensureDir(path: string): void;
  pdfPages(pngs: Uint8Array, spec: string): Uint8Array;
  exists(path: string): boolean;
  readStdin(): string;
  attachment(document: string, path: string): Uint8Array;
  open(path: string, app: string | undefined, link: string | undefined): void;
  png(
    svg: string,
    scale: number,
    fontDir: string | undefined,
    fallback: boolean,
  ): Uint8Array;
  fontCoverage(text: string, fontDir: string | undefined): string;
  pdf(png: Uint8Array, layout: string): Uint8Array;
};

const io = {
  fontCoverage: (text: string, fontDir: string | undefined) =>
    (JSON.parse(
      native.fontCoverage(
        text,
        fontDir === undefined ? undefined : native.path(fontDir),
      ),
    ) ?? undefined) as
      | { readonly needsFallback: boolean; readonly missing: readonly number[] }
      | undefined,
  readText: (path: string) => native.readText(native.path(path)),
  readBytes: (path: string) =>
    new Uint8Array(native.readBytes(native.path(path))),
  writeText: (path: string, text: string) =>
    native.writeBytes(native.path(path), new TextEncoder().encode(text)),
  writeBytes: (path: string, bytes: Uint8Array) =>
    native.writeBytes(native.path(path), bytes),
  // The interpreter is too slow for the per-byte loops of the mesh codec.
  decodeMesh: (data: string) => {
    const packet = native.nmeshDecode(data);
    const [vertices = 0, triangles = 0] = new Uint32Array(packet.buffer, 0, 2);
    return {
      positions: new Float64Array(packet.buffer, 8, vertices * 3),
      triangles: new Uint32Array(
        packet.buffer,
        8 + vertices * 24,
        triangles * 3,
      ),
    };
  },
  decodeCaptureMesh: (
    data: string,
    options: { readonly maxVertices?: number; readonly needTarget?: boolean },
  ) => {
    const packet = native.nmeshCapture(
      data,
      options.maxVertices ?? Number.POSITIVE_INFINITY,
      options.needTarget === true,
    );
    const view = new DataView(
      packet.buffer,
      packet.byteOffset,
      packet.byteLength,
    );
    const vertexCount = view.getUint32(0, true);
    const triangleCount = view.getUint32(4, true);
    const flags = view.getUint32(8, true);
    const bounds =
      (flags & 8) === 0
        ? null
        : {
            min: [
              view.getFloat64(16, true),
              view.getFloat64(24, true),
              view.getFloat64(32, true),
            ] as const,
            max: [
              view.getFloat64(40, true),
              view.getFloat64(48, true),
              view.getFloat64(56, true),
            ] as const,
          };
    return {
      vertexCount,
      triangleCount,
      bounds,
      ...((flags & 2) !== 0 ? { booleanTarget: (flags & 4) !== 0 } : {}),
      ...((flags & 1) !== 0
        ? {
            positions: new Float64Array(
              packet.buffer,
              packet.byteOffset + 64,
              vertexCount * 3,
            ),
            triangles: new Uint32Array(
              packet.buffer,
              packet.byteOffset + 64 + vertexCount * 24,
              triangleCount * 3,
            ),
          }
        : {}),
    };
  },
  meshBounds: (data: string) => {
    const packet = native.nmeshBounds(data);
    if (packet === null) return null;
    const view = new DataView(
      packet.buffer,
      packet.byteOffset,
      packet.byteLength,
    );
    return {
      min: [
        view.getFloat64(0, true),
        view.getFloat64(8, true),
        view.getFloat64(16, true),
      ] as const,
      max: [
        view.getFloat64(24, true),
        view.getFloat64(32, true),
        view.getFloat64(40, true),
      ] as const,
    };
  },
  capture: {
    dir: native.captureDir,
    absolute: native.captureAbsolute,
    write: (path: string, bytes: Uint8Array, replace: boolean) =>
      native.writeCapture(native.path(path), bytes, replace),
    digest: native.digest,
  },
  ensureDir: async (path: string) => native.ensureDir(native.path(path)),
  exists: (path: string) => native.exists(native.path(path)),
  listDir: (path: string) =>
    JSON.parse(native.listDir(native.path(path))) as string[],
  readStdin: native.readStdin,
  readAttachment: (document: string, path: string) =>
    new Uint8Array(native.attachment(native.path(document), path)),
  openDocument: async (path: string, app?: string, page?: string) => {
    const absolute = native.path(path);
    native.open(
      absolute,
      app,
      page === undefined ? undefined : desktopOpenLink(absolute, page),
    );
  },
};

async function rasterize(
  svg: string,
  scale: number,
  fontDir: string | undefined,
  fallback = false,
): Promise<Uint8Array> {
  return new Uint8Array(
    native.png(
      svg,
      scale,
      fontDir === undefined ? undefined : native.path(fontDir),
      fallback,
    ),
  );
}

const renderSolid: NonNullable<CaptureBackend["renderSolid"]> = (
  scene,
  format,
  quality,
) => {
  const packet = native.captureSolid(scene, format, quality);
  if (packet.byteLength < 4) throw new Error("Truncated solid capture packet.");
  const view = new DataView(
    packet.buffer,
    packet.byteOffset,
    packet.byteLength,
  );
  const imageOffset = 4 + view.getUint32(0, true);
  if (imageOffset >= packet.byteLength)
    throw new Error("Truncated solid capture packet.");
  return {
    report: new TextDecoder().decode(packet.subarray(4, imageOffset)),
    image: packet.subarray(imageOffset),
  };
};

// JSON at this boundary keeps interpreter handles local to each Rust invocation.
Object.assign(globalThis, {
  nodettoHelp: JSON.stringify({ overview: OVERVIEW, commands: COMMAND_HELP }),
  nodettoRun: async (input: string, version: string) => {
    const extracted = extractQuiet(JSON.parse(input) as string[]);
    const args = extracted.args;
    const [command, ...rest] = args;
    const help = rest.includes("--help") || rest.includes("-h");
    const result =
      command === "export" && !help
        ? await exportCommand(io, rest, {
            rasterize,
            pagesToPdf: async (pages) => {
              const pngs = new Uint8Array(
                pages.reduce((sum, page) => sum + page.png.length, 0),
              );
              let offset = 0;
              for (const page of pages) {
                pngs.set(page.png, offset);
                offset += page.png.length;
              }
              return new Uint8Array(
                native.pdfPages(
                  pngs,
                  nativePdfSpec(
                    buildPdfTextLayer(pages.map((page) => page.spec)),
                    pages.map((page) => ({
                      pngLength: page.png.length,
                      layout: page.spec.layout,
                    })),
                  ),
                ),
              );
            },
            pngToPdf: async (png, width, height, options) =>
              new Uint8Array(
                native.pdf(
                  png,
                  JSON.stringify(pdfLayout(width, height, options)),
                ),
              ),
          })
        : command === "capture" && !help
          ? await captureCommand(io, rest, {
              rasterize,
              transcode: native.captureEncode,
              renderSolid,
            })
          : command === "compare" && !help
            ? await compareCommand(io, rest, { rasterize })
            : command === "open" && !help
              ? await openCommand(io, rest)
              : command === "bundle" && !help
                ? await bundleCommand(io, rest)
                : runCli(args, io, version);
    return JSON.stringify(
      extracted.quiet ? applyQuiet(command ?? "", result) : result,
    );
  },
});
