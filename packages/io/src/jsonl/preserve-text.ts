import { type Document, isPlainObject } from "@nodetto/ir";
import { setField } from "./objects.ts";
import { parseDocumentResult } from "./parse.ts";
import { serializeDocument, unknownLine } from "./serialize.ts";

type Entry = { key: string; line: string };

function recordKey(record: Record<string, unknown>): string | undefined {
  const kind = record["kind"];
  if (kind === "document") return "document";
  if (kind === "page" || kind === "element") {
    return typeof record["id"] === "string"
      ? `${kind}:${record["id"]}`
      : undefined;
  }
  if (typeof kind !== "string") return undefined;
  const data: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (key !== "kind") setField(data, key, record[key]);
  }
  return `unknown:${unknownLine({ kind, data })}`;
}

function entries(text: string): Entry[] | undefined {
  const counts = new Map<string, number>();
  const result: Entry[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      return undefined;
    }
    if (!isPlainObject(record)) return undefined;
    const key = recordKey(record);
    if (key === undefined) return undefined;
    const count = counts.get(key) ?? 0;
    if (count > 0 && !key.startsWith("unknown:")) return undefined;
    counts.set(key, count + 1);
    result.push({ key: `${key}\u0000${count}`, line });
  }
  return result;
}

/** Serialize while retaining unchanged JSONL records from the last disk text. */
export function serializeDocumentPreservingText(
  document: Document,
  baseText: string,
): string {
  const canonical = serializeDocument(document);
  const parsed = parseDocumentResult(baseText);
  if (
    !parsed.ok ||
    parsed.document.id !== document.id ||
    parsed.document.schemaVersion !== document.schemaVersion
  )
    return canonical;
  const bom = baseText.startsWith("\uFEFF") ? "\uFEFF" : "";
  const body = bom ? baseText.slice(1) : baseText;
  const raw = entries(body);
  const old = entries(serializeDocument(parsed.document));
  const next = entries(canonical);
  if (!raw || !old || !next) return canonical;
  const docLine = raw.find((entry) => entry.key === "document\u00000");
  if (
    !docLine ||
    (JSON.parse(docLine.line) as Record<string, unknown>)["schemaVersion"] !==
      parsed.document.schemaVersion
  )
    return canonical;
  const oldMap = new Map(old.map((entry) => [entry.key, entry.line]));
  const newMap = new Map(next.map((entry) => [entry.key, entry.line]));
  if (
    old.length === next.length &&
    old.every((entry) => newMap.get(entry.key) === entry.line)
  )
    return baseText;
  const rawMap = new Map(raw.map((entry) => [entry.key, entry.line]));
  const preserved = (entry: Entry): string =>
    oldMap.get(entry.key) === entry.line
      ? (rawMap.get(entry.key) ?? entry.line)
      : entry.line;
  const surviving = raw
    .filter((entry) => newMap.has(entry.key))
    .map((entry) => entry.key);
  const ordered = old
    .filter((entry) => newMap.has(entry.key))
    .map((entry) => entry.key);
  let lines: string[];
  if (
    surviving.length === ordered.length &&
    surviving.every((key, index) => key === ordered[index])
  ) {
    lines = next.map(preserved);
  } else {
    const byKey = new Map(next.map((entry) => [entry.key, entry]));
    const rawEntries = entries(body);
    if (!rawEntries) return canonical;
    let cursor = 0;
    const output: { key?: string; line: string }[] = [];
    const bodyLines = body.split("\n");
    if (baseText.endsWith("\n")) bodyLines.pop();
    for (const line of bodyLines) {
      if (!line.trim()) {
        output.push({ line });
        continue;
      }
      const entry = rawEntries[cursor++];
      if (!entry) return canonical;
      const replacement = byKey.get(entry.key);
      if (replacement)
        output.push({ key: entry.key, line: preserved(replacement) });
    }
    for (const [index, entry] of next.entries()) {
      if (rawMap.has(entry.key)) continue;
      let position = -1;
      for (let i = index - 1; i >= 0; i--) {
        const predecessor = next[i];
        if (!predecessor) continue;
        position = output.findIndex((item) => item.key === predecessor.key);
        if (position >= 0) break;
      }
      if (position < 0)
        position = output.findIndex((item) => item.key === "document\u00000");
      output.splice(position + 1, 0, { key: entry.key, line: entry.line });
    }
    lines = output.map((item) => item.line);
  }
  return bom + lines.join("\n") + (baseText.endsWith("\n") ? "\n" : "");
}
