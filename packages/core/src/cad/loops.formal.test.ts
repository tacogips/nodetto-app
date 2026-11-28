import { expect, test } from "bun:test";
import { overlappingPairs } from "./loops";

type Box = [number, number, number, number];
type Pair = [number, number];
type Vector = {
  fn: "overlappingPairs";
  in: { boxes: Box[] };
  out: { ok: { tree: boolean; visits: Pair[] } };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTuple(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item: unknown) => Number.isSafeInteger(item))
  );
}

function isVector(value: unknown): value is Vector {
  if (!isRecord(value) || value.fn !== "overlappingPairs") return false;
  const input = value.in;
  const output = value.out;
  if (!isRecord(input) || !isRecord(output) || !isRecord(output.ok))
    return false;
  return (
    Array.isArray(input.boxes) &&
    input.boxes.every((box: unknown) => isTuple(box, 4)) &&
    typeof output.ok.tree === "boolean" &&
    Array.isArray(output.ok.visits) &&
    output.ok.visits.every((pair: unknown) => isTuple(pair, 2))
  );
}

test("overlap search matches Lean vectors", async () => {
  const data: unknown = await Bun.file(
    new URL("../../../../formal/vectors/overlap.json", import.meta.url),
  ).json();
  if (
    !isRecord(data) ||
    !Array.isArray(data.cases) ||
    !data.cases.every(isVector)
  ) {
    throw new Error("Invalid overlap vectors");
  }
  expect(data.cases.length).toBeGreaterThan(0);
  for (const vector of data.cases) {
    const boxes: Parameters<typeof overlappingPairs>[0] = vector.in.boxes.map(
      ([minX, minY, maxX, maxY]) => ({ minX, minY, maxX, maxY }),
    );
    const visits: Pair[] = [];
    let crowdedCalls = 0;
    overlappingPairs(
      boxes,
      (i, j) => visits.push([i, j]),
      () => {},
      undefined,
      () => {
        crowdedCalls += 1;
        return true;
      },
    );
    expect(crowdedCalls > 0).toBe(vector.out.ok.tree);
    expect(visits).toEqual(vector.out.ok.visits);
  }
});
