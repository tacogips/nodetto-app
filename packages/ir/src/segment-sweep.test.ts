import { describe, expect, test } from "bun:test";
import {
  type AxisQuery,
  type AxisSegment,
  sweepAxisContacts,
} from "./index.ts";

describe("sweepAxisContacts", () => {
  test("reports inclusive row and column contacts, overlaps and gaps", () => {
    const segments: AxisSegment[] = [
      { id: 1, line: 2, from: 0, to: 10 },
      { id: 2, line: 2, from: 5, to: 15 },
      { id: 3, line: 2, from: 20, to: 25 },
    ];
    const queries: AxisQuery[] = [
      { id: 1, line: 2, at: 0 },
      { id: 2, line: 2, at: 10 },
      { id: 3, line: 2, at: 18 },
      { id: 4, line: 2, at: 25 },
      { id: 5, line: 3, at: 5 },
    ];
    const contacts: string[] = [];
    sweepAxisContacts(segments, queries, (s, q) => contacts.push(`${s}:${q}`));
    expect(contacts.sort()).toEqual(["1:1", "1:2", "2:2", "3:4"]);
    const column: string[] = [];
    sweepAxisContacts(
      [{ id: 8, line: 7, from: -4, to: 3 }],
      [{ id: 9, line: 7, at: -4 }],
      (s, q) => column.push(`${s}:${q}`),
    );
    expect(column).toEqual(["8:9"]);
  });

  test("bounds work on a crowded row of disjoint segments", () => {
    const n = 1000;
    const segments = Array.from({ length: n }, (_, i) => ({
      id: i,
      line: 0,
      from: 4 * i,
      to: 4 * i + 2,
    }));
    const queries = Array.from({ length: n }, (_, i) => ({
      id: i,
      line: 0,
      at: 4 * i + 1,
    }));
    const stats = { sweepWork: 0 };
    let contacts = 0;
    sweepAxisContacts(
      segments,
      queries,
      (s, q) => {
        expect(s).toBe(q);
        contacts++;
      },
      stats,
    );
    expect(contacts).toBe(n);
    expect(stats.sweepWork).toBeLessThanOrEqual(4 * n);
  });

  test("bounds work for sparse grid queries on both axes", () => {
    const segments = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      line: i * 10,
      from: 0,
      to: 490,
    }));
    const queries = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      line: (i % 50) * 10,
      at: (i % 50) * 10,
    }));
    for (let axis = 0; axis < 2; axis++) {
      const stats = { sweepWork: 0 };
      let contacts = 0;
      sweepAxisContacts(
        segments,
        queries,
        () => {
          contacts++;
        },
        stats,
      );
      expect(contacts).toBe(100);
      expect(stats.sweepWork).toBeLessThanOrEqual(
        2 * segments.length + queries.length + contacts,
      );
    }
  });
});
