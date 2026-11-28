import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import {
  decodeNmesh,
  encodeNmesh,
  fromInline,
  NmeshError,
  toInline,
} from "./index.ts";

type Mesh = {
  positions: number[];
  triangles: number[];
  groups: [number, number][];
};
type Result = { ok: unknown } | { error: string };
type Vector =
  | { fn: "encodeNmesh"; in: Mesh; out: Result }
  | { fn: "decodeNmesh" | "toInline"; in: { bytes: number[] }; out: Result }
  | { fn: "fromInline"; in: { text: string }; out: Result };

function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function numbers(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.every((n: unknown) => typeof n === "number" && Number.isInteger(n))
  );
}
function mesh(v: unknown): v is Mesh {
  return (
    record(v) &&
    numbers(v.positions) &&
    numbers(v.triangles) &&
    Array.isArray(v.groups) &&
    v.groups.every((g: unknown) => numbers(g) && g.length === 2)
  );
}
function vector(v: unknown): v is Vector {
  if (!record(v) || !record(v.in) || !record(v.out)) return false;
  const out = v.out;
  const validOutput =
    typeof out.error === "string" ||
    ("ok" in out &&
      (v.fn === "decodeNmesh"
        ? mesh(out.ok)
        : v.fn === "toInline"
          ? typeof out.ok === "string"
          : numbers(out.ok)));
  if (!validOutput) return false;
  if (v.fn === "encodeNmesh") return mesh(v.in);
  if (v.fn === "decodeNmesh" || v.fn === "toInline") return numbers(v.in.bytes);
  return v.fn === "fromInline" && typeof v.in.text === "string";
}

const data: unknown = JSON.parse(
  readFileSync(
    new URL("../../../formal/vectors/nmesh.json", import.meta.url),
    "utf8",
  ),
);
if (
  !record(data) ||
  !Array.isArray(data.cases) ||
  data.cases.length === 0 ||
  !data.cases.every(vector)
) {
  throw new Error("Invalid NMESH vectors");
}
const cases: Vector[] = data.cases;
for (const fn of [
  "encodeNmesh",
  "decodeNmesh",
  "toInline",
  "fromInline",
] as const) {
  test(`NMESH ${fn} matches Lean vectors`, () => {
    const selected = cases
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => value.fn === fn);
    expect(selected.length).toBeGreaterThan(0);
    for (const { value, index } of selected) {
      let actual: Result;
      try {
        switch (value.fn) {
          case "encodeNmesh":
            actual = {
              ok: Array.from(
                encodeNmesh({
                  positions: Int32Array.from(value.in.positions),
                  triangles: Uint32Array.from(value.in.triangles),
                  groups: value.in.groups.map(([faceId, count]) => ({
                    faceId,
                    count,
                  })),
                }),
              ),
            };
            break;
          case "decodeNmesh": {
            const result = decodeNmesh(Uint8Array.from(value.in.bytes));
            actual = {
              ok: {
                positions: Array.from(result.positions),
                triangles: Array.from(result.triangles),
                groups: result.groups.map(({ faceId, count }) => [
                  faceId,
                  count,
                ]),
              },
            };
            break;
          }
          case "toInline":
            actual = { ok: toInline(Uint8Array.from(value.in.bytes)) };
            break;
          case "fromInline":
            actual = { ok: Array.from(fromInline(value.in.text)) };
            break;
        }
      } catch (error) {
        if (!(error instanceof NmeshError)) throw error;
        actual = { error: error.code };
      }
      expect(actual, `vector ${index} (${fn})`).toEqual(value.out);
    }
  });
}
