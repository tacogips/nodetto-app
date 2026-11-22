import {
  checkCadPage,
  collectCadInput,
  compareFractional,
} from "@nodetto/core";
import { CAD_PAGE_KIND, type Element } from "@nodetto/ir";
import {
  type CommandIo,
  type CommandResult,
  EXIT_DRIFT,
  EXIT_OK,
  fail,
  loadDocument,
  parseArgs,
  selectPage,
} from "./commands.ts";
import { helpFor } from "./help.ts";
import { shortIds } from "./ids.ts";

const NO_PAGES = "The document contains no 3D CAD pages.";

export function cadCommand(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const [subcommand, ...rest] = args;
  if (subcommand !== "check")
    return fail(`cad expects the check subcommand.\n\n${helpFor("cad")}`);
  const parsed = parseArgs(rest, new Set(["--page"]), new Set(["--json"]));
  if (typeof parsed === "string") return fail(`${parsed}\n\n${helpFor("cad")}`);
  const path = parsed.positional[0];
  if (path === undefined || parsed.positional.length !== 1)
    return fail(
      `cad check expects exactly one input path.\n\n${helpFor("cad")}`,
    );
  const loaded = loadDocument(io, path);
  if (typeof loaded === "string") return fail(loaded);
  const { document } = loaded;
  let pages = document.pages.filter(({ kind }) => kind === CAD_PAGE_KIND);
  if (!pages.length) return fail(NO_PAGES);
  const query = parsed.options.get("--page");
  if (query !== undefined) {
    const page = selectPage(document, query, pages, NO_PAGES, "3D CAD pages");
    if (typeof page === "string") return fail(page);
    pages = [page];
  }

  const byPage = new Map(pages.map(({ id }) => [id, [] as Element[]]));
  for (const element of document.elements)
    byPage.get(element.page)?.push(element);
  const reports = pages.map(({ id }) => {
    const local = byPage.get(id) ?? [];
    const input = local.some(({ type }) => type === "cad.pcb")
      ? collectCadInput(document, id, 0).elements
      : local;
    const report = checkCadPage(input, id);
    return {
      ...report,
      errors: [...report.errors].sort((a, b) => compareFractional(a.id, b.id)),
    };
  });
  const hasErrors = reports.some(({ errors }) => errors.length > 0);
  const exitCode = hasErrors ? EXIT_DRIFT : EXIT_OK;
  if (parsed.flags.has("--json"))
    return {
      exitCode,
      stdout: `${JSON.stringify(reports, null, 2)}\n`,
      stderr: loaded.warnings,
    };

  const names = new Map(pages.map(({ id, name }) => [id, name]));
  const ids = hasErrors
    ? shortIds(document.elements.map(({ id }) => id))
    : undefined;
  const lines = reports.flatMap(({ pageId, features, entities, errors }) => [
    `${names.get(pageId)}: ${features} features, ${entities} entities, ${errors.length} errors`,
    ...errors.map(({ id, code }) => `${ids?.get(id) ?? id} ${code}`),
  ]);
  return { exitCode, stdout: `${lines.join("\n")}\n`, stderr: loaded.warnings };
}
