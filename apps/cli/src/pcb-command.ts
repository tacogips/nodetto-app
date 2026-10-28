import {
  encodePcbBoardZip,
  exportPcbBoard,
  pcbDocumentFromPlan,
} from "@nodetto/core";
import { importKicadPcb, serializeDocument } from "@nodetto/io";
import { resolvePageQuery, type Document, type Page } from "@nodetto/ir";
import {
  EXIT_ERROR,
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

function baseName(path: string): string {
  const slash = path.lastIndexOf("/");
  const backslash = path.lastIndexOf("\\");
  return path.slice(Math.max(slash, backslash) + 1);
}

function diagnosticsText(
  fileName: string,
  diagnostics: ReturnType<typeof importKicadPcb>["diagnostics"],
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

function importCommand(io: CommandIo, args: readonly string[]): CommandResult {
  const parsed = parseArgs(args, new Set(["--output"]), new Set(["--strict"]));
  if (typeof parsed === "string") return fail(`${parsed}\n\n${helpFor("pcb")}`);
  if (parsed.positional.length !== 1)
    return fail(
      `pcb import expects one .kicad_pcb file path.\n\n${helpFor("pcb")}`,
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
  const fileName = baseName(path);
  const imported = importKicadPcb(source, { fileName });
  const diagnostics = diagnosticsText(fileName, imported.diagnostics);
  const errors = imported.diagnostics.filter(
    (item) => item.severity === "error",
  );
  if (errors.length || !imported.plan)
    return { exitCode: EXIT_ERROR, stdout: "", stderr: diagnostics };
  const warnings = imported.diagnostics.filter(
    (item) => item.severity === "warning",
  );
  if (parsed.flags.has("--strict") && warnings.length)
    return {
      exitCode: EXIT_WARNINGS,
      stdout: "",
      stderr: `${diagnostics}${warnings.length} KiCad import warning(s) with --strict.\n`,
    };
  const plan = imported.plan;
  const document = pcbDocumentFromPlan(plan, { pageName: plan.title });
  const page = document.pages[0] as Page;
  const exported = exportPcbBoard(document, page.id);
  const summary =
    typeof exported === "string"
      ? `Board with no outline: ${plan.footprints.length} footprints, ${plan.footprints.reduce((count, footprint) => count + footprint.pads.length, 0)} pads, ${plan.tracks.length} tracks, ${plan.vias.length} vias, ${plan.zones.length} zones, ${plan.board.nets.length} nets.`
      : `Board ${exported.width.toFixed(2)} x ${exported.height.toFixed(2)} mm: ${plan.footprints.length} footprints, ${plan.footprints.reduce((count, footprint) => count + footprint.pads.length, 0)} pads, ${plan.tracks.length} tracks, ${plan.vias.length} vias, ${plan.zones.length} zones, ${plan.board.nets.length} nets.`;
  const jsonl = serializeDocument(document);
  const outputPath = parsed.options.get("--output");
  if (outputPath !== undefined) {
    const failure = writeOutput(io, outputPath, jsonl);
    if (failure) return fail(`${diagnostics}${failure}`);
    return ok(
      "",
      `${diagnostics}${summary}\nWrote PCB document to ${outputPath}.\n`,
    );
  }
  return ok(jsonl, `${diagnostics}${summary}\n`);
}

function selectPcbPage(
  document: Document,
  query: string | undefined,
): Page | string {
  const pages = document.pages.filter((page) => page.kind === "pcb");
  if (query !== undefined) {
    const resolved = resolvePageQuery(pages, query);
    return resolved.ok ? resolved.page : resolved.message;
  }
  const [only, ...others] = pages;
  if (!only) return "The document contains no PCB pages.";
  if (!others.length) return only;
  return `The document has ${pages.length} PCB pages; choose one with --page:\n${pages
    .map((page) => `  ${page.name} (full id: ${page.id})`)
    .join("\n")}`;
}

function gerberCommand(io: CommandIo, args: readonly string[]): CommandResult {
  const parsed = parseArgs(
    args,
    new Set(["--page", "--output"]),
    new Set(["--strict"]),
  );
  if (typeof parsed === "string") return fail(`${parsed}\n\n${helpFor("pcb")}`);
  if (parsed.positional.length !== 1)
    return fail(
      `pcb gerber expects exactly one document path.\n\n${helpFor("pcb")}`,
    );
  const outputPath = parsed.options.get("--output");
  if (outputPath === undefined)
    return fail(
      `pcb gerber writes a ZIP archive and requires --output <file.zip>.\n\n${helpFor("pcb")}`,
    );
  if (!io.writeBytes) return fail("This host cannot write binary files.");
  const [path = ""] = parsed.positional;
  const loaded = loadDocument(io, path);
  if (typeof loaded === "string") return fail(loaded);
  const selected = selectPcbPage(loaded.document, parsed.options.get("--page"));
  if (typeof selected === "string") return fail(selected);
  const name = baseName(outputPath);
  const boardName = name.toLowerCase().endsWith(".zip")
    ? name.slice(0, -4)
    : name;
  const exported = exportPcbBoard(loaded.document, selected.id, {
    name: boardName,
  });
  if (typeof exported === "string") return fail(exported);
  const warnings = exported.warnings
    .map((warning) => `warning: ${warning}\n`)
    .join("");
  if (parsed.flags.has("--strict") && exported.warnings.length)
    return {
      exitCode: EXIT_WARNINGS,
      stdout: "",
      stderr: `${warnings}${exported.warnings.length} PCB export warning(s) with --strict.\n`,
    };
  try {
    io.writeBytes(outputPath, encodePcbBoardZip(exported));
  } catch (cause) {
    return fail(
      `${warnings}Cannot write ${outputPath}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
  const notes = exported.notes.map((note) => `${note}\n`).join("");
  return ok(
    "",
    `${warnings}${notes}Wrote Gerber and drill files to ${outputPath}.\n`,
  );
}

export function pcbCommand(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const [subcommand, ...rest] = args;
  if (subcommand === "import") return importCommand(io, rest);
  if (subcommand === "gerber") return gerberCommand(io, rest);
  return fail(
    `pcb expects the import or gerber subcommand.\n\n${helpFor("pcb")}`,
  );
}
