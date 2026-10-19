import { comparePageOrder, shortPageId, isPageKind } from "@nodetto/ir";
import {
  type CommandIo,
  type CommandResult,
  fail,
  loadDocument,
  ok,
  parseArgs,
} from "./commands.ts";
import { helpFor } from "./help.ts";

/** List page identities without rendering or traversing diagram contents. */
export function pagesCommand(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const parsed = parseArgs(args, new Set(["--format", "--kind"]), new Set());
  if (typeof parsed === "string")
    return fail(`${parsed}\n\n${helpFor("pages")}`);
  if (parsed.positional.length !== 1)
    return fail(
      `pages expects exactly one document path.\n\n${helpFor("pages")}`,
    );
  const format = parsed.options.get("--format") ?? "text";
  if (format !== "text" && format !== "json")
    return fail("--format must be text or json.");
  const loaded = loadDocument(io, parsed.positional[0] as string);
  if (typeof loaded === "string") return fail(loaded);
  const kind = parsed.options.get("--kind");
  if (kind !== undefined && !isPageKind(kind))
    return fail(`Unknown page kind "${kind}".`);
  const pages = [...loaded.document.pages]
    .sort(comparePageOrder)
    .map((page, index) => ({
      number: index + 1,
      shortId: shortPageId(page.id),
      id: page.id,
      name: page.name,
      kind: page.kind,
    }))
    .filter((page) => kind === undefined || page.kind === kind);
  if (format === "json")
    return ok(`${JSON.stringify(pages, null, 2)}\n`, loaded.warnings);
  const lines = [
    "PAGE\tSHORT ID\tKIND\tNAME\tFULL ID",
    ...pages.map(
      (page) =>
        `${page.number}\t${page.shortId}\t${page.kind}\t${JSON.stringify(page.name)}\t${page.id}`,
    ),
  ];
  return ok(`${lines.join("\n")}\n`, loaded.warnings);
}
