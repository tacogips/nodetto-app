import { Editor } from "@nodetto/core";
import { type Page, resolvePageQuery } from "@nodetto/ir";
import { serializeDocument } from "@nodetto/io";
import {
  type CommandIo,
  type CommandResult,
  fail,
  loadDocument,
  ok,
  parseArgs,
} from "./commands.ts";

export function pagesCopyShapesCommand(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const error = (message: string) => fail(`${message}\nNothing was written.`);
  const parsed = parseArgs(
    args,
    new Set(["--from", "--to", "--format"]),
    new Set(["--dry-run"]),
  );
  if (typeof parsed === "string") return error(parsed);
  const path = parsed.positional[0];
  const fromQuery = parsed.options.get("--from");
  const toQuery = parsed.options.get("--to");
  if (
    parsed.positional.length !== 1 ||
    path === undefined ||
    !fromQuery ||
    !toQuery
  )
    return error("copy-shapes requires one document path and --from and --to.");
  const format = parsed.options.get("--format") ?? "text";
  if (format !== "text" && format !== "json")
    return error("--format must be text or json.");
  const loaded = loadDocument(io, path);
  if (typeof loaded === "string") return error(loaded);
  const pages = [...loaded.document.pages];
  const toResult = resolvePageQuery(pages, toQuery);
  if (!toResult.ok) return error(toResult.message);
  const to = toResult.page;
  const editor = new Editor({ document: loaded.document });
  let from: Page | undefined;
  if (fromQuery === "prev" || fromQuery === "next") {
    const id = editor.adjacentPageId(to.id, fromQuery);
    if (id === null)
      return error(
        `Page "${to.name}" has no ${fromQuery === "prev" ? "previous" : "next"} page.`,
      );
    from = pages.find((page) => page.id === id);
    if (!from) return error("Source page could not be found.");
  } else {
    const result = resolvePageQuery(pages, fromQuery);
    if (!result.ok) return error(result.message);
    from = result.page;
  }
  if (from.id === to.id) return error("--from and --to are the same page.");
  const ids = editor.copyPageElements(from.id, to.id);
  if (ids === null) return error("Unable to copy page elements.");
  const dryRun = parsed.flags.has("--dry-run");
  const written = ids.length > 0 && !dryRun;
  if (written) {
    try {
      io.writeText(path, serializeDocument(editor.getSnapshot()));
    } catch (cause) {
      return error(
        `Cannot write ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }
  if (format === "json")
    return ok(
      `${JSON.stringify({ from: { id: from.id, name: from.name }, to: { id: to.id, name: to.name }, copied: ids, written }, null, 2)}\n`,
      loaded.warnings,
    );
  return ok(
    `Copied ${ids.length} element${ids.length === 1 ? "" : "s"} from "${from.name}" to "${to.name}".${dryRun ? " (dry run, nothing written)" : ""}\n`,
    loaded.warnings,
  );
}
