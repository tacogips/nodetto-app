// `nodetto-cli bundle pack|unpack`: one `.nodetto` file holding a document
// and its image attachments, for sending; unpacked back into a JSONL and an
// attachment tree beside it, for committing.

import {
  decodeDocumentBundle,
  DOCUMENT_BUNDLE_EXTENSION,
  encodeDocumentBundle,
} from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import {
  type CommandIo,
  type CommandResult,
  fail,
  loadDocument,
  ok,
  parseArgs,
} from "./commands.ts";
import { helpFor } from "./help.ts";

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function directoryOf(path: string): string {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return slash < 0 ? "." : path.slice(0, slash) || "/";
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

function pack(io: CommandIo, args: readonly string[]): CommandResult {
  const parsed = parseArgs(args, new Set(["--output"]), new Set());
  if (typeof parsed === "string")
    return fail(`${parsed}\n\n${helpFor("bundle")}`);
  const [input, extra] = parsed.positional;
  const output = parsed.options.get("--output");
  if (input === undefined || extra !== undefined || output === undefined)
    return fail(
      `bundle pack expects one document and --output.\n\n${helpFor("bundle")}`,
    );
  if (!io.writeBytes) return fail("This host cannot write binary files.");
  const loaded = loadDocument(io, input);
  if (typeof loaded === "string") return fail(loaded);
  let encoded: ReturnType<typeof encodeDocumentBundle>;
  try {
    encoded = encodeDocumentBundle(loaded.document, (src) => {
      try {
        return io.readAttachment?.(input, src);
      } catch {
        return undefined;
      }
    });
  } catch (cause) {
    return fail(`Cannot bundle ${input}: ${message(cause)}`);
  }
  try {
    io.writeBytes(output, encoded.bytes);
  } catch (cause) {
    return fail(`Cannot write ${output}: ${message(cause)}`);
  }
  const count = encoded.attachments.length;
  return ok(
    "",
    `${loaded.warnings}Wrote ${output} with ${count} attachment${count === 1 ? "" : "s"}.\n`,
  );
}

async function unpack(
  io: CommandIo,
  args: readonly string[],
): Promise<CommandResult> {
  const parsed = parseArgs(args, new Set(["--output"]), new Set(["--force"]));
  if (typeof parsed === "string")
    return fail(`${parsed}\n\n${helpFor("bundle")}`);
  const [input, extra] = parsed.positional;
  const output = parsed.options.get("--output");
  if (input === undefined || extra !== undefined || output === undefined)
    return fail(
      `bundle unpack expects one bundle and --output <doc.jsonl>.\n\n${helpFor("bundle")}`,
    );
  if (!output.toLowerCase().endsWith(".jsonl"))
    return fail("--output names the document to write; use a .jsonl path.");
  if (!io.readBytes || !io.writeBytes || !io.ensureDir || !io.exists)
    return fail("This host cannot unpack bundles.");
  const force = parsed.flags.has("--force");
  let bundle: ReturnType<typeof decodeDocumentBundle>;
  try {
    bundle = decodeDocumentBundle(io.readBytes(input));
  } catch (cause) {
    return fail(`Cannot read ${input}: ${message(cause)}`);
  }
  const text = serializeDocument(bundle.document);
  const directory = directoryOf(output);
  // Check every target before writing anything, so a refusal leaves the
  // working tree untouched.
  const writes: { path: string; bytes: Uint8Array }[] = [];
  const conflicts: string[] = [];
  const plan = (path: string, bytes: Uint8Array): void => {
    if (io.exists?.(path)) {
      let existing: Uint8Array | undefined;
      try {
        existing = io.readBytes?.(path);
      } catch {
        existing = undefined;
      }
      if (existing && sameBytes(existing, bytes)) return;
      if (!force) conflicts.push(path);
    }
    writes.push({ path, bytes });
  };
  for (const [src, bytes] of bundle.attachments)
    plan(`${directory}/${src}`, bytes);
  plan(output, new TextEncoder().encode(text));
  if (conflicts.length > 0)
    return fail(
      `Refusing to overwrite different existing file${conflicts.length === 1 ? "" : "s"}: ${conflicts.join(", ")}. Pass --force to replace ${conflicts.length === 1 ? "it" : "them"}.`,
    );
  try {
    for (const { path, bytes } of writes) {
      await io.ensureDir(directoryOf(path));
      io.writeBytes(path, bytes);
    }
  } catch (cause) {
    return fail(`Cannot unpack ${input}: ${message(cause)}`);
  }
  const warnings = bundle.missing
    .map((src) => `warning: ${src}: image is not in the bundle\n`)
    .join("");
  const count = bundle.attachments.size;
  return ok(
    "",
    `${warnings}Wrote ${output} and ${count} attachment${count === 1 ? "" : "s"}.\n`,
  );
}

export async function bundleCommand(
  io: CommandIo,
  args: readonly string[],
): Promise<CommandResult> {
  const [subcommand, ...rest] = args;
  if (subcommand === "pack") return pack(io, rest);
  if (subcommand === "unpack") return unpack(io, rest);
  return fail(
    `bundle expects pack or unpack (.${DOCUMENT_BUNDLE_EXTENSION} files).\n\n${helpFor("bundle")}`,
  );
}
