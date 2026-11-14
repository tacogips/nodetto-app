import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fontCoverage } from "./font-coverage.ts";
import type { CommandIo } from "./commands.ts";
import { readLocalAttachment } from "./attachments.ts";
import { openDesktopDocument } from "./open-desktop.ts";
import { writeFileAtomic } from "./write-atomic.ts";

/** Shared filesystem and desktop access for terminal and MCP commands. */
export function localIo(): CommandIo {
  return {
    fontCoverage,
    readText: (path) => readFileSync(path, "utf8"),
    readBytes: (path) => new Uint8Array(readFileSync(path)),
    readAttachment: readLocalAttachment,
    openDocument: openDesktopDocument,
    readStdin: () => readFileSync(0, "utf8"),
    writeText: writeFileAtomic,
    writeBytes: writeFileAtomic,
    exists: (path) => existsSync(path),
    listDir: (path) =>
      readdirSync(path)
        .filter((name) => statSync(`${path}/${name}`).isFile())
        .sort(),
  };
}
