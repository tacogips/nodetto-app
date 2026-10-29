// Semantic validation of text, freehand, vector path, review comment and
// typography payloads.

import { describe, expect, test } from "bun:test";
import { hasErrors } from "../issues.ts";
import { codes, validate, expectValid } from "./test-helpers.ts";

describe("semantic validation", () => {
  test("rejects a text mark reaching past the end of the text", () => {
    expect(
      codes(
        validate("text.note", {
          text: "abc",
          marks: [{ start: 0, end: 9, kind: "bold" }],
        }),
      ),
    ).toEqual(["range.overflow"]);
  });

  test("rejects an inverted text mark range", () => {
    expect(
      codes(
        validate("text.note", {
          text: "abcdef",
          marks: [{ start: 4, end: 1, kind: "bold" }],
        }),
      ),
    ).toEqual(["range.inverted"]);
  });

  test("rejects empty marks and invalid link destinations", () => {
    expect(
      validate("text.note", {
        text: "underlined",
        marks: [{ start: 0, end: 10, kind: "underline" }],
      }),
    ).toEqual([]);
    expect(
      codes(
        validate("text.note", {
          text: "abc",
          marks: [
            { start: 1, end: 1, kind: "bold" },
            { start: 0, end: 1, kind: "link" },
            { start: 1, end: 2, kind: "italic", href: "https://example.com" },
          ],
        }),
      ),
    ).toEqual(["range.empty", "field.missing", "field.unexpected"]);
  });

  test("rejects non-finite freehand coordinates", () => {
    expect(
      hasErrors(
        validate("draw.freehand", {
          points: [{ x: Number.NaN, y: 0 }],
        }),
      ),
    ).toBe(true);
  });

  test("validates review thread messages", () => {
    expect(codes(validate("review.comment", { messages: [] }))).toEqual([
      "comment.empty",
    ]);
    expect(
      codes(
        validate("review.comment", {
          messages: [
            { id: "m", author: "Ada", body: "One", createdAt: "bad" },
            {
              id: "m",
              author: "Grace",
              body: "Two",
              createdAt: "2026-09-07T00:00:00.000Z",
            },
          ],
        }),
      ),
    ).toEqual(["comment.timestamp", "comment.messageDuplicate"]);
  });

  test("validates complete reusable typography", () => {
    const value = {
      fontFamily: "Inter",
      fontSize: 0,
      fontWeight: 1200,
      fontStyle: "oblique",
      lineHeight: 0,
      letterSpacing: 0,
      textAlign: "justify",
      textDecoration: "blink",
      verticalAlign: "baseline",
    };
    expect(
      codes(validate("design.text-style", { name: "Bad", value })),
    ).toEqual([
      "value.min",
      "value.max",
      "value.enum",
      "value.min",
      "value.enum",
      "value.enum",
      "value.enum",
    ]);
  });

  test("validates open and closed contour contracts", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 30 },
      { x: 50, y: 80 },
    ];
    const path = (contour: object) => ({
      fillRule: "nonzero",
      contours: [contour],
    });
    expectValid(
      "draw.path",
      path({ points: points.slice(0, 2), closed: false }),
    );
    expect(
      validate(
        "draw.path",
        path({ points: points.slice(0, 1), closed: false }),
      ),
    ).toEqual([
      {
        severity: "error",
        code: "path.points",
        path: "semantic.contours[0].points",
        message: "an open contour requires at least two points",
      },
    ]);
    expect(validate("draw.path", path({ points: points.slice(0, 2) }))).toEqual(
      [
        {
          severity: "error",
          code: "path.points",
          path: "semantic.contours[0].points",
          message: "a closed contour requires at least three points",
        },
      ],
    );
    expectValid("draw.path", path({ points, closed: true }));
    expect(validate("draw.path", path({ points, closed: "no" }))).toEqual([
      {
        severity: "error",
        code: "type.boolean",
        path: "semantic.contours[0].closed",
        message: "expected a boolean",
      },
    ]);
    expectValid("shape.geo", { geo: "actor" });
  });

  test("validates editable compound path contours and controls", () => {
    expectValid("draw.path", {
      name: "Cutout",
      fillRule: "evenodd",
      contours: [
        {
          points: [
            { x: 0, y: 0, controlOut: { x: 25, y: 0 } },
            { x: 100, y: 0 },
            { x: 50, y: 100, controlIn: { x: 75, y: 100 } },
          ],
        },
      ],
    });
    expect(
      codes(
        validate("draw.path", {
          fillRule: "invalid",
          contours: [
            {
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          ],
        }),
      ),
    ).toEqual(["value.enum", "path.points"]);
    expect(
      codes(validate("draw.path", { fillRule: "nonzero", contours: [] })),
    ).toEqual(["path.contours"]);
  });
});
