import { expect, test } from "bun:test";
import type { Document } from "@nodetto/ir";
import { Store } from "../../../core/src/store.ts";
import { parseDocument } from "./parse.ts";
import { serializeDocument } from "./serialize.ts";

const base: Document = {
  schemaVersion: 1,
  id: "doc",
  title: "Test",
  pages: [
    {
      id: "p",
      name: "Page",
      kind: "freeform",
      connectorRouting: { routing: "straight" },
    },
  ],
  elements: [],
};

test("canonical page records preserve absent, true, and false byte-for-byte", () => {
  for (const flag of [undefined, true, false]) {
    const doc = {
      ...base,
      pages: [
        {
          ...base.pages[0]!,
          ...(flag === undefined ? {} : { hiddenInPresentation: flag }),
        },
      ],
    };
    const text = serializeDocument(doc);
    expect(serializeDocument(parseDocument(text))).toBe(text);
    expect(parseDocument(text).pages[0]).toEqual(doc.pages[0]);
    if (flag === true)
      expect(text).toContain(
        '"connectorRouting":{"routing":"straight"},"hiddenInPresentation":true',
      );
    if (flag === undefined) expect(text).not.toContain("hiddenInPresentation");
  }
});

test("store snapshots serialize the page flag", () => {
  const store = new Store({
    ...base,
    pages: [{ ...base.pages[0]!, hiddenInPresentation: true }],
  });
  expect(serializeDocument(store.getSnapshot())).toContain(
    '"hiddenInPresentation":true',
  );
});
