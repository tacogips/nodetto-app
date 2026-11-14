import { describe, expect, test } from "bun:test";
import type { Document } from "./types.ts";
import { validateDocument } from "./validate.ts";
import { validate } from "./registry/test-helpers.ts";

describe("connector positions", () => {
  test("validates finite position bounds and warns when a port is absent", () => {
    for (const value of [-0.1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const issues = validate("edge.generic", {
        from: "a",
        to: "b",
        labelPosition: value,
      });
      expect(
        issues.some(
          (issue) =>
            issue.severity === "error" &&
            issue.path === "semantic.labelPosition",
        ),
      ).toBe(true);
    }
    const issues = validate("edge.generic", {
      from: "a",
      to: "b",
      fromPortPosition: 0.2,
    });
    expect(issues).toContainEqual({
      severity: "warning",
      code: "semantic.portPositionWithoutPort",
      path: "semantic.fromPortPosition",
      message: "port position has no effect without a port",
    });
  });

  test("recognizes positions on all connector registries", () => {
    for (const type of [
      "state.transition",
      "edge.generic",
      "erd.relation",
      "uml.association",
    ]) {
      const document = {
        schemaVersion: 1,
        id: "doc",
        title: "Doc",
        pages: [{ id: "p", name: "Page", kind: "erd" }],
        elements: [
          {
            id: "e",
            page: "p",
            type,
            index: "a0",
            semantic: {
              from: "a",
              to: "b",
              fromPort: "right",
              toPort: "left",
              labelPosition: 0.5,
              fromPortPosition: 0.2,
              toPortPosition: 0.8,
            },
            visual: { x: 0, y: 0 },
          },
        ],
      } as Document;
      expect(
        validateDocument(document, { checkReferences: false }).filter(
          (issue) => issue.code === "semantic.unknownField",
        ),
      ).toEqual([]);
    }
  });
});
