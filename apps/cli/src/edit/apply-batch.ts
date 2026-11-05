import {
  type ArrangeMode,
  CommandError,
  Editor,
  planArrangement,
} from "@nodetto/core";
import { parseDocumentResult, serializeDocument } from "@nodetto/io";
import {
  type Element,
  validateDocument,
  type ValidationIssue,
} from "@nodetto/ir";
import { formatIssue } from "../commands.ts";
import { Batch } from "./batch.ts";
import { type JsonObject, OperationError } from "./operation-input.ts";
import type { BatchResult, EditWarning, PageChangeCounts } from "./types.ts";

export function issueLine(
  issue: Pick<ValidationIssue, "path" | "message">,
): string {
  return `${issue.path ? `${issue.path}: ` : ""}${issue.message}`;
}

export function unknownFieldKey(
  path: string,
  elements: readonly Element[],
): { element: Element; path: string; key: string } | undefined {
  const match = /^elements\[(\d+)\]\.(.+)$/.exec(path);
  const element = match && elements[Number(match[1])];
  return element && match
    ? {
        element,
        path: match[2] as string,
        key: JSON.stringify([element.id, match[2]]),
      }
    : undefined;
}

export function countPageChanges(
  before: ReadonlyMap<string, Element>,
  after: ReadonlyMap<string, Element>,
): PageChangeCounts {
  const counts = new Map<
    string,
    { added: number; updated: number; removed: number }
  >();
  const bump = (page: string, field: "added" | "updated" | "removed") => {
    const entry = counts.get(page) ?? { added: 0, updated: 0, removed: 0 };
    entry[field] += 1;
    counts.set(page, entry);
  };
  for (const [id, element] of after) {
    const previous = before.get(id);
    if (!previous) bump(element.page, "added");
    else if (JSON.stringify(previous) !== JSON.stringify(element))
      bump(element.page, "updated");
  }
  for (const [id, element] of before)
    if (!after.has(id)) bump(element.page, "removed");
  return counts;
}

/** Apply the batch to one version of the document text. */
export function applyBatch(
  documentText: string,
  operations: readonly JsonObject[],
  arrange: boolean,
): BatchResult {
  const parsed = parseDocumentResult(documentText);
  if (!parsed.ok)
    throw new Error(
      `The document is not a valid nodetto document:\n${parsed.issues
        .filter((issue) => issue.severity === "error")
        .map(formatIssue)
        .join("\n")}`,
    );
  const before = new Map(
    parsed.document.elements.map((element) => [element.id, element]),
  );
  const editor = new Editor({ document: parsed.document });
  const batch = new Batch(editor);
  const lastTouch = new Map<string, number>();
  // The operation after which each unknown field (element id + path) first
  // appeared, so a later edit of the same element does not take the blame.
  const introducedBy = new Map<string, number>();
  const unknownFields = (element: Element): string[] => {
    const page = editor.store.getPage(element.page);
    if (!page) return [];
    return validateDocument({
      ...parsed.document,
      pages: [page],
      elements: [element],
    })
      .filter((issue) => issue.code === "semantic.unknownField")
      .map((issue) =>
        JSON.stringify([
          element.id,
          issue.path.replace(/^elements\[0\]\./, ""),
        ]),
      );
  };
  const records = new Map(
    editor.store.listElements().map((element) => [element.id, element]),
  );
  const changedIds = new Set<string>();
  const unsubscribe = editor.store.subscribe((diff) => {
    for (const id of diff.added) changedIds.add(id);
    for (const id of diff.updated) changedIds.add(id);
    for (const id of diff.removed) changedIds.add(id);
  });
  try {
    operations.forEach((operation, index) => {
      try {
        batch.apply(operation, index);
        for (const id of changedIds) {
          const element = editor.store.get(id);
          if (!element) {
            records.delete(id);
            continue;
          }
          if (records.get(id) !== element) {
            lastTouch.set(id, index);
            if (records.get(id)?.semantic !== element.semantic)
              for (const key of unknownFields(element))
                if (!introducedBy.has(key)) introducedBy.set(key, index);
          }
          records.set(id, element);
        }
        changedIds.clear();
      } catch (cause) {
        if (cause instanceof OperationError) throw cause;
        if (cause instanceof CommandError) {
          const details = cause.issues
            .filter((issue) => issue.severity === "error")
            .map(issueLine);
          throw new OperationError(
            index,
            details.length
              ? `invalid element:\n  ${details.join("\n  ")}\nRun "nodetto-cli types <type>" for the expected fields.`
              : cause.message,
          );
        }
        throw new OperationError(
          index,
          cause instanceof Error ? cause.message : String(cause),
        );
      }
    });
  } finally {
    unsubscribe();
    batch.dispose();
  }
  if (arrange)
    for (const pageId of batch.touchedPages) {
      if (!editor.store.getPage(pageId)) continue;
      const { commands, placed } = planArrangement(
        editor.store,
        pageId,
        editor.createShapeContext(1),
        { mode: "tidy" as ArrangeMode },
      );
      if (commands.length) editor.apply(commands, { placed });
    }
  const snapshot = editor.getSnapshot();
  const validation = validateDocument(snapshot);
  const issues = validation.filter((issue) => issue.severity === "error");
  if (issues.length)
    throw new Error(
      `The result is not a valid document:\n${issues
        .map((issue) => `  ${issueLine(issue)}`)
        .join("\n")}`,
    );
  const baseline = new Set(
    parsed.issues
      .filter((issue) => issue.code === "semantic.unknownField")
      .map(
        (issue) => unknownFieldKey(issue.path, parsed.document.elements)?.key,
      ),
  );
  const warnings: EditWarning[] = [];
  for (const issue of validation) {
    if (issue.code !== "semantic.unknownField") continue;
    const item = unknownFieldKey(issue.path, snapshot.elements);
    if (!item || baseline.has(item.key)) continue;
    const operation =
      introducedBy.get(item.key) ?? lastTouch.get(item.element.id);
    if (operation === undefined) continue;
    warnings.push({
      operation,
      op: String(operations[operation]?.op),
      element: item.element.id,
      type: item.element.type,
      path: item.path,
      code: issue.code,
      message: issue.message,
    });
  }
  warnings.sort(
    (a, b) => a.operation - b.operation || a.path.localeCompare(b.path),
  );
  const after = new Map(
    snapshot.elements.map((element) => [element.id, element]),
  );
  const counts = countPageChanges(before, after);
  return {
    text: serializeDocument(snapshot),
    created: batch.created,
    replaced: batch.replaced,
    counts,
    operations: operations.length,
    warnings,
  };
}
