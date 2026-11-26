import {
  Editor,
  computeSchematicConnectivity,
  layoutSchematicImport,
  toSchematicNetlist,
} from "@nodetto/core";
import {
  breadboardTargetFromSchematic,
  exportSchematicKicadNetlist,
  exportSchematicNetlistText,
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
  parseArgs,
  writeOutput,
} from "./commands.ts";
import { helpFor } from "./help.ts";

function select(
  document: Document,
  kind: "schematic" | "breadboard",
  query: string | undefined,
): Page | string {
  const pages = document.pages.filter((page) => page.kind === kind);
  if (query !== undefined) {
    const result = resolvePageQuery(pages, query);
    return result.ok ? result.page : result.message;
  }
  if (pages.length === 1 && pages[0]) return pages[0];
  return pages.length
    ? `The document has ${pages.length} ${kind} pages; select one.`
    : `The document contains no ${kind} pages.`;
}

function read(io: CommandIo, path: string): Document | string {
  try {
    const parsed = parseDocumentResult(io.readText(path));
    return parsed.ok
      ? parsed.document
      : `${path} is not a valid nodetto document.`;
  } catch (error) {
    return `Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function diagnostics(
  file: string,
  items: readonly {
    severity: string;
    code: string;
    message: string;
    line?: number;
    column?: number;
  }[],
): string {
  return items
    .map(
      (item) =>
        `${item.severity}: ${file}${item.line === undefined ? "" : `:${item.line}${item.column === undefined ? "" : `:${item.column}`}`}: ${item.code}: ${item.message}\n`,
    )
    .join("");
}

export function schematicCommand(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const [command, ...rest] = args;
  if (
    command !== "netlist" &&
    command !== "import" &&
    command !== "to-breadboard"
  )
    return fail(
      `Expected schematic netlist, import or to-breadboard.\n\n${helpFor("schematic")}`,
    );
  const options =
    command === "netlist"
      ? ["--format", "--page", "--output", "--check"]
      : command === "import"
        ? ["--output"]
        : ["--page", "--breadboard", "--output"];
  const parsed = parseArgs(
    rest,
    new Set(options),
    new Set(command === "to-breadboard" ? [] : ["--strict"]),
  );
  if (typeof parsed === "string") return fail(parsed);
  if (parsed.positional.length !== 1)
    return fail(`schematic ${command} expects one input path.`);
  const path = parsed.positional[0] ?? "";
  const output = parsed.options.get("--output");
  if (command === "import") {
    let source: string;
    try {
      source = io.readText(path);
    } catch (error) {
      return fail(
        `Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const file = path.split(/[\\/]/).at(-1) ?? path;
    const stats = {
      nodeVisits: 0,
      segmentCandidates: 0,
      diagonalWork: 0,
      labelVisits: 0,
    };
    const imported = importKicad(source, {
      fileName: file,
      stats,
      diagonalBudget: "schematic",
    });
    let messages = diagnostics(file, imported.diagnostics);
    if (
      !imported.plan ||
      imported.diagnostics.some((item) => item.severity === "error")
    )
      return { exitCode: EXIT_DRIFT, stdout: "", stderr: messages };
    const layout = layoutSchematicImport(imported.plan);
    messages += diagnostics(file, layout.diagnostics);
    if (
      !layout.document ||
      layout.diagnostics.some((item) => item.severity === "error")
    )
      return { exitCode: EXIT_DRIFT, stdout: "", stderr: messages };
    if (
      parsed.flags.has("--strict") &&
      [...imported.diagnostics, ...layout.diagnostics].some(
        (item) => item.severity === "warning",
      )
    )
      return { exitCode: EXIT_WARNINGS, stdout: "", stderr: messages };
    const text = serializeDocument(layout.document);
    if (output !== undefined) {
      const error = writeOutput(io, output, text);
      return error ? fail(`${messages}${error}`) : ok("", messages);
    }
    return ok(text, messages);
  }
  if (
    command === "netlist" &&
    parsed.options.get("--format") !== "text" &&
    parsed.options.get("--format") !== "kicad"
  )
    return fail("netlist requires --format text or kicad.");
  if (output !== undefined && parsed.options.has("--check"))
    return fail("--output and --check cannot be used together.");
  const document = read(io, path);
  if (typeof document === "string") return fail(document);
  const page = select(document, "schematic", parsed.options.get("--page"));
  if (typeof page === "string") return fail(page);
  const netlist = toSchematicNetlist(
    document,
    page.id,
    computeSchematicConnectivity(document, page.id),
  );
  if (command === "to-breadboard") {
    const board = select(
      document,
      "breadboard",
      parsed.options.get("--breadboard"),
    );
    if (typeof board === "string") return fail(board);
    const projection = breadboardTargetFromSchematic(netlist, {
      pageName: page.name,
    });
    const messages = diagnostics(path, projection.diagnostics);
    if (!projection.target)
      return { exitCode: EXIT_DRIFT, stdout: "", stderr: messages };
    const editor = new Editor({ document });
    editor.setBreadboardTarget(board.id, projection.target);
    const text = serializeDocument(editor.getSnapshot());
    if (output !== undefined) {
      const error = writeOutput(io, output, text);
      return error ? fail(`${messages}${error}`) : ok("", messages);
    }
    return ok(text, messages);
  }
  const report =
    parsed.options.get("--format") === "text"
      ? exportSchematicNetlistText(netlist)
      : exportSchematicKicadNetlist(netlist);
  const warnings = report.warnings
    .map((warning) => `warning: ${warning}\n`)
    .join("");
  if (parsed.flags.has("--strict") && report.warnings.length)
    return { exitCode: EXIT_WARNINGS, stdout: "", stderr: warnings };
  const check = parsed.options.get("--check");
  if (check !== undefined) {
    let current: string;
    try {
      current = io.readText(check);
    } catch (error) {
      return fail(
        `Cannot read ${check}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return current.replace(/\r\n/g, "\n") === report.text
      ? ok("", `${warnings}${check} is up to date.\n`)
      : fail(`${warnings}${check} is out of date.`, EXIT_DRIFT);
  }
  if (output !== undefined) {
    const error = writeOutput(io, output, report.text);
    return error ? fail(`${warnings}${error}`) : ok("", warnings);
  }
  return ok(report.text, warnings);
}
