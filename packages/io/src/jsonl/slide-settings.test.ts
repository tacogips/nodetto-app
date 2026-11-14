import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { exportD2 } from "../d2/export.ts";
import { exportDrawio } from "../drawio/export.ts";
import { parseDocument } from "./parse.ts";
import { serializeDocument } from "./serialize.ts";

const fixture = (name: string) =>
  readFileSync(
    new URL(`../__fixtures__/${name}.jsonl`, import.meta.url),
    "utf8",
  );
test("settings and legacy documents round trip byte for byte", () => {
  for (const name of ["slide-settings", "freeform"]) {
    const text = fixture(name);
    expect(serializeDocument(parseDocument(text))).toBe(text);
  }
  expect(fixture("slide-settings")).toContain(
    '"linkId":"linked","animation":{"enter":"slide-in"',
  );
  expect(fixture("slide-settings")).toContain(
    '"slide":{"mode":"fade","durationMs":700,"stagger":false}',
  );
});
test("exporters ignore carriers, including alias collisions", () => {
  const doc = parseDocument(fixture("slide-settings"));
  const without = {
    ...doc,
    elements: doc.elements.filter((e) => e.type !== "presentation.slide"),
  };
  expect(exportDrawio(doc)).toEqual(exportDrawio(without));
  expect(exportD2(doc, "p1")).toEqual(exportD2(without, "p1"));
  const shape = without.elements[0];
  if (!shape) throw new Error("missing shape");
  const collision = {
    ...doc,
    elements: [
      ...without.elements,
      {
        ...doc.elements.find((e) => e.type === "presentation.slide")!,
        id: `${shape.id}!`,
      },
    ],
  };
  expect(exportD2(collision, "p1")).toEqual(exportD2(without, "p1"));
});
