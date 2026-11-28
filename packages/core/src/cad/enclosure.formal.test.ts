import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pageAcceptsElementType } from "@nodetto/ir";
import {
  computePcbEnclosureDims,
  computeShellSpec,
  type EnclosureOpenFace,
  type EnclosureShellSpec,
} from "./enclosure.ts";

interface VectorFile {
  readonly cases: readonly {
    readonly fn: string;
    readonly in: Record<string, unknown>;
    readonly out: { readonly ok: unknown };
  }[];
}

const vectors: VectorFile = JSON.parse(
  readFileSync(
    resolve(import.meta.dir, "../../../../formal/vectors/cad-enclosure.json"),
    "utf8",
  ),
);

const NM = 1_000_000;
const nm = (value: number): number => Math.round(value * NM);

function specToNm(spec: EnclosureShellSpec) {
  return {
    outerX0: nm(spec.outerX0),
    outerY0: nm(spec.outerY0),
    outerX1: nm(spec.outerX1),
    outerY1: nm(spec.outerY1),
    outerWidth: nm(spec.outerWidth),
    outerHeight: nm(spec.outerHeight),
    innerX0: nm(spec.innerX0),
    innerY0: nm(spec.innerY0),
    innerX1: nm(spec.innerX1),
    innerY1: nm(spec.innerY1),
    innerWidth: nm(spec.innerWidth),
    innerHeight: nm(spec.innerHeight),
    height: nm(spec.height),
    wallThickness: nm(spec.wallThickness),
    floorThickness: nm(spec.floorThickness),
    cavityDepth: nm(spec.cavityDepth),
    outerRadius: nm(spec.outerRadius),
    innerRadius: nm(spec.innerRadius),
    openFace: spec.openFace,
  };
}

describe("CAD enclosure formal conformance vectors", () => {
  test("all Lean-generated vectors match TypeScript implementations", () => {
    expect(vectors.cases.length).toBeGreaterThanOrEqual(200);
    for (const entry of vectors.cases) {
      if (entry.fn === "pageAccepts") {
        const kind = entry.in.kind as string;
        const type = entry.in.type as string;
        expect<unknown>(pageAcceptsElementType(kind, type)).toBe(entry.out.ok);
      } else if (entry.fn === "computeShellSpec") {
        const res = computeShellSpec({
          x0: (entry.in.x0Nm as number) / NM,
          y0: (entry.in.y0Nm as number) / NM,
          x1: (entry.in.x1Nm as number) / NM,
          y1: (entry.in.y1Nm as number) / NM,
          height: (entry.in.heightNm as number) / NM,
          wallThickness: (entry.in.wallThicknessNm as number) / NM,
          floorThickness: (entry.in.floorThicknessNm as number) / NM,
          cornerRadius: (entry.in.cornerRadiusNm as number) / NM,
          openFace: entry.in.openFace as EnclosureOpenFace,
        });
        expect<unknown>(res ? specToNm(res) : null).toEqual(entry.out.ok);
      } else if (entry.fn === "computePcbEnclosureDims") {
        const res = computePcbEnclosureDims({
          boardMinX: (entry.in.boardMinXNm as number) / NM,
          boardMinY: (entry.in.boardMinYNm as number) / NM,
          boardMaxX: (entry.in.boardMaxXNm as number) / NM,
          boardMaxY: (entry.in.boardMaxYNm as number) / NM,
          boardThickness: (entry.in.boardThicknessNm as number) / NM,
          clearance: (entry.in.clearanceNm as number) / NM,
          wallThickness: (entry.in.wallThicknessNm as number) / NM,
          floorThickness: (entry.in.floorThicknessNm as number) / NM,
          standoffHeight: (entry.in.standoffHeightNm as number) / NM,
          componentHeadroom: (entry.in.componentHeadroomNm as number) / NM,
          cornerRadius: (entry.in.cornerRadiusNm as number) / NM,
        });
        const actual = res
          ? {
              cavityX0: nm(res.cavityX0),
              cavityY0: nm(res.cavityY0),
              cavityX1: nm(res.cavityX1),
              cavityY1: nm(res.cavityY1),
              baseOffsetZ: nm(res.baseOffsetZ),
              shell: specToNm(res.shell),
            }
          : null;
        expect<unknown>(actual).toEqual(entry.out.ok);
      } else {
        throw new Error(`Unexpected vector fn: ${entry.fn}`);
      }
    }
  });
});
