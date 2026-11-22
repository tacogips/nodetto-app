export const MCP_INLINE_MAX_BYTES = 1_048_576;

/** Both MCP tool forms are normalized to CLI tokens before this check. */
export function wantsInlineImage(args: readonly string[]): boolean {
  const end = args.indexOf("--");
  return (
    args[0] === "capture" &&
    args.slice(1, end === -1 ? undefined : end).includes("--inline")
  );
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
