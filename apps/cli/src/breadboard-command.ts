import {
  computeBreadboardConnectivity,
  toBreadboardNetlist,
  layoutBreadboardImport,
} from "@nodetto/core";
import {
  exportBreadboardBomCsv,
  exportBreadboardKicadNetlist,
  exportBreadboardSpiceNetlist,
  importKicad,
  parseDocumentResult,
  serializeDocument,
} from "@nodetto/io";
import { resolvePageQuery, type Document, type Page } from "@nodetto/ir";
import {
  EXIT_DRIFT,
  EXIT_WARNINGS,
  type CommandIo,
  type CommandResult,
  fail,
  ok,
  writeOutput,
} from "./commands.ts";
import { helpFor } from "./help.ts";

interface ParsedArgs {
  readonly positional: readonly string[];
  readonly options: ReadonlyMap<string, string>;
  readonly flags: ReadonlySet<string>;
}

function parseArgs(
  args: readonly string[],
  valueOptions: ReadonlySet<string>,
  flagOptions: ReadonlySet<string>,
): ParsedArgs | string {
  const positional: string[] = [];
  const options = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] as string;
    if (arg === "--") {
      positional.push(...args.slice(index + 1));
      break;
    }
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const equals = arg.indexOf("=");
    const name = equals === -1 ? arg : arg.slice(0, equals);
    if (flagOptions.has(name)) {
      if (equals !== -1) return `${name} does not take a value.`;
      if (flags.has(name)) return `${name} was given more than once.`;
      flags.add(name);
      continue;
    }
    if (!valueOptions.has(name)) return `Unknown option: ${name}`;
    const value = equals === -1 ? args[index + 1] : arg.slice(equals + 1);
    if (
      value === undefined ||
      value === "" ||
      (equals === -1 && value.startsWith("--"))
    )
      return `${name} requires a value.`;
    if (equals === -1) index += 1;
    if (options.has(name)) return `${name} was given more than once.`;
    options.set(name, value);
  }
  return { positional, options, flags };
}

function readDocument(io: CommandIo, path: string): Document | string {
  let source: string;
  try {
    source = io.readText(path);
  } catch (cause) {
    return `Cannot read ${path}: ${cause instanceof Error ? cause.message : String(cause)}`;
  }
  const parsed = parseDocumentResult(source);
  if (!parsed.ok) return `${path} is not a valid nodetto document.`;
  return parsed.document;
}

function selectBreadboardPage(
  document: Document,
  query: string | undefined,
): Page | string {
  const pages = document.pages.filter((page) => page.kind === "breadboard");
  if (query !== undefined) {
    const resolved = resolvePageQuery(pages, query);
    return resolved.ok ? resolved.page : resolved.message;
  }
  const [only, ...others] = pages;
  if (!only) return "The document contains no breadboard pages.";
  if (!others.length) return only;
  return `The document has ${pages.length} breadboard pages; choose one with --page:\n${pages
    .map((page) => `  ${page.name} (full id: ${page.id})`)
    .join("\n")}`;
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function diagnosticsText(
  fileName: string,
  diagnostics: ReturnType<typeof importKicad>["diagnostics"],
): string {
  return diagnostics
    .map((diagnostic) => {
      const location =
        diagnostic.line === undefined
          ? fileName
          : `${fileName}:${diagnostic.line}${diagnostic.column === undefined ? "" : `:${diagnostic.column}`}`;
      return `${diagnostic.severity}: ${location}: ${diagnostic.code}: ${diagnostic.message}\n`;
    })
    .join("");
}

function exportCommand(
  io: CommandIo,
  kind: "bom" | "netlist",
  args: readonly string[],
): CommandResult {
  const parsed = parseArgs(
    args,
    new Set(["--page", "--output", "--check", "--format"]),
    new Set(["--strict"]),
  );
  if (typeof parsed === "string")
    return fail(`${parsed}\n\n${helpFor("breadboard")}`);
  const requiresFormat = kind === "netlist";
  const allowedPositionals = kind === "bom" ? 1 : 1;
  if (parsed.positional.length !== allowedPositionals)
    return fail(
      `breadboard ${kind} expects exactly one document path.\n\n${helpFor("breadboard")}`,
    );
  if (
    requiresFormat &&
    parsed.options.get("--format") !== "kicad" &&
    parsed.options.get("--format") !== "spice"
  )
    return fail(
      `netlist requires --format kicad or spice.\n\n${helpFor("breadboard")}`,
    );
  if (!requiresFormat && parsed.options.has("--format"))
    return fail(
      `breadboard bom does not accept --format.\n\n${helpFor("breadboard")}`,
    );
  if (parsed.options.has("--output") && parsed.options.has("--check"))
    return fail("--output and --check cannot be used together.");

  const [path = ""] = parsed.positional;
  const document = readDocument(io, path);
  if (typeof document === "string") return fail(document);
  const selected = selectBreadboardPage(document, parsed.options.get("--page"));
  if (typeof selected === "string") return fail(selected);
  const connectivity = computeBreadboardConnectivity(document, selected.id);
  const netlist = toBreadboardNetlist(document, selected.id, connectivity);
  const report =
    kind === "bom"
      ? exportBreadboardBomCsv(netlist)
      : parsed.options.get("--format") === "kicad"
        ? exportBreadboardKicadNetlist(netlist)
        : exportBreadboardSpiceNetlist(netlist);
  const warnings = report.warnings
    .map((warning) => `warning: ${warning}\n`)
    .join("");
  if (parsed.flags.has("--strict") && report.warnings.length)
    return {
      exitCode: EXIT_WARNINGS,
      stdout: "",
      stderr: `${warnings}${report.warnings.length} breadboard export warning(s) with --strict.\n`,
    };

  const checkPath = parsed.options.get("--check");
  if (checkPath !== undefined) {
    let current: string;
    try {
      current = io.readText(checkPath);
    } catch (cause) {
      return fail(
        `${warnings}Cannot read ${checkPath}: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
    if (normalizeNewlines(current) !== report.text)
      return fail(`${warnings}${checkPath} is out of date.`, EXIT_DRIFT);
    return ok("", `${warnings}${checkPath} is up to date.\n`);
  }
  const outputPath = parsed.options.get("--output");
  if (outputPath !== undefined) {
    const error = writeOutput(io, outputPath, report.text);
    if (error) return fail(`${warnings}${error}`);
    return ok("", `${warnings}Wrote breadboard ${kind} to ${outputPath}.\n`);
  }
  return ok(report.text, warnings);
}

function importCommand(io: CommandIo, args: readonly string[]): CommandResult {
  const parsed = parseArgs(args, new Set(["--output"]), new Set(["--strict"]));
  if (typeof parsed === "string")
    return fail(`${parsed}\n\n${helpFor("breadboard")}`);
  if (parsed.positional.length !== 1)
    return fail(
      `breadboard import expects exactly one input file.\n\n${helpFor("breadboard")}`,
    );
  const [path = ""] = parsed.positional;
  let source: string;
  try {
    source = io.readText(path);
  } catch (cause) {
    return fail(
      `Cannot read ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
  const fileName = path.split(/[\\/]/).at(-1) ?? path;
  const imported = importKicad(source, { fileName });
  const diagnostics = diagnosticsText(fileName, imported.diagnostics);
  if (!imported.plan)
    return { exitCode: EXIT_DRIFT, stdout: "", stderr: diagnostics };
  const warningCount = imported.diagnostics.filter(
    (item) => item.severity === "warning",
  ).length;
  if (parsed.flags.has("--strict") && warningCount)
    return {
      exitCode: EXIT_WARNINGS,
      stdout: "",
      stderr: `${diagnostics}${warningCount} KiCad import warning(s) with --strict.\n`,
    };
  const jsonl = serializeDocument(layoutBreadboardImport(imported.plan));
  const outputPath = parsed.options.get("--output");
  if (outputPath !== undefined) {
    const error = writeOutput(io, outputPath, jsonl);
    if (error) return fail(`${diagnostics}${error}`);
    return ok(
      "",
      `${diagnostics}Wrote breadboard document to ${outputPath}.\n`,
    );
  }
  return ok(jsonl, diagnostics);
}

export function breadboardCommand(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const [subcommand, ...rest] = args;
  if (subcommand === "bom") return exportCommand(io, "bom", rest);
  if (subcommand === "netlist") return exportCommand(io, "netlist", rest);
  if (subcommand === "import") return importCommand(io, rest);
  return fail(
    `breadboard expects the bom, netlist or import subcommand.\n\n${helpFor("breadboard")}`,
  );
}
