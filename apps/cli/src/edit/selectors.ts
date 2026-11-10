import { endpointReaderFor, frameParents } from "@nodetto/core";
import {
  type Element,
  getElementTypeDefinition,
  isKnownElementType,
  isPlainObject,
  resolvePageQuery,
} from "@nodetto/ir";
import { resolveId, shortIds } from "../ids.ts";
import type { Batch } from "./batch.ts";
import { labelField } from "./label-field.ts";
import { checkFields } from "./operation-fields.ts";
import { OperationError, requireText } from "./operation-input.ts";
import type { MatchReport } from "./types.ts";

function ordered(batch: Batch, page?: string): Element[] {
  return batch.orderedIds(page).flatMap((id) => {
    const element = batch.editor.store.get(id);
    return element ? [element] : [];
  });
}
function textOf(batch: Batch, element: Element): string | undefined {
  const field = labelField(batch.editor, element);
  const value =
    "field" in field && isPlainObject(element.semantic)
      ? element.semantic[field.field]
      : undefined;
  return typeof value === "string" ? value.trim() : undefined;
}
function candidateLines(batch: Batch, elements: readonly Element[]): string[] {
  const ids = shortIds(batch.editor.store.listElements().map((e) => e.id));
  const pages = new Map(
    batch.editor.store.listPages().map((p) => [p.id, p.name]),
  );
  const lines = elements
    .slice(0, 10)
    .map(
      (e) =>
        `  ${ids.get(e.id) ?? e.id} ${e.type} ${JSON.stringify(textOf(batch, e) ?? "")} on page ${JSON.stringify(pages.get(e.page) ?? e.page)}`,
    );
  if (elements.length > 10)
    lines.push(`  ... and ${elements.length - 10} more`);
  return lines;
}
function noName(batch: Batch, name: string, page?: string): string {
  const similar = ordered(batch, page).filter(
    (e) =>
      textOf(batch, e)?.toLowerCase().includes(name.toLowerCase()) ?? false,
  );
  return similar.length
    ? `no element named ${JSON.stringify(name)}; similar:\n${candidateLines(batch, similar).join("\n")}`
    : `no element named ${JSON.stringify(name)}; no similar names`;
}
export function resolveElementReference(
  batch: Batch,
  value: string,
  index: number,
  scopePage?: string,
): Element {
  const exact = batch.editor.store.get(value);
  if (exact) return exact;
  if (value.startsWith("name:")) {
    const name = value.slice(5).trim();
    const matches = ordered(batch, scopePage).filter(
      (e) => textOf(batch, e) === name,
    );
    if (matches.length === 1) return matches[0] as Element;
    if (!matches.length)
      throw new OperationError(index, noName(batch, name, scopePage));
    throw new OperationError(
      index,
      `${JSON.stringify(value)} matches ${matches.length} elements:\n${candidateLines(batch, matches).join("\n")}\nUse an id, or "where" with "page".`,
    );
  }
  const resolved = resolveId(
    value,
    value.startsWith("@") ? [] : batch.orderedIds(scopePage),
    batch.refs,
  );
  if (!resolved.ok) {
    const page = resolvePageQuery(
      batch.editor.store.listPages(),
      value.startsWith("@") ? (batch.refs.get(value.slice(1)) ?? value) : value,
    );
    throw new OperationError(
      index,
      page.ok
        ? `"${value}" is a page, not an element; use rename-page, move-page or delete-page for pages.`
        : resolved.message,
    );
  }
  const element = batch.editor.store.get(resolved.id);
  if (!element) throw new OperationError(index, `No element ${resolved.id}.`);
  return element;
}
export function matchWhere(
  batch: Batch,
  where: unknown,
  index: number,
): Element[] {
  if (!isPlainObject(where) || !Object.keys(where).length)
    throw new OperationError(index, '"where" must be a non-empty object');
  checkFields(where, ["type", "from", "to", "parent", "name", "page"], index);
  const page =
    where["page"] === undefined
      ? undefined
      : batch.page(where["page"], index).id;
  const from =
    where["from"] === undefined
      ? undefined
      : resolveElementReference(
          batch,
          requireText(where["from"], "from", index),
          index,
          page,
        ).id;
  const to =
    where["to"] === undefined
      ? undefined
      : resolveElementReference(
          batch,
          requireText(where["to"], "to", index),
          index,
          page,
        ).id;
  const parent =
    where["parent"] === undefined
      ? undefined
      : resolveElementReference(
          batch,
          requireText(where["parent"], "parent", index),
          index,
          page,
        ).id;
  const type =
    where["type"] === undefined
      ? undefined
      : requireText(where["type"], "type", index);
  const name =
    where["name"] === undefined
      ? undefined
      : requireText(where["name"], "name", index).trim();
  const parents = new Map<string, ReadonlyMap<string, string>>();
  return ordered(batch, page).filter((e) => {
    if (
      (type !== undefined && e.type !== type) ||
      (name !== undefined && textOf(batch, e) !== name)
    )
      return false;
    if (from !== undefined || to !== undefined) {
      const def = isKnownElementType(e.type)
        ? getElementTypeDefinition(e.type)
        : undefined;
      const ends =
        def?.category === "edge" ? endpointReaderFor(e.type)(e.semantic) : null;
      if (
        !ends ||
        (from !== undefined && ends.from !== from) ||
        (to !== undefined && ends.to !== to)
      )
        return false;
    }
    if (parent !== undefined) {
      const semantic = isPlainObject(e.semantic) ? e.semantic : {};
      let actual =
        typeof semantic["parent"] === "string" ? semantic["parent"] : undefined;
      if (actual === undefined) {
        if (!parents.has(e.page)) {
          batch.editor.setCurrentPage(e.page);
          parents.set(
            e.page,
            frameParents(
              batch.editor.store,
              e.page,
              batch.editor.createShapeContext(1),
            ),
          );
        }
        actual = parents.get(e.page)?.get(e.id);
      }
      if (actual === undefined)
        actual = ordered(batch, e.page).find(
          (g) =>
            g.type === "group" &&
            isPlainObject(g.semantic) &&
            Array.isArray(g.semantic["memberIds"]) &&
            g.semantic["memberIds"].includes(e.id),
        )?.id;
      if (actual !== parent) return false;
    }
    return true;
  });
}
export function selectedWhere(
  batch: Batch,
  operation: Readonly<Record<string, unknown>>,
  index: number,
  op: string,
  defaultExpect?: number,
): Element[] {
  if (operation["id"] !== undefined && operation["where"] !== undefined)
    throw new OperationError(index, 'use either "id" or "where"');
  if (operation["where"] === undefined) {
    if (operation["expect"] !== undefined)
      throw new OperationError(index, '"expect" needs "where"');
    return [batch.element(operation["id"], index)];
  }
  const expected =
    operation["expect"] === undefined ? defaultExpect : operation["expect"];
  if (
    expected !== undefined &&
    (typeof expected !== "number" ||
      !Number.isInteger(expected) ||
      expected < 0)
  )
    throw new OperationError(index, '"expect" must be a whole number >= 0');
  const matches = matchWhere(batch, operation["where"], index);
  if (expected !== undefined && matches.length !== expected)
    throw new OperationError(
      index,
      `where matched ${matches.length} element(s), expected ${expected}:\n${candidateLines(batch, matches).join("\n")}`,
    );
  if (expected === undefined && !matches.length) {
    const where = operation["where"];
    const suffix =
      isPlainObject(where) && typeof where["name"] === "string"
        ? `\n${noName(batch, where["name"].trim(), where["page"] === undefined ? undefined : batch.page(where["page"], index).id)}`
        : "";
    throw new OperationError(index, `where matched no elements${suffix}`);
  }
  batch.matches.push({
    operation: index,
    op,
    count: matches.length,
    ids: matches.map((e) => e.id),
  });
  return matches;
}
export function formatMatchLines(matches: readonly MatchReport[]): string[] {
  return matches.map(
    (m) => `operation ${m.operation} (${m.op}): matched ${m.count} element(s)`,
  );
}
