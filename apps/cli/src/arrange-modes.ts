import {
  Editor,
  applyCommands,
  pageMetrics,
  selectLayeredOrder,
} from "@nodetto/core";
import { planLayeredBpmn } from "@nodetto/core";
import { getElementTypeDefinition, type Element, type Page } from "@nodetto/ir";
import { serializeDocument } from "@nodetto/io";
import { columnFrames, LAYERED_PAGE_KINDS } from "@nodetto/core";
import { planRoute, ROUTE_PAGE_KINDS } from "@nodetto/core";
import {
  type CommandIo,
  type CommandResult,
  EXIT_DRIFT,
  fail,
  loadDocument,
  ok,
  parseArgs,
  selectPage,
  writeOutput,
} from "./commands.ts";
import { resolveId, shortIds } from "./ids.ts";

const OPTIONS = new Set([
  "--mode",
  "--direction",
  "--page",
  "--frames",
  "--ids",
]);
const FLAGS = new Set(["--reset-manual", "--write", "--check"]);

function frameOrder(
  query: string,
  frames: readonly Element[],
): string[] | string {
  const ids = frames.map((frame) => frame.id);
  const short = shortIds(ids);
  const candidates = frames
    .map((frame) => {
      const name = (frame.semantic as { name?: unknown }).name;
      return `${short.get(frame.id) ?? frame.id} ${JSON.stringify(typeof name === "string" ? name : "")} ${frame.id}`;
    })
    .join("\n");
  const result: string[] = [];
  for (const part of query.split(",")) {
    const value = part.trim();
    const exact = frames.filter((frame) => frame.id === value);
    const names = frames.filter(
      (frame) => (frame.semantic as { name?: unknown }).name === value,
    );
    const prefixes =
      value.length >= 6
        ? frames.filter((frame) => frame.id.startsWith(value))
        : [];
    const matches = exact.length ? exact : names.length ? names : prefixes;
    const match = matches.length === 1 ? matches[0] : undefined;
    if (!value || !match || result.includes(match.id))
      return `Invalid or ambiguous column frame "${value}". Column frames:\n${candidates}`;
    result.push(match.id);
  }
  return result;
}

export function arrangeLayeredOrRoute(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const parsed = parseArgs(args, OPTIONS, FLAGS);
  if (typeof parsed === "string") return fail(parsed);
  if (parsed.positional.length !== 1)
    return fail("arrange expects exactly one document path.");
  if (parsed.flags.has("--write") && parsed.flags.has("--check"))
    return fail("--write and --check cannot be combined.");
  const mode = parsed.options.get("--mode");
  if (mode !== "layered" && mode !== "route")
    return fail(`Unsupported mode "${mode ?? ""}". Choose layered or route.`);
  const direction = parsed.options.get("--direction") ?? "LR";
  if (direction !== "LR" && direction !== "TB")
    return fail(`Unsupported direction "${direction}". Choose LR or TB.`);
  if (mode !== "layered" && parsed.options.has("--frames"))
    return fail("--frames requires --mode layered.");
  if (mode !== "route" && parsed.options.has("--ids"))
    return fail("--ids requires --mode route.");
  const path = parsed.positional[0] as string;
  const loaded = loadDocument(io, path);
  if (typeof loaded === "string") return fail(loaded);
  const query = parsed.options.get("--page");
  let page: Page | string;
  if (query !== undefined) page = selectPage(loaded.document, query);
  else if (loaded.document.pages.length === 1)
    page = loaded.document.pages[0] as Page;
  else page = "The document has several pages; choose one with --page.";
  if (typeof page === "string") return fail(page);
  const kinds = mode === "layered" ? LAYERED_PAGE_KINDS : ROUTE_PAGE_KINDS;
  if (
    !kinds.includes(page.kind) &&
    !(mode === "layered" && page.kind === "bpmn")
  )
    return fail(`Mode ${mode} supports page kinds: ${kinds.join(", ")}.`);
  const editor = new Editor({ document: loaded.document });
  const resetManual = parsed.flags.has("--reset-manual");
  const manualSemantics =
    mode === "layered" && !resetManual
      ? editor.store
          .getPageElements(page.id)
          .filter(
            (element) =>
              (element.semantic as Record<string, unknown>).routing ===
              "manual",
          )
          .map((element) => ({ id: element.id, semantic: element.semantic }))
      : [];
  let count = 0;
  if (mode === "layered" && page.kind === "bpmn") {
    if (parsed.options.has("--frames") || direction === "TB")
      return fail(
        "BPMN pools are horizontal; --frames and --direction TB are not supported.",
      );
    const result = planLayeredBpmn(editor.store, page.id, editor.registry);
    if ("error" in result) return fail(result.error);
    for (const commands of [
      result.containerCommands,
      result.settleCommands,
      result.unitCommands,
    ]) {
      count += commands.length;
      if (commands.length) editor.apply(commands, { placed: result.placed });
    }
  } else if (mode === "layered") {
    const requested = parsed.options.get("--frames");
    const order =
      requested === undefined
        ? undefined
        : frameOrder(
            requested,
            columnFrames(editor.store, page.id, editor.registry),
          );
    if (typeof order === "string") return fail(order);
    const result = selectLayeredOrder(
      editor.store,
      page.id,
      editor.registry,
      {
        direction,
        ...(order === undefined ? {} : { frameOrder: order }),
      },
      (draft) => {
        applyCommands(
          draft,
          planRoute(draft, page.id, editor.registry, {
            resetManual: true,
            separation: false,
          }),
        );
        return pageMetrics(draft, page.id, editor.registry);
      },
    );
    if ("error" in result) return fail(result.error);
    count += result.commands.length;
    editor.apply(result.commands, { placed: result.placed });
  }
  for (const original of manualSemantics) {
    const current = editor.store.get(original.id);
    if (
      current &&
      JSON.stringify(current.semantic) !== JSON.stringify(original.semantic)
    )
      editor.apply([
        {
          type: "updateSemantic",
          id: original.id,
          semantic: original.semantic,
        },
      ]);
  }
  let targetIds: string[] | undefined;
  const requestedIds = parsed.options.get("--ids");
  if (requestedIds !== undefined) {
    const ids = editor.store
      .getPageElements(page.id)
      .filter((e) => getElementTypeDefinition(e.type)?.category === "edge")
      .map((e) => e.id);
    targetIds = [];
    for (const part of requestedIds.split(",")) {
      const queryId = part.trim();
      if (!queryId) return fail("--ids requires connector ids.");
      const result = resolveId(queryId, ids);
      if (!result.ok) return fail(result.message);
      if (targetIds.includes(result.id))
        return fail(`Duplicate connector id "${queryId}".`);
      targetIds.push(result.id);
    }
  }
  const labelFields = (semantic: Record<string, unknown>) =>
    JSON.stringify([
      semantic.labelPosition,
      semantic.labelOffsetX,
      semantic.labelOffsetY,
    ]);
  const beforeLabels = new Map(
    editor.store
      .getPageElements(page.id)
      .filter(
        (element) =>
          getElementTypeDefinition(element.type)?.category === "edge",
      )
      .map((element) => [
        element.id,
        labelFields(element.semantic as Record<string, unknown>),
      ]),
  );
  const commands = planRoute(editor.store, page.id, editor.registry, {
    resetManual,
    ...(targetIds === undefined ? {} : { targetIds }),
  });
  count += commands.length;
  editor.apply(commands);
  if (parsed.flags.has("--check")) {
    if (count)
      return {
        exitCode: EXIT_DRIFT,
        stdout: "",
        stderr: `${loaded.warnings}${path}: arranging page "${page.name}" would change ${count} layer(s).\n`,
      };
    return ok("", `${loaded.warnings}${path} is already arranged.\n`);
  }
  const movedLabels = editor.store
    .getPageElements(page.id)
    .filter(
      (element) =>
        beforeLabels.has(element.id) &&
        beforeLabels.get(element.id) !==
          labelFields(element.semantic as Record<string, unknown>),
    )
    .map((element) => element.id)
    .sort();
  const movedReport = movedLabels.length
    ? `Moved ${movedLabels.length} connector label(s): ${movedLabels.join(", ")}\n`
    : "";
  const arranged = serializeDocument(editor.getSnapshot());
  if (parsed.flags.has("--write")) {
    const failure = writeOutput(io, path, arranged);
    if (failure) return fail(`${loaded.warnings}${failure}`);
    return ok(
      "",
      `${loaded.warnings}Arranged page "${page.name}" of ${path}: ${count} layer update(s).\n${movedReport}`,
    );
  }
  return ok(arranged, `${loaded.warnings}${movedReport}`);
}
