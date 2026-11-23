import { expect, test } from "bun:test";
import type { SolidReport } from "@nodetto/core";
import {
  interferenceExitCode,
  parseInterferenceOptions,
} from "./capture-interference-options.ts";

const parse = (options: Record<string, string> = {}, flags: string[] = []) =>
  parseInterferenceOptions(new Map(Object.entries(options)), new Set(flags));
test("parses interference options and rejects invalid combinations", () => {
  expect(parse()).toEqual({
    interference: { cellMm: 0.25 },
    failOnInterference: false,
  });
  expect(
    parse({ "--interference-cell": "1", "--interference-bodies": " A, B " }),
  ).toEqual({
    interference: { cellMm: 1, bodies: ["A", "B"] },
    failOnInterference: false,
  });
  expect(parse({}, ["--no-interference"])).toEqual({
    interference: null,
    failOnInterference: false,
  });
  for (const value of ["0.005", "11", "abc", "", "Infinity"])
    expect(parse({ "--interference-cell": value })).toHaveProperty("error");
  for (const value of ["", "A,", ",B"])
    expect(parse({ "--interference-bodies": value })).toHaveProperty("error");
  for (const result of [
    parse({ "--interference-cell": "1" }, ["--no-interference"]),
    parse({ "--interference-bodies": "A,B" }, ["--no-interference"]),
    parse({}, ["--no-interference", "--fail-on-interference"]),
  ])
    expect(result).toHaveProperty("error");
});
test("exit code reflects pairs and unchecked candidates only when requested", () => {
  const base: SolidReport = {
    width: 1,
    height: 1,
    bodies: [],
    pairs: [],
    analysis: {
      cell: 1,
      candidates: 0,
      checked: 0,
      unchecked: [],
      uncheckedCount: 0,
      cappedCount: 1,
      budget: 24,
      cappedWithoutHit: [[0, 1]],
    },
  };
  const pair: SolidReport["pairs"][number] = {
    a: 0,
    b: 1,
    volume: 1,
    min: [0, 0, 0],
    max: [1, 1, 1],
    source: "analysis",
    capped: true,
  };
  expect(interferenceExitCode({ ...base, pairs: [pair] }, true)).toBe(1);
  expect(
    interferenceExitCode(
      {
        ...base,
        analysis: {
          cappedCount: 0,
          budget: 24,
          cappedWithoutHit: [],
          cell: 1,
          candidates: 1,
          checked: 0,
          unchecked: [],
          uncheckedCount: 1,
        },
      },
      true,
    ),
  ).toBe(1);
  expect(interferenceExitCode(base, true)).toBe(0);
  expect(interferenceExitCode({ ...base, pairs: [pair] }, false)).toBe(0);
});
