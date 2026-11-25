import {
  DEFAULT_CAD_INTERFERENCE,
  type CadCaptureInterference,
  type SolidReport,
} from "@nodetto/core";

export const CAPTURE_INTERFERENCE_VALUE_OPTIONS = [
  "--interference-cell",
  "--interference-bodies",
] as const;
export const CAPTURE_INTERFERENCE_FLAGS = [
  "--no-interference",
  "--fail-on-interference",
] as const;

export function parseInterferenceOptions(
  options: ReadonlyMap<string, string>,
  flags: ReadonlySet<string>,
):
  | {
      readonly interference: CadCaptureInterference | null;
      readonly failOnInterference: boolean;
    }
  | { readonly error: string } {
  const disabled = flags.has("--no-interference");
  const failOnInterference = flags.has("--fail-on-interference");
  if (
    disabled &&
    (failOnInterference ||
      options.has("--interference-cell") ||
      options.has("--interference-bodies"))
  )
    return {
      error:
        "--no-interference cannot be combined with other interference options.",
    };
  if (disabled) return { interference: null, failOnInterference: false };
  const cellText = options.get("--interference-cell");
  const cellMm =
    cellText === undefined ? DEFAULT_CAD_INTERFERENCE.cellMm : Number(cellText);
  if (
    cellText?.trim() === "" ||
    !Number.isFinite(cellMm) ||
    cellMm < 0.01 ||
    cellMm > 10
  )
    return { error: "--interference-cell must be between 0.01 and 10 mm." };
  const bodyText = options.get("--interference-bodies");
  const bodies = bodyText?.split(",").map((body) => body.trim());
  if (bodies?.some((body) => body.length === 0))
    return {
      error: "--interference-bodies must contain non-empty body names or ids.",
    };
  return {
    interference: bodies === undefined ? { cellMm } : { cellMm, bodies },
    failOnInterference,
  };
}

export function interferenceExitCode(
  report: SolidReport,
  failOnInterference: boolean,
): 0 | 1 {
  return failOnInterference &&
    (report.pairs.length > 0 ||
      (report.analysis?.uncheckedCount ?? 0) > 0 ||
      (report.analysis?.incomplete?.length ?? 0) > 0)
    ? 1
    : 0;
}
