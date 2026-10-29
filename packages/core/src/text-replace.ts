// Finding and replacing words in the text people read on a diagram: labels,
// names, notes, table and column names, transition triggers and the like.
// Identifiers, references and enumerated values are never touched.

import { type Element, type ElementId, isPlainObject } from "@nodetto/ir";
import type { Editor } from "./editor.ts";

/** Semantic keys whose string values (or string lists) are display text. */
const TEXT_KEYS: ReadonlySet<string> = new Set([
  "label",
  "name",
  "text",
  "title",
  "tableName",
  "trigger",
  "guard",
  "effect",
  "description",
  "stereotype",
  "placeholder",
  "value",
  "options",
  "documentation",
  "comment",
  "note",
  "alias",
  "caption",
]);

export interface TextMatchOptions {
  /** Treat the query as a JavaScript regular expression. */
  readonly regex?: boolean;
  readonly ignoreCase?: boolean;
}

export interface TextField {
  /** Path inside `semantic`, e.g. `label` or `columns[2].name`. */
  readonly path: string;
  readonly value: string;
}

export interface TextReplacement {
  readonly id: ElementId;
  readonly path: string;
  readonly before: string;
  readonly after: string;
}

/** Every display-text string in an element's semantic payload. */
export function textFields(element: Element): readonly TextField[] {
  const fields: TextField[] = [];
  const walk = (value: unknown, path: string, text: boolean): void => {
    if (typeof value === "string") {
      if (text) fields.push({ path, value });
    } else if (Array.isArray(value))
      value.forEach((item, index) => walk(item, `${path}[${index}]`, text));
    else if (isPlainObject(value))
      for (const [key, child] of Object.entries(value))
        walk(child, path ? `${path}.${key}` : key, TEXT_KEYS.has(key));
  };
  walk(element.semantic, "", false);
  return fields;
}

/** A global matcher for the query, or an error message for a bad pattern. */
export function textMatcher(
  query: string,
  options: TextMatchOptions = {},
): RegExp | string {
  if (!query) return "the text to find must not be empty";
  const source = options.regex
    ? query
    : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    return new RegExp(source, options.ignoreCase ? "gi" : "g");
  } catch (cause) {
    return `invalid regular expression: ${cause instanceof Error ? cause.message : String(cause)}`;
  }
}

/** The display-text fields of `element` that contain a match. */
export function findText(
  element: Element,
  matcher: RegExp,
): readonly TextField[] {
  return textFields(element).filter((field) => {
    matcher.lastIndex = 0;
    return matcher.test(field.value);
  });
}

function setPath(value: unknown, path: string, text: string): unknown {
  const [head, ...rest] = path.match(/[^.[\]]+/g) ?? [];
  if (head === undefined) return text;
  const tail = rest.join(".");
  const next = (child: unknown) =>
    rest.length ? setPath(child, tail, text) : text;
  if (Array.isArray(value)) {
    const index = Number(head);
    return value.map((item, at) => (at === index ? next(item) : item));
  }
  if (isPlainObject(value)) return { ...value, [head]: next(value[head]) };
  return value;
}

/**
 * Replace every match in the display text of `ids` and apply the result.
 * A note's text goes through `setText`, so its inline marks stay aligned.
 */
export function replaceText(
  editor: Editor,
  ids: Iterable<ElementId>,
  matcher: RegExp,
  replacement: string,
): readonly TextReplacement[] {
  const changes: TextReplacement[] = [];
  for (const id of ids) {
    const element = editor.store.get(id);
    if (!element) continue;
    let semantic = element.semantic;
    let noteText: string | undefined;
    for (const field of findText(element, matcher)) {
      matcher.lastIndex = 0;
      const after = field.value.replace(matcher, replacement);
      if (after === field.value) continue;
      changes.push({ id, path: field.path, before: field.value, after });
      if (element.type === "text.note" && field.path === "text")
        noteText = after;
      else semantic = setPath(semantic, field.path, after);
    }
    if (semantic !== element.semantic)
      editor.apply([{ type: "updateSemantic", id, semantic }]);
    if (noteText !== undefined) editor.setText(id, noteText);
  }
  return changes;
}
