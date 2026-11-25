import { randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  linkSync,
  mkdirSync,
  openSync,
  readSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { CommandIo } from "./commands.ts";
import { siblingPath, writeEntryAtomic } from "./write-atomic.ts";

type CaptureIo = NonNullable<CommandIo["capture"]>;
type WriteResult = ReturnType<CaptureIo["write"]>;

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export function captureDirectory(
  parent = tmpdir(),
  owner = process.geteuid?.(),
): string {
  const path = join(
    parent,
    owner === undefined ? "nodetto-capture" : `nodetto-capture-${owner}`,
  );
  try {
    try {
      mkdirSync(path, { mode: 0o700 });
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
    }
    const entry = lstatSync(path);
    if (!entry.isDirectory()) throw new Error("it is not a directory");
    if (owner !== undefined) {
      if (entry.uid !== owner) throw new Error("it belongs to another user");
      if ((entry.mode & 0o022) !== 0) {
        throw new Error("it is writable by other users");
      }
    }
    return path;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot use the capture directory ${path}: ${reason}.`);
  }
}

function existingMatches(path: string, bytes: Uint8Array): boolean {
  try {
    const entry = lstatSync(path, { bigint: true });
    if (!entry.isFile() || entry.size !== BigInt(bytes.length)) return false;
    const descriptor = openSync(
      path,
      constants.O_RDONLY |
        (constants.O_NOFOLLOW ?? 0) |
        (constants.O_NONBLOCK ?? 0),
    );
    try {
      const opened = fstatSync(descriptor, { bigint: true });
      const current = lstatSync(path, { bigint: true });
      if (
        !opened.isFile() ||
        !current.isFile() ||
        opened.dev !== entry.dev ||
        opened.ino !== entry.ino ||
        opened.size !== entry.size ||
        opened.dev !== current.dev ||
        opened.ino !== current.ino
      ) {
        return false;
      }
      const contents = Buffer.alloc(bytes.length + 1);
      let length = 0;
      while (length < contents.length) {
        const read = readSync(
          descriptor,
          contents,
          length,
          contents.length - length,
          null,
        );
        if (read === 0) break;
        length += read;
      }
      return contents.subarray(0, length).equals(bytes);
    } finally {
      closeSync(descriptor);
    }
  } catch {
    return false;
  }
}

function writeNew(path: string, bytes: Uint8Array): WriteResult {
  try {
    lstatSync(path);
    return existingMatches(path, bytes) ? "identical" : "exists";
  } catch (error) {
    if (!hasCode(error, "ENOENT")) throw error;
  }
  const staging = siblingPath(
    path,
    `.nodetto-${randomBytes(8).toString("hex")}.tmp`,
  );
  const descriptor = openSync(staging, "wx", 0o666);
  try {
    try {
      writeFileSync(descriptor, bytes);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    try {
      linkSync(staging, path);
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
      return existingMatches(path, bytes) ? "identical" : "exists";
    }
    return "written";
  } finally {
    try {
      unlinkSync(staging);
    } catch {
      // Preserve the original result or error.
    }
  }
}

function writeCapture(
  path: string,
  bytes: Uint8Array,
  replace: boolean,
): WriteResult {
  if (!replace) return writeNew(path, bytes);
  let entry: ReturnType<typeof lstatSync>;
  try {
    entry = lstatSync(path);
  } catch (error) {
    if (!hasCode(error, "ENOENT")) throw error;
    if (writeNew(path, bytes) === "exists") {
      throw new Error("the output path appeared while writing");
    }
    return "written";
  }
  if (entry.isSymbolicLink())
    throw new Error("the output path is a symbolic link");
  if (!entry.isFile()) throw new Error("the output path is not a regular file");
  writeEntryAtomic(path, bytes, entry.mode & 0o7777);
  return "written";
}

function digest(bytes: Uint8Array): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function absolutePath(path: string): string {
  if (process.platform === "win32") return resolve(path);

  const cwd = process.cwd();
  const absolute = isAbsolute(path)
    ? path
    : `${cwd.endsWith("/") ? cwd : `${cwd}/`}${path}`;
  const root =
    absolute.startsWith("//") && !absolute.startsWith("///") ? "//" : "/";
  // Keep ".." so the filesystem resolves it after following any symlinks.
  const components = absolute
    .split("/")
    .filter((part) => part !== "" && part !== ".");
  const suffix = absolute.endsWith("/") && components.length > 0 ? "/" : "";
  return `${root}${components.join("/")}${suffix}`;
}

export const captureIo: CaptureIo = {
  dir: captureDirectory,
  absolute: absolutePath,
  write: writeCapture,
  digest,
};
