// Semantic validation shared by every element family: example payloads,
// payload shape errors and precise issue paths.

import { describe, expect, test } from "bun:test";
import { codes, validate, expectValid } from "./test-helpers.ts";

describe("semantic validation", () => {
  test("accepts the design's example payloads", () => {
    expectValid("design.guide", { axis: "x", position: 320 });
    expectValid("node.generic", { label: "" });
    expectValid("edge.generic", { from: "a", to: "b" });
    expectValid("erd.table", {
      tableName: "users",
      columns: [
        {
          id: "c1",
          name: "id",
          dataType: "uuid",
          pk: true,
          defaultExpression: "gen_random_uuid()",
        },
      ],
      indexes: [
        { id: "i1", name: "users_id_uq", columns: ["c1"], unique: true },
      ],
      checks: [{ id: "ck1", name: "id_present", expression: "id IS NOT NULL" }],
    });
    expectValid("erd.relation", {
      from: { table: "users", columns: ["tenant", "c1"] },
      to: { table: "orders", columns: ["tenant", "c9"] },
      cardinality: "1:*",
      onDelete: "cascade",
      onUpdate: "restrict",
      deferrability: "initially-deferred",
    });
    expectValid("uml.class", {
      name: "Invoice",
      attributes: [],
      methods: [],
    });
    expectValid("uml.association", { from: "a", to: "b", kind: "inherit" });
    expectValid("sequence.participant", {
      name: "API",
      kind: "service",
      order: "a1",
    });
    expectValid("sequence.message", {
      from: "a",
      to: "b",
      order: "a1",
      kind: "sync",
    });
    expectValid("sequence.activation", {
      participant: "a",
      fromOrder: "a1",
      toOrder: "a2",
    });
    expectValid("draw.freehand", { points: [{ x: 0, y: 0 }] });
    expectValid("shape.geo", { geo: "rect" });
    expectValid("text.note", { text: "hi" });
    expectValid("review.comment", {
      target: "shape",
      messages: [
        {
          id: "message-1",
          author: "Ada",
          body: "Increase contrast",
          createdAt: "2026-09-07T00:00:00.000Z",
        },
      ],
    });
    expectValid("design.text-style", {
      name: "Heading",
      value: {
        fontFamily: "Inter, sans-serif",
        fontSize: 32,
        fontWeight: 700,
        fontStyle: "normal",
        lineHeight: 1.2,
        letterSpacing: -0.5,
        textAlign: "start",
        textDecoration: "none",
        verticalAlign: "top",
      },
    });
    expectValid("frame", { name: "Group A" });
    expectValid("group", { memberIds: ["a", "b"] });
    expectValid("group", { memberIds: ["mask", "content"], maskId: "mask" });
    expectValid("group", {
      memberIds: ["mask", "content"],
      maskId: "mask",
      maskMode: "luminance",
    });
    expectValid("group", { memberIds: ["a", "b"], isolate: true });
    expectValid("group", {
      memberIds: ["base", "cutout"],
      booleanOperation: "subtract",
    });
  });

  test("tolerates unknown fields inside a known payload", () => {
    expectValid("shape.geo", { geo: "rect", futureField: { a: 1 } });
  });

  test("rejects a non-object payload", () => {
    expect(codes(validate("shape.geo", "rect"))).toEqual(["type.object"]);
    expect(codes(validate("shape.geo", null))).toEqual(["type.object"]);
  });

  test("rejects a missing required field", () => {
    expect(codes(validate("erd.table", { columns: [] }))).toEqual([
      "field.missing",
    ]);
  });

  test("rejects a value outside an enum", () => {
    expect(codes(validate("shape.geo", { geo: "dodecagon" }))).toEqual([
      "value.enum",
    ]);
    expect(
      codes(
        validate("erd.relation", {
          from: { table: "a" },
          to: { table: "b" },
          cardinality: "many-to-many",
        }),
      ),
    ).toEqual(["value.enum"]);
  });

  test("rejects wrong field types with a precise path", () => {
    const issues = validate("erd.table", {
      tableName: "t",
      columns: [{ id: "c1", name: 7, dataType: "int" }],
    });
    expect(issues[0]?.path).toBe("semantic.columns[0].name");
    expect(issues[0]?.code).toBe("type.string");
  });

  test("validates nested uml method parameters", () => {
    const issues = validate("uml.class", {
      name: "C",
      attributes: [],
      methods: [{ id: "m", name: "f", parameters: [{ type: "int" }] }],
    });
    expect(issues[0]?.path).toBe("semantic.methods[0].parameters[0].name");
  });
});
