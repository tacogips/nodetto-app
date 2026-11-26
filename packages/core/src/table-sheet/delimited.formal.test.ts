import { expect, test } from "bun:test";
import { parseTsv, serializeTsv } from "./delimited.ts";

type Grid = string[][];
type Vector =
  | { fn: "parseTsv"; in: { text: string }; out: { ok: Grid } }
  | { fn: "serializeTsv"; in: { grid: Grid }; out: { ok: string } }
  | { fn: "roundTrip"; in: { grid: Grid }; out: { ok: Grid } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGrid(value: unknown): value is Grid {
  return (
    Array.isArray(value) &&
    value.every(
      (row: unknown) =>
        Array.isArray(row) &&
        row.every((field: unknown) => typeof field === "string"),
    )
  );
}

function isVector(value: unknown): value is Vector {
  if (!isRecord(value) || !isRecord(value.in) || !isRecord(value.out))
    return false;
  if (value.fn === "parseTsv")
    return typeof value.in.text === "string" && isGrid(value.out.ok);
  if (value.fn === "serializeTsv")
    return isGrid(value.in.grid) && typeof value.out.ok === "string";
  return (
    value.fn === "roundTrip" && isGrid(value.in.grid) && isGrid(value.out.ok)
  );
}

test("TypeScript TSV matches Lean vectors", async () => {
  const data: unknown = await Bun.file(
    new URL("../../../../formal/vectors/tsv.json", import.meta.url),
  ).json();
  if (
    !isRecord(data) ||
    !Array.isArray(data.cases) ||
    data.cases.length === 0 ||
    !data.cases.every(isVector)
  ) {
    throw new Error("Invalid TSV vectors");
  }
  for (const vector of data.cases as Vector[]) {
    switch (vector.fn) {
      case "parseTsv":
        expect(parseTsv(vector.in.text)).toEqual(vector.out.ok);
        break;
      case "serializeTsv":
        expect(serializeTsv(vector.in.grid)).toEqual(vector.out.ok);
        break;
      case "roundTrip":
        expect(parseTsv(serializeTsv(vector.in.grid))).toEqual(vector.out.ok);
        break;
    }
  }
});
