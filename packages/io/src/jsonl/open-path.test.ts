import { expect, test } from "bun:test";
import { hasErrors } from "@nodetto/ir";
import { parseDocument, parseDocumentResult } from "./parse.ts";
import { serializeDocument } from "./serialize.ts";

for (const contour of [
  '{"points":[{"x":0,"y":0},{"x":80,"y":30}],"closed":false}',
  '{"points":[{"x":0,"y":0},{"x":80,"y":30},{"x":40,"y":70}]}',
]) {
  test(`path contour round-trips: ${contour}`, () => {
    const text = [
      '{"kind":"document","schemaVersion":1,"id":"01JTEST0000000000000000000","title":"Lines"}',
      '{"kind":"page","id":"p1","name":"Sketch","pageKind":"freeform"}',
      `{"kind":"element","id":"line","page":"p1","type":"draw.path","index":"a0","semantic":{"contours":[${contour}],"fillRule":"nonzero"}}`,
      "",
    ].join("\n");
    const result = parseDocumentResult(text);
    expect(result.ok).toBe(true);
    expect(hasErrors(result.issues)).toBe(false);
    expect(serializeDocument(parseDocument(text))).toBe(text);
  });
}
