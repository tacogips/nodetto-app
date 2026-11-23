export const MCP_INLINE_MAX_BYTES = 1_048_576;

/**
 * Both MCP tool forms are normalized to CLI tokens before this check.
 * `--quiet` is accepted before the command, as the CLI itself accepts it.
 */
export function wantsInlineImage(args: readonly string[]): boolean {
  const end = args.indexOf("--");
  const tokens = args
    .slice(0, end === -1 ? undefined : end)
    .filter((arg) => arg !== "--quiet");
  return tokens[0] === "capture" && tokens.includes("--inline", 1);
}

/** Extract the path and media type from a successful capture's stdout. */
export function capturedImage(
  stdout: string,
): { path: string; mimeType: "image/png" | "image/jpeg" } | null {
  let path: unknown;
  if (stdout.startsWith("path: ")) {
    path = stdout.split("\n", 1)[0]?.slice(6).replace(/\r$/, "");
  } else {
    try {
      const report: unknown = JSON.parse(stdout);
      if (typeof report === "object" && report !== null && "path" in report)
        path = report.path;
    } catch {
      return null;
    }
  }
  if (typeof path !== "string") return null;
  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  if (extension === ".png") return { path, mimeType: "image/png" };
  if (extension === ".jpg" || extension === ".jpeg")
    return { path, mimeType: "image/jpeg" };
  return null;
}
