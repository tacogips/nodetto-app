import { expect, test } from "bun:test";
import { parseErdDefinition, formatErdDefinition } from "./erd-definition.ts";

test("requested shorthand accepts trailing comma and parameterized types", () => {
  const result = parseErdDefinition(
    "ID autoincremente PK,\n NAME varchar(256) not NULL,",
    "mysql",
  );
  expect(result.error).toBeUndefined();
  expect(result.columns).toEqual([
    {
      name: "ID",
      dataType: "integer",
      pk: true,
      nullable: false,
      autoIncrement: true,
    },
    { name: "NAME", dataType: "varchar(256)", pk: false, nullable: false },
  ]);
});

test("all dialects round-trip portable definitions, quoted commas and defaults", () => {
  for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
    const columns = [
      {
        id: "id",
        name: "id",
        dataType: "integer",
        pk: true,
        nullable: false,
        autoIncrement: true,
      },
      {
        id: "n",
        name: 'display,"name',
        dataType: "varchar(256)",
        pk: false,
        nullable: true,
        defaultExpression: "'a,b''c'",
      },
      {
        id: "d",
        name: "total",
        dataType: "decimal(12,2)",
        pk: false,
        nullable: false,
      },
    ];
    const result = parseErdDefinition(
      formatErdDefinition(columns, dialect),
      dialect,
    );
    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(
      columns.map(({ id: _id, ...column }) => column),
    );
  }
});

test("PostgreSQL serial is normalized rather than preserved as a foreign type", () => {
  expect(
    parseErdDefinition("id BIGSERIAL PRIMARY KEY", "postgresql").columns?.[0],
  ).toMatchObject({ dataType: "bigint", autoIncrement: true });
  expect(parseErdDefinition("id SERIAL PRIMARY KEY", "mysql").error).toContain(
    "PostgreSQL",
  );
});

test("malformed or unsupported input fails without partial columns", () => {
  for (const text of [
    "id integer, , name text",
    "id integer; DROP TABLE users",
    "id decimal(1,2",
    "id integer, ID text",
    "id text AUTO_INCREMENT PK",
    "id integer AUTO_INCREMENT",
    "id integer PK NULL",
    "id integer PK AUTO_INCREMENT, n integer PK",
    "id integer DEFAULT nextval('s')",
    "id integer REFERENCES other(id)",
    "id integer NOT NULL NULL",
    "id integer UNIQUE",
    "id integer -- comment",
  ]) {
    const result = parseErdDefinition(text, "mysql");
    expect(result.error).toBeDefined();
    expect(result.columns).toBeUndefined();
  }
});

test("PostgreSQL definitions accept session-user defaults", () => {
  expect(
    parseErdDefinition(
      "created_by text NOT NULL DEFAULT CURRENT_USER",
      "postgresql",
    ).columns,
  ).toEqual([
    {
      name: "created_by",
      dataType: "text",
      pk: false,
      nullable: false,
      defaultExpression: "CURRENT_USER",
    },
  ]);
  expect(
    parseErdDefinition("created_by text DEFAULT CURRENT_USER", "sqlite").error,
  ).toBe("Column 1: Use a literal or CURRENT_TIMESTAMP/DATE/TIME default.");
});

test("PostgreSQL ALWAYS identity survives definition editing", () => {
  const parsed = parseErdDefinition(
    '"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
    "postgresql",
  );
  expect(parsed.error).toBeUndefined();
  expect(parsed.columns?.[0]).toMatchObject({
    autoIncrement: true,
    identityGeneration: "always",
  });
  const columns = (parsed.columns ?? []).map((column, index) => ({
    ...column,
    id: String(index),
  }));
  expect(formatErdDefinition(columns, "postgresql")).toContain(
    "GENERATED ALWAYS AS IDENTITY",
  );
});
