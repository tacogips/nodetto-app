import { Buffer } from "node:buffer";
import { gzipSync } from "node:zlib";
import { generateCadDocument } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";

// Use the same proportion of sketches, lines, circles and extrusions as the
// M16 native fixture and M17 size test. Count only CAD element records, but
// include the document and page lines in the size and timing measurements.
const recordsPerSketch = 20;
const rows = [1_000, 10_000, 20_000].map((records) => {
  const document = generateCadDocument({
    features: records / recordsPerSketch,
    entitiesPerSketch: recordsPerSketch - 2,
  });
  const serializeStart = performance.now();
  const text = serializeDocument(document);
  const serializeMs = performance.now() - serializeStart;
  const parseStart = performance.now();
  const parsed = parseDocument(text);
  const parseValidateMs = performance.now() - parseStart;
  if (parsed.elements.length !== records) {
    throw new Error(
      `Expected ${records} CAD records, parsed ${parsed.elements.length}`,
    );
  }
  const bytes = Buffer.byteLength(text);
  return {
    records,
    bytes,
    bytesPerRecord: Number((bytes / records).toFixed(2)),
    gzipBytes: gzipSync(text).byteLength,
    serializeMs: Number(serializeMs.toFixed(2)),
    parseValidateMs: Number(parseValidateMs.toFixed(2)),
  };
});
console.log(JSON.stringify(rows, null, 2));
