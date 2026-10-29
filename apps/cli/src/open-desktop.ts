import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { desktopOpenLink } from "./open-link.ts";

/**
 * Argument arrays keep file names and application paths out of a shell. A
 * page travels as a nodetto:// link after the file; the file itself still
 * goes first so a sandboxed macOS app is granted access to it.
 */
export function desktopOpenArguments(
  path: string,
  app: string | undefined,
  platform: string = process.platform,
  page?: string,
): readonly [string, string[]] {
  const absolutePath = resolve(path);
  const targets =
    page === undefined
      ? [absolutePath]
      : [absolutePath, desktopOpenLink(absolutePath, page)];
  if (platform === "darwin")
    return ["/usr/bin/open", ["-a", app ?? "nodetto", "--", ...targets]];
  if (platform === "linux" || platform === "win32")
    return [app ?? (platform === "win32" ? "nodetto.exe" : "nodetto"), targets];
  throw new Error(`Desktop launching is unsupported on ${platform}.`);
}

export async function openDesktopDocument(
  path: string,
  app?: string,
  page?: string,
): Promise<void> {
  if (!statSync(path).isFile())
    throw new Error("The path must be a regular file.");
  const [command, args] = desktopOpenArguments(
    path,
    app,
    process.platform,
    page,
  );
  await new Promise<void>((resolveLaunch, reject) => {
    const child = spawn(command, args, {
      detached: process.platform !== "darwin",
      stdio: "ignore",
      shell: false,
    });
    child.once("error", reject);
    if (process.platform === "darwin") {
      // `open` exits immediately, but its exit code tells us if the app was found.
      child.once("exit", (code) => {
        if (code === 0) resolveLaunch();
        else
          reject(
            new Error(
              `macOS could not open the app (exit ${code}). Use --app to specify its name or path.`,
            ),
          );
      });
    } else {
      child.once("spawn", () => {
        child.unref();
        resolveLaunch();
      });
    }
  });
}
