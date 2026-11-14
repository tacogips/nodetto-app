import { expect, test } from "bun:test";
import { parseCsv, parseTsv, serializeTsv } from "./delimited.ts";
test("TSV round trips quoted fields", () => {
  const g = [
    ["alpha\nbeta", "tab\there"],
    ['say "hi"', "line1\r\nline2"],
  ];
  expect(parseTsv(serializeTsv(g))).toEqual(g);
});
test("TSV CRLF trailing break", () =>
  expect(parseTsv("a\tb\r\nc\td\r\n")).toEqual([
    ["a", "b"],
    ["c", "d"],
  ]));
test("CSV quoted values and BOM", () =>
  expect(parseCsv('\ufeff"a,b","say ""hi""","one\ntwo"\r\n')).toEqual([
    ["a,b", 'say "hi"', "one\ntwo"],
  ]));
test("ragged CSV", () =>
  expect(parseCsv("a,b\nc")).toEqual([["a", "b"], ["c"]]));
test("empty input and single empty field", () => {
  expect(parseTsv("")).toEqual([]);
  expect(parseTsv(serializeTsv([[""]]))).toEqual([[""]]);
});
