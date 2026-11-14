import {
  importPcbPage,
  keyAfter,
  type PcbImportFile,
  type PcbImportWarning,
  pcbFilesFromZip,
} from "@nodetto/core";
import { isZip, serializeDocument } from "@nodetto/io";
import {
  assertValidDocument,
  type Document,
  SCHEMA_VERSION,
} from "@nodetto/ir";
import {
  EXIT_WARNINGS,
  type CommandIo,
  type CommandResult,
  fail,
  loadDocument,
  ok,
  parseArgs,
  writeOutput,
} from "./commands.ts";
import { helpFor } from "./help.ts";

const IMPORT_OPTIONS = new Set(["--output", "--into", "--page-name"]);

function baseName(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path;
}

function readInputs(
  io: CommandIo,
  paths: readonly string[],
): PcbImportFile[] | string {
  const files: PcbImportFile[] = [];
  for (const path of paths) {
    try {
      if (/\.zip$/i.test(path)) {
        if (!io.readBytes) return "This environment cannot read ZIP archives.";
        const bytes = io.readBytes(path);
        if (!isZip(bytes)) return `${path} is not a ZIP archive.`;
        files.push(...pcbFilesFromZip(bytes));
      } else files.push({ name: path, text: io.readText(path) });
    } catch (cause) {
      return `Cannot read ${path}: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
  }
  return files;
}

function warningLines(warnings: readonly PcbImportWarning[]): string {
  return warnings
    .map((warning) =>
      warning.file
        ? `warning: ${baseName(warning.file)}: ${warning.message}\n`
        : `warning: ${warning.message}\n`,
    )
    .join("");
}

function importCommand(io: CommandIo, args: readonly string[]): CommandResult {
  const parsed = parseArgs(args, IMPORT_OPTIONS, new Set(["--strict"]));
  if (typeof parsed === "string")
    return fail(`${parsed}\n\n${helpFor("gerber")}`);
  if (parsed.positional.length === 0)
    return fail(
      `gerber import expects Gerber, drill or ZIP file paths.\n\n${helpFor("gerber")}`,
    );
  const output = parsed.options.get("--output");
  const into = parsed.options.get("--into");
  if (output !== undefined && into !== undefined)
    return fail(`Use --output or --into, not both.\n\n${helpFor("gerber")}`);
  const files = readInputs(io, parsed.positional);
  if (typeof files === "string") return fail(files);
  if (files.length === 0)
    return fail("No Gerber or drill file found in the input.");

  let target: Document | undefined;
  let loadWarnings = "";
  if (into !== undefined) {
    const loaded = loadDocument(io, into);
    if (typeof loaded === "string") return fail(loaded);
    target = loaded.document;
    loadWarnings = loaded.warnings;
  }
  const first = parsed.positional[0] as string;
  const name =
    parsed.options.get("--page-name") ??
    (/\.zip$/i.test(first) || parsed.positional.length === 1
      ? baseName(first).replace(/\.[^.]+$/, "")
      : "PCB");
  const existingPages = new Set(target?.pages.map((page) => page.id));
  let pageId = "pcb-page-1";
  for (let suffix = 2; existingPages.has(pageId); suffix++)
    pageId = `pcb-page-${suffix}`;
  let imported: ReturnType<typeof importPcbPage>;
  try {
    imported = importPcbPage(files, {
      pageId,
      pageName: name,
      ...(target
        ? { reservedIds: new Set(target.elements.map((element) => element.id)) }
        : {}),
    });
  } catch (cause) {
    return fail(
      `Cannot import: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
  const warnings = `${loadWarnings}${warningLines(imported.warnings)}`;
  if (parsed.flags.has("--strict") && imported.warnings.length)
    return {
      exitCode: EXIT_WARNINGS,
      stdout: "",
      stderr: `${warnings}${imported.warnings.length} Gerber import warning(s) with --strict.\n`,
    };
  const lastOrder = target?.pages
    .map((page) => page.order)
    .filter((order): order is string => order !== undefined)
    .sort()
    .at(-1);
  // A fixed midpoint keeps the output reproducible.
  const page = {
    ...imported.page,
    order: keyAfter(lastOrder ?? null, () => 0.5),
  };
  const document: Document = target
    ? {
        ...target,
        pages: [...target.pages, page],
        elements: [...target.elements, ...imported.elements],
      }
    : {
        schemaVersion: SCHEMA_VERSION,
        id: "pcb-document",
        title: name,
        pages: [page],
        elements: imported.elements,
      };
  try {
    assertValidDocument(document);
  } catch (cause) {
    return fail(
      `Cannot import: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
  const summary = [
    `Board ${imported.size.width.toFixed(2)} x ${imported.size.height.toFixed(2)} mm, ${imported.layers.length} layer(s):`,
    ...imported.layers.map(
      (layer) =>
        `  ${layer.name}: ${baseName(layer.file)} (${layer.objects} object(s))`,
    ),
  ].join("\n");
  const jsonl = serializeDocument(document);
  const destination = into ?? output;
  if (destination !== undefined) {
    const failure = writeOutput(io, destination, jsonl);
    if (failure) return fail(`${warnings}${failure}`);
    return ok(
      "",
      `${warnings}${summary}\n${into ? `Added page "${name}" to` : "Wrote PCB document to"} ${destination}.\n`,
    );
  }
  return ok(jsonl, `${warnings}${summary}\n`);
}

export function gerberCommand(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const [subcommand, ...rest] = args;
  if (subcommand === "import") return importCommand(io, rest);
  return fail(`gerber expects the import subcommand.\n\n${helpFor("gerber")}`);
}
