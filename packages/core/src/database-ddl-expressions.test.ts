import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { generateDatabaseDdl } from "./database-ddl.ts";
import { makeEditor } from "./test-helpers.ts";

test("unsafe or malformed check expressions are omitted with warnings", () => {
  const editor = makeEditor();
  const table = editor.buildElement("erd.table", {
    semantic: {
      tableName: "accounts",
      columns: [{ id: "balance", name: "balance", dataType: "decimal" }],
      checks: [
        { id: "valid", expression: "balance >= 0" },
        {
          id: "states",
          name: "Valid state",
          expression: "state IN ('open', 'closed')",
        },
        { id: "inject", expression: "balance >= 0; DROP TABLE accounts" },
        {
          id: "subquery",
          expression: "balance > (SELECT min(balance) FROM accounts)",
        },
        { id: "quote", expression: "state = 'open" },
        { id: "comment", expression: "balance >= 0 -- bypass" },
        { id: "newline", expression: "balance >= 0\n  AND balance < 100" },
        // MySQL reads \' as an escaped quote, which would end the first
        // literal later and expose the second literal's text as SQL.
        {
          id: "backslash",
          expression: "state = '\\' AND state <> '; DROP TABLE accounts; --'",
        },
        { id: "literal-break", expression: "state <> 'a\nb'" },
        { id: "unicode-space", expression: "balance\u3000>= 0" },
        {
          id: "literal-then-select",
          expression: "state <> 'x' UNION SELECT 1",
        },
      ],
    },
  });
  editor.apply([{ type: "createElement", element: table }]);

  const result = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(result.checkCount).toBe(11);
  expect(result.sql).toContain(
    'CONSTRAINT "ck_accounts_valid" CHECK (balance >= 0)',
  );
  expect(result.sql).toContain(
    `CONSTRAINT "Valid state" CHECK (state IN ('open', 'closed'))`,
  );
  expect(result.sql).toContain(
    'CONSTRAINT "ck_accounts_newline" CHECK (balance >= 0 AND balance < 100)',
  );
  expect(result.sql).not.toContain("DROP TABLE accounts");
  expect(result.sql).not.toContain("SELECT min");
  expect(result.sql).not.toContain("UNION SELECT 1)");
  expect([...result.warnings].sort()).toEqual(
    [
      "accounts: check comment was omitted because its expression contains a statement separator or SQL comment.",
      "accounts: check inject was omitted because its expression contains a statement separator or SQL comment.",
      'accounts: check backslash was omitted because its expression contains "\\"; backslash escapes differ between dialects.',
      "accounts: check literal-break was omitted because its expression contains a line break or control character inside a string literal.",
      "accounts: check literal-then-select was omitted because its expression contains UNION; only row-local expressions are allowed.",
      "accounts: check quote was omitted because its expression has an unterminated string literal.",
      "accounts: check subquery was omitted because its expression contains SELECT; only row-local expressions are allowed.",
      'accounts: check unicode-space was omitted because its expression contains the unsupported character "\u3000".',
    ].sort(),
  );
});

test("string literals may contain any printable text", () => {
  const editor = checkTable([
    { id: "email", expression: "a LIKE '%@%.%'" },
    {
      id: "status",
      expression: "b IN ('下書き', '公開', 'a;b', 'x--y', '#1')",
    },
  ]);
  for (const dialect of ["postgresql", "mysql", "sqlite"] as const)
    expect(
      generateDatabaseDdl(editor, editor.currentPageId, dialect).warnings,
    ).toEqual([]);
  const database = new Database(":memory:");
  try {
    database.exec(
      generateDatabaseDdl(editor, editor.currentPageId, "sqlite").sql,
    );
    database.exec(
      "INSERT INTO widgets (id, a, b) VALUES (1, 'me@example.test', '公開')",
    );
    expect(() =>
      database.exec("INSERT INTO widgets (id, a) VALUES (2, 'no-at-sign')"),
    ).toThrow();
    expect(() =>
      database.exec("INSERT INTO widgets (id, b) VALUES (3, 'other')"),
    ).toThrow();
  } finally {
    database.close();
  }
});

test("database defaults and generated composite index names stay dialect-safe", () => {
  const editor = makeEditor();
  const table = editor.buildElement("erd.table", {
    semantic: {
      tableName: "events",
      columns: [
        {
          id: "id",
          name: "id",
          dataType: "uuid",
          pk: true,
          defaultExpression: "gen_random_uuid()",
        },
        {
          id: "status",
          name: "status",
          dataType: "text",
          defaultExpression: "'new'",
        },
        {
          id: "created",
          name: "created_at",
          dataType: "timestamp",
          defaultExpression: "now()",
        },
      ],
      indexes: [
        { id: "status-index", columns: ["status"], unique: true },
        { id: "timeline-index", columns: ["status", "created"] },
      ],
    },
  });
  editor.apply([{ type: "createElement", element: table }]);

  const postgres = generateDatabaseDdl(
    editor,
    editor.currentPageId,
    "postgresql",
  );
  expect(postgres.warnings).toEqual([]);
  expect(postgres.sql).toContain("DEFAULT gen_random_uuid()");
  expect(postgres.sql).toContain(`"status" TEXT NOT NULL DEFAULT 'new'`);
  expect(postgres.sql).toContain(
    '"created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
  );
  expect(postgres.sql).toContain(
    'CREATE UNIQUE INDEX "uq_events_status" ON "events" ("status")',
  );
  expect(postgres.sql).toContain(
    'CREATE INDEX "idx_events_status_created_at" ON "events" ("status", "created_at")',
  );

  const mysql = generateDatabaseDdl(editor, editor.currentPageId, "mysql");
  expect(mysql.sql).not.toContain("DEFAULT gen_random_uuid()");
  expect(mysql.sql).toContain("DEFAULT CURRENT_TIMESTAMP");
  expect(mysql.warnings).toHaveLength(1);
});

test("stored generated columns are portable and unsafe expressions are omitted", () => {
  const editor = makeEditor();
  const table = editor.buildElement("erd.table", {
    semantic: {
      tableName: "line_items",
      columns: [
        { id: "quantity", name: "quantity", dataType: "decimal" },
        { id: "price", name: "unit_price", dataType: "decimal" },
        {
          id: "total",
          name: "total",
          dataType: "decimal",
          generatedExpression: "quantity * unit_price",
        },
        {
          id: "unsafe",
          name: "unsafe_total",
          dataType: "decimal",
          generatedExpression: "quantity; DROP TABLE line_items",
        },
      ],
    },
  });
  editor.apply([{ type: "createElement", element: table }]);

  for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
    const result = generateDatabaseDdl(editor, editor.currentPageId, dialect);
    const quoted = dialect === "mysql" ? "`total`" : '"total"';
    const type = dialect === "sqlite" ? "NUMERIC" : "DECIMAL";
    expect(result.sql).toContain(
      `${quoted} ${type} NOT NULL GENERATED ALWAYS AS (quantity * unit_price) STORED`,
    );
    expect(result.sql).not.toContain(
      "GENERATED ALWAYS AS (quantity; DROP TABLE line_items)",
    );
    expect(result.warnings).toEqual([
      'line_items.unsafe_total: generated expression "quantity; DROP TABLE line_items" was omitted because it contains a statement separator or SQL comment. Use one portable row-local SQL expression.',
    ]);
    if (dialect === "sqlite") {
      const database = new Database(":memory:");
      try {
        database.exec(result.sql);
        database
          .query(
            "INSERT INTO line_items (quantity, unit_price, unsafe_total) VALUES (?, ?, ?)",
          )
          .run(3, 12.5, 0);
        expect(database.query("SELECT total FROM line_items").get()).toEqual({
          total: 37.5,
        });
        database.exec("UPDATE line_items SET quantity = 4");
        expect(database.query("SELECT total FROM line_items").get()).toEqual({
          total: 50,
        });
        expect(() =>
          database.exec("UPDATE line_items SET total = 0"),
        ).toThrow();
      } finally {
        database.close();
      }
    }
  }
});

function checkTable(
  checks: readonly { id: string; name?: string; expression: string }[],
) {
  const editor = makeEditor();
  editor.createElement("erd.table", {
    id: "widgets-table",
    semantic: {
      tableName: "widgets",
      columns: [
        { id: "id", name: "id", dataType: "integer", pk: true },
        { id: "a", name: "a", dataType: "text", nullable: true },
        { id: "b", name: "b", dataType: "text", nullable: true },
      ],
      checks,
    },
    visual: { x: 0, y: 0, width: 200 },
  });
  return editor;
}

test("long CHECK expressions are emitted and enforced", () => {
  // Sixteen CASE terms: well over the former 512-character cap.
  const terms = Array.from(
    { length: 16 },
    (_, index) =>
      `CASE WHEN ${index % 2 ? "a" : "b"} IS NOT NULL THEN 1 ELSE 0 END`,
  );
  const expression = `${terms.join(" + ")} >= 0 AND (a IS NOT NULL OR b IS NOT NULL)`;
  expect(expression.length).toBeGreaterThan(512);
  const editor = checkTable([{ id: "long", name: "ck_wide", expression }]);
  for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
    const result = generateDatabaseDdl(editor, editor.currentPageId, dialect);
    expect(result.warnings).toEqual([]);
    expect(result.sql).toContain(`CHECK (${expression})`);
  }
  const database = new Database(":memory:");
  try {
    database.exec(
      generateDatabaseDdl(editor, editor.currentPageId, "sqlite").sql,
    );
    database.exec("INSERT INTO widgets (id, a) VALUES (1, 'x')");
    expect(() =>
      database.exec("INSERT INTO widgets (id) VALUES (2)"),
    ).toThrow();
  } finally {
    database.close();
  }
});

test("omitted CHECK expressions report the specific reason, including the length limit", () => {
  const editor = checkTable([
    { id: "huge", expression: `a IN (${"'x', ".repeat(14000)}'y')` },
    { id: "cast", expression: "a::int > 0" },
    { id: "empty", expression: "  " },
  ]);
  const result = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(result.warnings).toEqual([
    "widgets: check empty was omitted because its expression is empty.",
    "widgets: check huge was omitted because its expression is 70010 characters long, over the 65536-character limit.",
    'widgets: check cast was omitted because its expression contains ":"; "::" casts are PostgreSQL-only, so write CAST(value AS type) for SQLite.',
  ]);
  expect(result.sql).not.toContain("CHECK");
});

test("CHECK expressions using functions the dialect lacks are flagged", () => {
  const editor = checkTable([
    {
      id: "one-of",
      name: "ck_one_of",
      expression: "num_nonnulls(a, b) = 1",
    },
    {
      id: "portable",
      name: "ck_portable",
      expression:
        "CASE WHEN a IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN b IS NOT NULL THEN 1 ELSE 0 END <= 2 AND CAST(id AS VARCHAR(20)) <> '' AND coalesce(length(a), 0) < 100 AND a NOT IN ('num_nonnulls(x)')",
    },
    { id: "pattern", name: "ck_pattern", expression: "a ILIKE 'x%'" },
  ]);

  const sqlite = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(sqlite.warnings).toEqual([
    "widgets: check ck_one_of uses num_nonnulls(), which SQLite does not support; the database will reject this DDL unless the expression is rewritten for SQLite.",
    "widgets: check ck_pattern uses ILIKE, which SQLite does not support; the database will reject this DDL unless the expression is rewritten for SQLite.",
  ]);
  // The authored constraint is kept rather than silently dropped.
  expect(sqlite.sql).toContain("CHECK (num_nonnulls(a, b) = 1)");

  const postgres = generateDatabaseDdl(
    editor,
    editor.currentPageId,
    "postgresql",
  );
  expect(postgres.warnings).toEqual([]);

  const mysql = generateDatabaseDdl(editor, editor.currentPageId, "mysql");
  expect(mysql.warnings).toEqual([
    "widgets: check ck_one_of uses num_nonnulls(), which MySQL does not support; the database will reject this DDL unless the expression is rewritten for MySQL.",
    "widgets: check ck_pattern uses ILIKE, which MySQL does not support; the database will reject this DDL unless the expression is rewritten for MySQL.",
  ]);

  const portable = checkTable([
    {
      id: "portable",
      expression:
        "CASE WHEN a IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN b IS NOT NULL THEN 1 ELSE 0 END = 1",
    },
  ]);
  const portableSqlite = generateDatabaseDdl(
    portable,
    portable.currentPageId,
    "sqlite",
  );
  expect(portableSqlite.warnings).toEqual([]);
  const database = new Database(":memory:");
  try {
    database.exec(portableSqlite.sql);
    database.exec("INSERT INTO widgets (id, a) VALUES (1, 'x')");
    expect(() =>
      database.exec("INSERT INTO widgets (id, a, b) VALUES (2, 'x', 'y')"),
    ).toThrow();
  } finally {
    database.close();
  }
});

test("PostgreSQL-only functions in generated columns are flagged for SQLite", () => {
  const editor = makeEditor();
  editor.createElement("erd.table", {
    semantic: {
      tableName: "pairs",
      columns: [
        { id: "a", name: "a", dataType: "text", nullable: true },
        {
          id: "count",
          name: "present",
          dataType: "integer",
          generatedExpression: "num_nonnulls(a)",
        },
      ],
    },
    visual: { x: 0, y: 0, width: 200 },
  });
  const sqlite = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(sqlite.warnings).toEqual([
    "pairs.present: generated expression uses num_nonnulls(), which SQLite does not support; the database will reject this DDL unless the expression is rewritten for SQLite.",
  ]);
  expect(
    generateDatabaseDdl(editor, editor.currentPageId, "postgresql").warnings,
  ).toEqual([]);
});

test("session-user defaults are emitted for PostgreSQL and omitted elsewhere", () => {
  const editor = makeEditor();
  editor.createElement("erd.table", {
    semantic: {
      tableName: "widgets",
      columns: [
        { id: "id", name: "id", dataType: "integer", pk: true },
        {
          id: "created-by",
          name: "created_by",
          dataType: "text",
          defaultExpression: "CURRENT_USER",
        },
        {
          id: "session",
          name: "session_name",
          dataType: "text",
          defaultExpression: "session_user",
        },
      ],
    },
    visual: { x: 0, y: 0, width: 200 },
  });
  const postgres = generateDatabaseDdl(
    editor,
    editor.currentPageId,
    "postgresql",
  );
  expect(postgres.warnings).toEqual([]);
  expect(postgres.sql).toContain(
    '"created_by" TEXT NOT NULL DEFAULT CURRENT_USER',
  );
  expect(postgres.sql).toContain(
    '"session_name" TEXT NOT NULL DEFAULT session_user',
  );
  for (const dialect of ["mysql", "sqlite"] as const) {
    const result = generateDatabaseDdl(editor, editor.currentPageId, dialect);
    const label = dialect === "mysql" ? "MySQL" : "SQLite";
    expect(result.warnings).toEqual([
      `widgets.created_by: default CURRENT_USER is PostgreSQL-only; ${label} does not support it as a column default, so it was omitted.`,
      `widgets.session_name: default session_user is PostgreSQL-only; ${label} does not support it as a column default, so it was omitted.`,
    ]);
    expect(result.sql).not.toMatch(/DEFAULT (?:CURRENT_USER|session_user)/);
  }
});

test("PostgreSQL keeps casts, regular expressions, arrays and long CHECK expressions", () => {
  const long = `(${Array.from({ length: 400 }, (_, index) => `a <> 'value-${index}'`).join(" AND ")})`;
  expect(long.length).toBeGreaterThan(8192);
  const checks = [
    { id: "cast", name: "ck_cast", expression: "a::text <> ''" },
    {
      id: "regex",
      name: "ck_regex",
      expression: "b ~ '^[a-z]+$' AND b !~* 'x'",
    },
    {
      id: "array",
      name: "ck_array",
      expression: "a = ANY (ARRAY['p'::text, 'q'::text])",
    },
    { id: "long", name: "ck_long", expression: long },
  ];
  const editor = checkTable(checks);
  const postgresql = generateDatabaseDdl(
    editor,
    editor.currentPageId,
    "postgresql",
  );
  expect(postgresql.warnings).toEqual([]);
  for (const check of checks)
    expect(postgresql.sql).toContain(`CHECK (${check.expression})`);
  const sqlite = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(sqlite.warnings).toEqual([
    'widgets: check ck_array was omitted because its expression contains "["; arrays and subscripts are PostgreSQL-only.',
    'widgets: check ck_cast was omitted because its expression contains ":"; "::" casts are PostgreSQL-only, so write CAST(value AS type) for SQLite.',
    'widgets: check ck_regex was omitted because its expression contains "~"; regular-expression operators are PostgreSQL-only.',
  ]);
  expect(sqlite.sql).toContain('CONSTRAINT "ck_long" CHECK');
});

test("PostgreSQL syntax stays inside the safety checks", () => {
  const editor = checkTable([
    { id: "colon", expression: "a : b" },
    { id: "bracket", expression: "a = ANY (ARRAY['p')" },
    { id: "close", expression: "a] = b" },
    { id: "comment", expression: "a::text -- x" },
  ]);
  const result = generateDatabaseDdl(
    editor,
    editor.currentPageId,
    "postgresql",
  );
  expect(result.warnings).toEqual([
    'widgets: check colon was omitted because its expression contains ":" outside a "::" cast.',
    "widgets: check bracket was omitted because its expression has unbalanced brackets.",
    "widgets: check comment was omitted because its expression contains a statement separator or SQL comment.",
    "widgets: check close was omitted because its expression has unbalanced brackets.",
  ]);
  expect(result.sql).not.toContain("CHECK");
});
