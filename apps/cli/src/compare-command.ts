import {
  composeComparisonSvg,
  pairByLeadingNumber,
  parseBand,
  type ComparisonBand,
} from "@nodetto/core";
import { type CommandIo, type CommandResult, fail, ok } from "./commands.ts";

/** Compose comparison panels through the same rasterizer used by export. */
export async function compareCommand(
  io: CommandIo,
  args: readonly string[],
  raster: {
    rasterize(
      svg: string,
      scale: number,
      fontDir: string | undefined,
      fallback?: boolean,
    ): Promise<Uint8Array>;
  },
): Promise<CommandResult> {
  try {
    const positional: string[] = [];
    const options = new Map<string, string>();
    const bands: ComparisonBand[] = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i] as string;
      if (!arg.startsWith("--")) {
        positional.push(arg);
        continue;
      }
      const eq = arg.indexOf("=");
      const name = eq < 0 ? arg : arg.slice(0, eq);
      if (!["--output", "--scale", "--band", "--grid"].includes(name))
        throw new Error(`Unknown option: ${name}`);
      const value = eq < 0 ? args[++i] : arg.slice(eq + 1);
      if (!value || value.startsWith("--"))
        throw new Error(`${name} requires a value`);
      if (name === "--band") bands.push(parseBand(value));
      else {
        if (options.has(name))
          throw new Error(`${name} was given more than once`);
        options.set(name, value);
      }
    }
    if (positional.length !== 2 || !options.has("--output"))
      throw new Error(
        "compare expects actual and reference paths and --output",
      );
    const scale = Number(options.get("--scale") ?? "2");
    const gridText = options.get("--grid");
    const grid = gridText === undefined ? undefined : Number(gridText);
    if (!Number.isFinite(scale) || scale <= 0)
      throw new Error("--scale must be positive and finite");
    if (grid !== undefined && (!Number.isFinite(grid) || grid <= 0))
      throw new Error("--grid must be positive and finite");
    if (!io.readBytes || !io.writeBytes)
      throw new Error("binary file access is unavailable");
    const [actual, reference] = positional as [string, string];
    const output = options.get("--output") as string;
    const actualFile = /\.png$/i.test(actual);
    const referenceFile = /\.png$/i.test(reference);
    if (actualFile !== referenceFile)
      throw new Error("inputs must both be PNG files or both be directories");
    const join = (dir: string, name: string) =>
      `${dir.replace(/[\\/]+$/, "")}/${name}`;
    let pairs: readonly { number: number; actual: string; reference: string }[];
    if (actualFile) pairs = [{ number: 1, actual, reference }];
    else {
      if (!io.listDir) throw new Error("directory listing is unavailable");
      const entries = (path: string) =>
        io
          .listDir?.(path)
          .filter((name) => /\.png$/i.test(name))
          .map((name) => ({ name, value: join(path, name) })) ?? [];
      pairs = pairByLeadingNumber(entries(actual), entries(reference));
      if (!pairs.length) throw new Error("no PNG files found to compare");
      io.listDir(output); // Verify the output directory exists before any writes.
    }
    const lines: string[] = [];
    for (const pair of pairs) {
      const composed = composeComparisonSvg({
        actual: io.readBytes(pair.actual),
        reference: io.readBytes(pair.reference),
        scale,
        ...(bands.length ? { bands } : {}),
        ...(grid === undefined ? {} : { grid }),
      });
      const destination = actualFile
        ? output
        : join(output, `${String(pair.number).padStart(2, "0")}-compare.png`);
      io.writeBytes(
        destination,
        await raster.rasterize(composed.svg, 1, undefined),
      );
      lines.push(
        ...composed.warnings.map((warning) => `warning: ${warning}`),
        `${pair.actual}\t${pair.reference}\t${destination}`,
      );
    }
    return ok(`${lines.join("\n")}\n`);
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : String(cause), 1);
  }
}
