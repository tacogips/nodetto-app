import { expect, test } from "bun:test";
import { parseDocument } from "./parse.ts";
import { serializeDocumentPreservingText as preserve } from "./preserve-text.ts";
import { serializeDocument } from "./serialize.ts";

const fixture = `${[
  '{"kind":"document","schemaVersion":1,"id":"widgets","title":"Widgets"}',
  '{"kind":"page","id":"page-a","name":"Widgets","pageKind":"state"}',
  '{"kind":"page","id":"page-b","name":"Orders","pageKind":"state"}',
  '{"kind":"element","id":"widget-1","page":"page-a","type":"state.node","index":"a","semantic":{"name":"Idle","kind":"state"}}',
  '{"kind":"element","id":"widget-2","page":"page-a","type":"state.node","index":"b","semantic":{"name":"Running","kind":"state"}}',
].join("\n")}\n`;
const doc = parseDocument(fixture);
const base = serializeDocument(doc);
function edit() {
  return {
    ...doc,
    elements: doc.elements.map((e) =>
      e.id === "widget-2"
        ? {
            ...e,
            semantic: {
              ...(e.semantic as Record<string, unknown>),
              name: "Done",
            },
          }
        : e,
    ),
  };
}
function line(text: string, id: string): string {
  const found = text.split("\n").find((item) => item.includes(`"id":"${id}"`));
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

test("identity preserves noncanonical bytes, blanks, BOM and CRLF", () => {
  expect(preserve(doc, base)).toBe(base);
  const raw = line(base, "widget-1");
  const variant = `\ufeff${base.replace(raw, ` ${raw} `).replaceAll("\n", "\r\n")}\r\n`;
  expect(preserve(doc, variant)).toBe(variant);
});

test("canonical edits, additions, removals, moves and page reorder remain canonical", () => {
  const first = doc.elements.find((e) => e.id === "widget-1");
  const page = doc.pages.find((p) => p.id === "page-a");
  if (!first || !page) throw new Error("fixture missing records");
  const variants = [
    edit(),
    { ...doc, elements: [...doc.elements, { ...first, id: "widget-3" }] },
    { ...doc, elements: doc.elements.filter((e) => e.id !== first.id) },
    {
      ...doc,
      elements: doc.elements.map((e) =>
        e.id === first.id ? { ...e, page: "page-b" } : e,
      ),
    },
    {
      ...doc,
      pages: doc.pages.map((p) =>
        p.id === page.id ? { ...p, order: "z" } : p,
      ),
    },
  ];
  for (const value of variants)
    expect(preserve(value, base)).toBe(serializeDocument(value));
});

test("changed records retain noncanonical neighbors and newline policy", () => {
  const original = line(base, "widget-1");
  const raw = `  ${original}  `;
  const variant = base.replace(original, raw).trimEnd();
  const result = preserve(edit(), variant);
  expect(result).toContain(raw);
  expect(result.endsWith("\n")).toBe(false);
  expect(parseDocument(result)).toEqual(edit());
});

test("foreign ordering keeps surviving records, blanks and inserts after predecessor", () => {
  const lines = base.trimEnd().split("\n");
  const document = lines[0];
  const pageA = lines[1];
  const pageB = lines[2];
  const one = lines[3];
  const two = lines[4];
  if (!document || !pageA || !pageB || !one || !two)
    throw new Error("fixture missing lines");
  const foreign = `${[document, pageB, "", pageA, two, one].join("\n")}\n`;
  const first = doc.elements.find((e) => e.id === "widget-1");
  if (!first) throw new Error("fixture missing element");
  const changed = {
    ...edit(),
    elements: [...edit().elements, { ...first, id: "widget-3" }],
  };
  const result = preserve(changed, foreign);
  expect(result.indexOf(pageB)).toBeLessThan(result.indexOf(pageA));
  expect(result).toContain(`${pageB}\n\n${pageA}`);
  expect(result).toContain(
    `${line(result, "widget-2")}\n${line(result, "widget-3")}`,
  );
  expect(result.indexOf(line(result, "widget-3"))).toBeLessThan(
    result.indexOf(one),
  );
});

test("duplicate unknown records retain their raw text", () => {
  const unknown = '{ "value" : 1, "kind" : "future" }';
  const input = `${base}${unknown}\n${unknown}\n`;
  const value = parseDocument(input);
  const result = preserve({ ...value, title: "Updated" }, input);
  expect(result.split(unknown).length - 1).toBe(2);
});

test("unparseable, unsupported schema and different id fall back; invalid document throws", () => {
  expect(preserve(doc, "not json")).toBe(base);
  expect(
    preserve(doc, base.replace('"schemaVersion":1', '"schemaVersion":2')),
  ).toBe(base);
  expect(preserve(doc, base.replace('"id":"widgets"', '"id":"other"'))).toBe(
    base,
  );
  expect(() => preserve({ ...doc, id: "" }, base)).toThrow();
});
