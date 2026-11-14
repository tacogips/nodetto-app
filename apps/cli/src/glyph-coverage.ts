import {
  type Document,
  type Element,
  isPlainObject,
  type PageId,
} from "@nodetto/ir";

export interface GlyphRow {
  readonly elementId: string;
  readonly codePoints: readonly number[];
}

function visitStrings(value: unknown, visit: (value: string) => void): void {
  if (typeof value === "string") {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ASCII fast path includes control characters.
    if (/[^\x00-\x7f]/.test(value)) visit(value);
  } else if (Array.isArray(value)) {
    for (const item of value) visitStrings(item, visit);
  } else if (isPlainObject(value)) {
    for (const item of Object.values(value)) visitStrings(item, visit);
  }
}

function eligible(element: Element): boolean {
  return !element.type.startsWith("design.") && element.visual.hidden !== true;
}

export function attributeMissingGlyphs(
  elements: readonly Element[],
  missing: ReadonlySet<number>,
): {
  readonly rows: readonly GlyphRow[];
  readonly unattributed: readonly number[];
} {
  const rows: GlyphRow[] = [];
  const unattributed = new Set(missing);
  for (const element of elements) {
    if (!eligible(element)) continue;
    const found = new Set<number>();
    visitStrings(element.semantic, (value) => {
      for (const character of value) {
        const point = character.codePointAt(0);
        if (point !== undefined && missing.has(point)) {
          found.add(point);
          unattributed.delete(point);
        }
      }
    });
    if (found.size > 0)
      rows.push({
        elementId: element.id,
        codePoints: [...found].sort((a, b) => a - b),
      });
  }
  return { rows, unattributed: [...unattributed].sort((a, b) => a - b) };
}

export function glyphRowsByPage(
  document: Document,
  coverage: (
    text: string,
  ) => { readonly missing: readonly number[] } | undefined,
): ReadonlyMap<PageId, readonly GlyphRow[]> {
  const strings: string[] = [];
  const pages = new Set(document.pages.map((page) => page.id));
  const elements = document.elements.filter(
    (element) => pages.has(element.page) && eligible(element),
  );
  for (const element of elements)
    visitStrings(element.semantic, (value) => strings.push(value));
  const result = new Map<PageId, GlyphRow[]>();
  if (strings.length === 0) return result;
  const missing = coverage(strings.join("\n"))?.missing;
  if (!missing || missing.length === 0) return result;
  const missingSet = new Set(missing);
  for (const element of elements) {
    const { rows } = attributeMissingGlyphs([element], missingSet);
    if (rows.length === 0) continue;
    const pageRows = result.get(element.page) ?? [];
    pageRows.push(...rows);
    result.set(element.page, pageRows);
  }
  return result;
}

export function glyphMissingMessage(codePoints: readonly number[]): string {
  const labels = codePoints
    .slice(0, 16)
    .map((point) => `U+${point.toString(16).toUpperCase().padStart(4, "0")}`);
  if (codePoints.length > 16) labels.push(`and ${codePoints.length - 16} more`);
  return `no export font has ${labels.join(", ")}; add a font with --font-dir`;
}
