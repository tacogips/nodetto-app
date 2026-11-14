import { pageAtNumber, resolvePageQuery, shortPageId } from "@nodetto/ir";
import {
  type CommandIo,
  fail,
  loadDocument,
  ok,
  parseArgs,
} from "./commands.ts";
import { helpFor } from "./help.ts";

export async function openCommand(io: CommandIo, args: readonly string[]) {
  const parsed = parseArgs(
    args,
    new Set(["--app", "--page", "--page-number"]),
    new Set(),
  );
  if (typeof parsed === "string") return fail(parsed);
  const path = parsed.positional[0];
  if (!path || parsed.positional.length !== 1)
    return fail(`open expects exactly one file path.\n\n${helpFor("open")}`);
  const query = parsed.options.get("--page");
  const number = parsed.options.get("--page-number");
  if (query !== undefined && number !== undefined)
    return fail("Use either --page or --page-number, not both.");
  if (number !== undefined && !/^[1-9][0-9]*$/.test(number))
    return fail("--page-number must be a positive whole number.");
  if (!io.openDocument) return fail("Desktop launching is unavailable.");
  // A page is checked against the file now, so a typo fails here rather than
  // silently opening the first page.
  let page: { readonly id: string; readonly name: string } | undefined;
  if (query !== undefined || number !== undefined) {
    const loaded = loadDocument(io, path);
    if (typeof loaded === "string") return fail(loaded);
    const resolved =
      query !== undefined
        ? resolvePageQuery(loaded.document.pages, query)
        : pageAtNumber(loaded.document.pages, Number(number));
    if (!resolved.ok) return fail(resolved.message);
    page = resolved.page;
  }
  try {
    const app = parsed.options.get("--app");
    if (page) await io.openDocument(path, app, page.id);
    else await io.openDocument(path, app);
    return ok(
      page
        ? `Open requested: ${path}, page ${JSON.stringify(page.name)} (${shortPageId(page.id)})\n`
        : `Open requested: ${path}\n`,
    );
  } catch (cause) {
    return fail(
      `Cannot open ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}
