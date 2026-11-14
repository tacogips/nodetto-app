import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseDocumentResult } from "./parse.ts";
import { serializeDocument } from "./serialize.ts";
import { acceptElementLine } from "./source-lines.ts";

const fixture = readFileSync(
  new URL(
    "../../../../apps/cli/src/__fixtures__/obstacle-routing-batch.expected.jsonl",
    import.meta.url,
  ),
  "utf8",
);
function parsed(text: string) {
  const result = parseDocumentResult(text, { keepSourceLines: true });
  if (!result.ok || !result.sourceLines)
    throw new Error("fixture parse failed");
  return { document: result.document, sourceLines: result.sourceLines };
}

test("source map uses parsed identities and serializer consumes accepted lines", () => {
  const { document, sourceLines } = parsed(fixture);
  expect(sourceLines.size).toBe(
    document.pages.length + document.elements.length,
  );
  for (const value of [...document.pages, ...document.elements]) {
    const source = sourceLines.get(value);
    expect(source).toBeDefined();
    expect(source?.record["id"]).toBe(value.id);
    expect(fixture.includes(`${source?.line}\n`)).toBe(true);
  }
  const element = document.elements.find((item) => item.type === "state.node");
  if (!element) throw new Error("missing node");
  const original = sourceLines.get(element);
  if (!original) throw new Error("missing source");
  expect(acceptElementLine(original)).toBe(true);
  const record = JSON.parse(original.line) as Record<string, unknown>;
  (record["semantic"] as Record<string, unknown>)["name"] = "Sentinel";
  const line = JSON.stringify(record);
  const overridden = new Map(sourceLines);
  overridden.set(element, { line, record });
  expect(
    serializeDocument(document, { validate: false, sourceLines: overridden }),
  ).toContain(line);
  expect(serializeDocument(document, { sourceLines })).toBe(
    serializeDocument(document),
  );
});

test("noncanonical input normalizes identically and changed identities are not reused", () => {
  const variants = [
    `\ufeff${fixture.replaceAll("\n", "\r\n")}`,
    fixture.replace('"kind":"element"', ' "kind" : "element"'),
    fixture.replace('"Idle"', '"\\u0049dle"'),
    fixture.replace('"x":60', '"x":60.001'),
    fixture.replace('"x":60', '"x":60.0'),
    fixture.replace('"x":60', '"x":-0'),
    fixture.replace(
      '"kind":"element","id":',
      '"kind":"element","kind":"element","id":',
    ),
    fixture.replace('"semantic":{', '"extensions":{},"semantic":{'),
    fixture.replace('"semantic":{', '"2":"two","semantic":{'),
    fixture.replace('"semantic":{', '"__proto__":{},"semantic":{'),
    fixture.replace('"semantic":{', '"unknown":"value","semantic":{'),
    `${fixture}{"kind":"future","value":1}\n`,
  ];
  for (const input of variants) {
    const { document, sourceLines } = parsed(input);
    expect(serializeDocument(document, { sourceLines })).toBe(
      serializeDocument(document),
    );
  }
  const { document, sourceLines } = parsed(fixture);
  const element = document.elements[0];
  const page = document.pages[0];
  if (!element || !page) throw new Error("missing records");
  const changed = {
    ...document,
    pages: [{ ...page, name: "Updated" }, ...document.pages.slice(1)],
    elements: [
      {
        ...element,
        semantic: {
          ...(element.semantic as Record<string, unknown>),
          extra: "updated",
        },
      },
      ...document.elements.slice(1),
    ],
  };
  expect(serializeDocument(changed, { validate: false, sourceLines })).toBe(
    serializeDocument(changed, { validate: false }),
  );
  expect(sourceLines.get(changed.pages[0] as object)).toBeUndefined();
  expect(sourceLines.get(changed.elements[0] as object)).toBeUndefined();
  const neighbor = document.elements.find(
    (item) => item !== element && item.page === element.page,
  );
  if (!neighbor) throw new Error("missing neighbor");
  const neighborLine = sourceLines.get(neighbor)?.line;
  expect(neighborLine).toBeDefined();
  expect(
    serializeDocument(changed, { validate: false, sourceLines }),
  ).toContain(neighborLine as string);
});

test("record-shape variants normalize through the full writer", () => {
  const { document } = parsed(fixture);
  const line = fixture
    .split("\n")
    .find((item) => item.includes('"kind":"element"'));
  if (!line) throw new Error("missing line");
  const record = JSON.parse(line) as Record<string, unknown>;
  const variants: Record<string, unknown>[] = [];
  const absent = { ...record };
  absent["semantic"] = undefined;
  variants.push(absent);
  variants.push(
    { ...record, visual: {} },
    { ...record, visual: { style: {} } },
    { ...record, type: "future.widget" },
  );
  variants.push(Object.assign({ id: record["id"] }, record));
  for (const variant of variants) {
    const input = fixture.replace(line, JSON.stringify(variant));
    const result = parseDocumentResult(input, {
      validate: false,
      keepSourceLines: true,
    });
    if (!result.ok) throw new Error("variant parse failed");
    expect(
      serializeDocument(result.document, {
        validate: false,
        sourceLines: result.sourceLines,
      }),
    ).toBe(serializeDocument(result.document, { validate: false }));
  }
  expect(document.elements.length).toBeGreaterThan(0);
});

test("migration discards old object source lines", () => {
  const result = parseDocumentResult(fixture, {
    keepSourceLines: true,
    targetVersion: 2,
    migrations: [
      {
        from: 1,
        to: 2,
        description: "test",
        migrate: (snapshot) => ({ ...snapshot, schemaVersion: 2 }),
      },
    ],
  });
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.sourceLines?.size).toBe(0);
});

test("reuse matches full serialization for every routing expected fixture", () => {
  for (const suffix of ["", ".multi-page", ".mixed-multi-page"]) {
    const text = readFileSync(
      new URL(
        `../../../../apps/cli/src/__fixtures__/obstacle-routing-batch${suffix}.expected.jsonl`,
        import.meta.url,
      ),
      "utf8",
    );
    const { document, sourceLines } = parsed(text);
    expect(serializeDocument(document, { sourceLines })).toBe(
      serializeDocument(document),
    );
  }
});
