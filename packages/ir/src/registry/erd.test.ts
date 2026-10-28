// Semantic validation of ERD tables and relations.

import { describe, expect, test } from "bun:test";
import { hasErrors } from "../issues.ts";
import { codes, validate, expectValid } from "./test-helpers.ts";

describe("semantic validation", () => {
  test("rejects invalid ERD referential actions", () => {
    expect(
      codes(
        validate("erd.relation", {
          from: { table: "a" },
          to: { table: "b" },
          cardinality: "*:1",
          onDelete: "destroy",
          onUpdate: "replace",
          deferrability: "eventually",
        }),
      ),
    ).toEqual(["value.enum", "value.enum", "value.enum"]);
  });

  test("validates composite foreign-key endpoint structure", () => {
    const base = {
      from: { table: "a", columns: ["tenant", "id"] },
      to: { table: "b", columns: ["tenant"] },
      cardinality: "*:1",
    };
    expect(codes(validate("erd.relation", base))).toEqual([
      "erd.foreignKeyArity",
    ]);
    expect(
      codes(
        validate("erd.relation", {
          ...base,
          from: {
            table: "a",
            column: "id",
            columns: ["id", "id"],
          },
          to: { table: "b", columns: [] },
        }),
      ),
    ).toEqual([
      "id.duplicate",
      "erd.endpointColumnConflict",
      "erd.emptyEndpointColumns",
    ]);
  });

  test("rejects duplicate column ids in a table", () => {
    const issues = validate("erd.table", {
      tableName: "t",
      columns: [
        { id: "c1", name: "a", dataType: "int" },
        { id: "c1", name: "b", dataType: "int" },
      ],
    });
    expect(codes(issues)).toEqual(["id.duplicate"]);
    expect(issues[0]?.path).toBe("semantic.columns[1].id");
  });

  test("validates portable integer identity columns", () => {
    const column = {
      id: "id",
      name: "id",
      dataType: "integer",
      pk: true,
      autoIncrement: true,
    };
    expect(
      hasErrors(validate("erd.table", { tableName: "t", columns: [column] })),
    ).toBe(false);
    for (const identityGeneration of ["always", "by-default"])
      expect(
        hasErrors(
          validate("erd.table", {
            tableName: "t",
            columns: [{ ...column, identityGeneration }],
          }),
        ),
      ).toBe(false);
    for (const patch of [
      { dataType: "uuid" },
      { pk: false },
      { nullable: true },
      { defaultExpression: "1" },
      { generatedExpression: "1 + 1" },
      { autoIncrement: "yes" },
      { identityGeneration: "sometimes" },
      { identityGeneration: "always", autoIncrement: false },
    ]) {
      expect(
        hasErrors(
          validate("erd.table", {
            tableName: "t",
            columns: [{ ...column, ...patch }],
          }),
        ),
      ).toBe(true);
    }
    expect(
      hasErrors(
        validate("erd.table", {
          tableName: "t",
          columns: [
            column,
            { id: "b", name: "b", dataType: "integer", pk: true },
          ],
        }),
      ),
    ).toBe(true);
  });

  test("validates database defaults and composite indexes", () => {
    const issues = validate("erd.table", {
      tableName: "t",
      columns: [{ id: "c1", name: "a", dataType: "int", defaultExpression: 7 }],
      indexes: [
        { id: "i1", columns: ["c1", "c1"] },
        { id: "i1", name: 2, columns: "c1", unique: "yes" },
      ],
    });
    expect(issues.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "type.string", path: "semantic.columns[0].defaultExpression" },
      { code: "id.duplicate", path: "semantic.indexes[0].columns[1]" },
      { code: "id.duplicate", path: "semantic.indexes[1].id" },
      { code: "type.string", path: "semantic.indexes[1].name" },
      { code: "type.array", path: "semantic.indexes[1].columns" },
      { code: "type.boolean", path: "semantic.indexes[1].unique" },
    ]);
  });

  test("validates portable generated columns and expression conflicts", () => {
    expectValid("erd.table", {
      tableName: "line_items",
      columns: [
        {
          id: "total",
          name: "total",
          dataType: "decimal",
          generatedExpression: "quantity * unit_price",
        },
      ],
    });
    const issues = validate("erd.table", {
      tableName: "line_items",
      columns: [
        {
          id: "total",
          name: "total",
          dataType: "decimal",
          pk: true,
          defaultExpression: "0",
          generatedExpression: "quantity * unit_price",
        },
        { id: "bad", name: "bad", dataType: "int", generatedExpression: 7 },
      ],
    });
    expect(issues.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "erd.columnExpressionConflict", path: "semantic.columns[0]" },
      { code: "erd.generatedPrimaryKey", path: "semantic.columns[0]" },
      { code: "type.string", path: "semantic.columns[1].generatedExpression" },
    ]);
  });

  test("validates database check constraint fields and ids", () => {
    const issues = validate("erd.table", {
      tableName: "t",
      columns: [],
      checks: [
        { id: "ck1", name: "valid", expression: "score >= 0" },
        { id: "ck1", name: 2, expression: false },
      ],
    });
    expect(issues.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "id.duplicate", path: "semantic.checks[1].id" },
      { code: "type.string", path: "semantic.checks[1].name" },
      { code: "type.string", path: "semantic.checks[1].expression" },
    ]);
  });

  test("validates table and column comments and SQLite table options", () => {
    expectValid("erd.table", {
      tableName: "t",
      comment: "Line 1\nLine 2",
      columns: [{ id: "c1", name: "id", dataType: "int", comment: "" }],
      sqlite: { strict: true, withoutRowid: false },
    });
    const issues = validate("erd.table", {
      tableName: "t",
      comment: 1,
      columns: [{ id: "c1", name: "id", dataType: "int", comment: false }],
      sqlite: { strict: "yes", withoutRowid: 1 },
    });
    expect(issues.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "type.string", path: "semantic.comment" },
      { code: "type.boolean", path: "semantic.sqlite.strict" },
      { code: "type.boolean", path: "semantic.sqlite.withoutRowid" },
      { code: "type.string", path: "semantic.columns[0].comment" },
    ]);
    expect(
      codes(validate("erd.table", { tableName: "t", columns: [], sqlite: [] })),
    ).toEqual(["type.object"]);
  });

  test("rejects an index reference to an unknown table column", () => {
    const issues = validate("erd.table", {
      tableName: "t",
      columns: [{ id: "c1", name: "id", dataType: "int" }],
      indexes: [{ id: "i1", columns: ["missing"] }],
    });
    expect(issues.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "erd.indexColumn", path: "semantic.indexes[0].columns[0]" },
    ]);
  });
});
