import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import type { Cardinality, ErdRelationSemantic } from "@nodetto/ir";
import { generateDatabaseDdl } from "./database-ddl.ts";
import { makeEditor } from "./test-helpers.ts";

function databaseFixture(
  cardinality: Cardinality = "*:1",
  actions: Partial<
    Pick<ErdRelationSemantic, "onDelete" | "onUpdate" | "deferrability">
  > = {},
) {
  const editor = makeEditor();
  const users = editor.buildElement("erd.table", {
    id: "users",
    semantic: {
      tableName: "users",
      columns: [
        { id: "user-id", name: "id", dataType: "uuid", pk: true },
        {
          id: "email",
          name: "email",
          dataType: "text",
          nullable: true,
          defaultExpression: "'unknown'",
        },
      ],
      indexes: [
        {
          id: "users-email",
          name: "users_email_uq",
          columns: ["email"],
          unique: true,
        },
      ],
      checks: [
        {
          id: "email-check",
          name: "email_nonempty",
          expression: "length(email) > 0",
        },
      ],
    },
  });
  const orders = editor.buildElement("erd.table", {
    id: "orders",
    semantic: {
      tableName: "orders",
      columns: [
        { id: "order-id", name: "id", dataType: "bigint", pk: true },
        { id: "owner", name: "user_id", dataType: "uuid" },
      ],
      indexes: [{ id: "orders-owner-index", columns: ["owner", "order-id"] }],
    },
  });
  const relation = editor.buildElement("erd.relation", {
    id: "orders-owner",
    semantic: {
      from:
        cardinality === "1:1"
          ? { table: users.id, column: "user-id" }
          : { table: orders.id, column: "owner" },
      to:
        cardinality === "1:1"
          ? { table: orders.id, column: "owner" }
          : { table: users.id, column: "user-id" },
      cardinality,
      label: "owned by",
      ...actions,
    },
  });
  editor.apply([{ type: "createElement", element: users }]);
  editor.apply(
    [orders, relation].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  return { editor, users, orders, relation };
}

test("SQLite executes cascading updates and deletes authored on a relation", () => {
  const { editor } = databaseFixture("*:1", {
    onDelete: "cascade",
    onUpdate: "cascade",
  });
  const result = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(result.warnings).toEqual([]);
  expect(result.sql).toContain("ON DELETE CASCADE ON UPDATE CASCADE");

  const database = new Database(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(result.sql);
    database.exec(
      "INSERT INTO users (id, email) VALUES ('first', 'first@example.test')",
    );
    database.exec("INSERT INTO orders (id, user_id) VALUES (1, 'first')");
    database.exec("UPDATE users SET id = 'renamed' WHERE id = 'first'");
    expect(
      database.query("SELECT user_id FROM orders WHERE id = 1").get(),
    ).toEqual({ user_id: "renamed" });
    database.exec("DELETE FROM users WHERE id = 'renamed'");
    expect(
      database.query("SELECT COUNT(*) AS count FROM orders").get(),
    ).toEqual({ count: 0 });
  } finally {
    database.close();
  }
});

test("SET DEFAULT is preserved where supported and omitted for MySQL", () => {
  const { editor } = databaseFixture("*:1", { onDelete: "set-default" });
  const postgres = generateDatabaseDdl(
    editor,
    editor.currentPageId,
    "postgresql",
  );
  expect(postgres.sql).toContain("ON DELETE SET DEFAULT");
  expect(postgres.warnings).toContain(
    "orders-owner: SET DEFAULT targets orders.user_id, which has no authored default expression.",
  );

  const mysql = generateDatabaseDdl(editor, editor.currentPageId, "mysql");
  const mysqlForeignKey = mysql.sql
    .split("\n")
    .find((line) => line.startsWith("ALTER TABLE"));
  expect(mysqlForeignKey).toBeDefined();
  expect(mysqlForeignKey).not.toContain("ON DELETE SET DEFAULT");
  expect(mysql.warnings).toContain(
    "orders-owner: MySQL does not support ON DELETE SET DEFAULT; the action was omitted.",
  );
});

test("deferred foreign keys allow transaction-order-independent SQLite imports", () => {
  const { editor } = databaseFixture("*:1", {
    deferrability: "initially-deferred",
  });
  const sqlite = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(sqlite.warnings).toEqual([]);
  expect(sqlite.sql).toContain("DEFERRABLE INITIALLY DEFERRED");

  const database = new Database(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(sqlite.sql);
    database.exec("BEGIN");
    database.exec("INSERT INTO orders (id, user_id) VALUES (1, 'later')");
    database.exec(
      "INSERT INTO users (id, email) VALUES ('later', 'later@example.test')",
    );
    database.exec("COMMIT");
    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally {
    database.close();
  }

  const postgres = generateDatabaseDdl(
    editor,
    editor.currentPageId,
    "postgresql",
  );
  expect(postgres.sql).toContain("DEFERRABLE INITIALLY DEFERRED");
  const mysql = generateDatabaseDdl(editor, editor.currentPageId, "mysql");
  expect(mysql.sql).not.toContain("DEFERRABLE INITIALLY DEFERRED");
  expect(mysql.warnings).toContain(
    "orders-owner: MySQL does not support deferrable foreign keys; the constraint timing was omitted.",
  );
});

test("composite foreign keys execute with ordered columns and cascade", () => {
  const editor = makeEditor();
  const accounts = editor.buildElement("erd.table", {
    id: "accounts",
    semantic: {
      tableName: "accounts",
      columns: [
        { id: "account-tenant", name: "tenant_id", dataType: "uuid", pk: true },
        { id: "account-id", name: "id", dataType: "uuid", pk: true },
      ],
    },
  });
  const invoices = editor.buildElement("erd.table", {
    id: "invoices",
    semantic: {
      tableName: "invoices",
      columns: [
        { id: "invoice-id", name: "id", dataType: "uuid", pk: true },
        { id: "invoice-tenant", name: "tenant_id", dataType: "uuid" },
        { id: "invoice-account", name: "account_id", dataType: "uuid" },
      ],
    },
  });
  const owner = editor.buildElement("erd.relation", {
    id: "invoice-account",
    semantic: {
      from: {
        table: invoices.id,
        columns: ["invoice-tenant", "invoice-account"],
      },
      to: {
        table: accounts.id,
        columns: ["account-tenant", "account-id"],
      },
      cardinality: "*:1",
      onDelete: "cascade",
      onUpdate: "cascade",
    },
  });
  editor.apply(
    [accounts, invoices, owner].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );

  for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
    const ddl = generateDatabaseDdl(editor, editor.currentPageId, dialect);
    const quote = dialect === "mysql" ? "`" : '"';
    expect(ddl.warnings).toEqual([]);
    expect(ddl.sql).toContain(
      `FOREIGN KEY (${quote}tenant_id${quote}, ${quote}account_id${quote})`,
    );
    expect(ddl.sql).toContain(
      `REFERENCES ${quote}accounts${quote} (${quote}tenant_id${quote}, ${quote}id${quote})`,
    );
  }

  const sqlite = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  const database = new Database(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(sqlite.sql);
    database.exec("INSERT INTO accounts VALUES ('tenant-a', 'account-a')");
    database.exec(
      "INSERT INTO invoices VALUES ('invoice-a', 'tenant-a', 'account-a')",
    );
    expect(() =>
      database.exec(
        "INSERT INTO invoices VALUES ('invoice-b', 'tenant-b', 'account-a')",
      ),
    ).toThrow();
    database.exec(
      "UPDATE accounts SET id = 'account-b' WHERE tenant_id = 'tenant-a' AND id = 'account-a'",
    );
    expect(database.query("SELECT account_id FROM invoices").get()).toEqual({
      account_id: "account-b",
    });
    database.exec("DELETE FROM accounts");
    expect(
      database.query("SELECT COUNT(*) AS count FROM invoices").get(),
    ).toEqual({ count: 0 });
  } finally {
    database.close();
  }
});

test("SQLite handoff executes and enforces keys, defaults, checks and indexes", () => {
  const { editor } = databaseFixture();
  const before = editor.getSnapshot();
  const result = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  const database = new Database(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(result.sql);
    database
      .query("INSERT INTO users (id, email) VALUES (?, ?)")
      .run("first", "first@example.test");
    database.query("INSERT INTO users (id) VALUES (?)").run("second");
    expect(
      database.query("SELECT email FROM users WHERE id = ?").get("second"),
    ).toEqual({ email: "unknown" });
    database
      .query("INSERT INTO orders (id, user_id) VALUES (?, ?)")
      .run(1, "first");
    expect(() =>
      database
        .query("INSERT INTO users (id, email) VALUES (?, ?)")
        .run("first", "different@example.test"),
    ).toThrow();
    expect(() =>
      database
        .query("INSERT INTO orders (id, user_id) VALUES (?, ?)")
        .run(2, "missing"),
    ).toThrow();
    expect(() =>
      database
        .query("INSERT INTO users (id, email) VALUES (?, ?)")
        .run("third", "first@example.test"),
    ).toThrow();
    expect(() =>
      database
        .query("INSERT INTO users (id, email) VALUES (?, ?)")
        .run("third", ""),
    ).toThrow();
    expect(() =>
      database
        .query("INSERT INTO users (id, email) VALUES (?, ?)")
        .run(null, "third@example.test"),
    ).toThrow();
    expect(() =>
      database.query("DELETE FROM users WHERE id = ?").run("first"),
    ).toThrow();
    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(
      database.query("SELECT COUNT(*) AS count FROM orders").get(),
    ).toEqual({ count: 1 });
    expect(editor.getSnapshot()).toEqual(before);
  } finally {
    database.close();
  }
});

test("PostgreSQL DDL sorts tables by name and preserves keys, nullability and relations", () => {
  const { editor } = databaseFixture();
  const before = editor.getSnapshot();
  const result = generateDatabaseDdl(
    editor,
    editor.currentPageId,
    "postgresql",
  );
  expect(result).toMatchObject({
    dialect: "postgresql",
    tableCount: 2,
    relationCount: 1,
    indexCount: 2,
    checkCount: 1,
    warnings: [],
  });
  expect(result.sql).toContain('"id" UUID NOT NULL');
  expect(result.sql).toContain('"email" TEXT');
  expect(result.sql).not.toContain('"email" TEXT NOT NULL');
  expect(result.sql).toContain(`"email" TEXT DEFAULT 'unknown'`);
  expect(result.sql).toContain(
    'CREATE UNIQUE INDEX "users_email_uq" ON "users" ("email")',
  );
  expect(result.sql).toContain(
    'CREATE INDEX "idx_orders_user_id_id" ON "orders" ("user_id", "id")',
  );
  expect(result.sql).toContain('CONSTRAINT "pk_users" PRIMARY KEY ("id")');
  expect(result.sql).toContain(
    'CONSTRAINT "email_nonempty" CHECK (length(email) > 0)',
  );
  expect(result.sql).toContain(
    'FOREIGN KEY ("user_id") REFERENCES "users" ("id")',
  );
  expect(result.sql).toContain(
    'ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_user_id_users"',
  );
  expect(result.sql.indexOf('CREATE TABLE "orders"')).toBeLessThan(
    result.sql.indexOf('CREATE TABLE "users"'),
  );
  expect(result.sql.indexOf('CREATE TABLE "orders"')).toBeLessThan(
    result.sql.indexOf('ALTER TABLE "orders"'),
  );
  const sqlite = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(sqlite.sql).toContain(
    'CONSTRAINT "fk_orders_user_id_users" FOREIGN KEY ("user_id")',
  );
  expect(sqlite.sql).not.toContain("ALTER TABLE");
  expect(editor.getSnapshot()).toEqual(before);
});

test("MySQL and SQLite map portable types and quote hostile identifiers", () => {
  const editor = makeEditor();
  const table = editor.buildElement("erd.table", {
    semantic: {
      tableName: 'odd`"table',
      columns: [
        { id: "id", name: "select", dataType: "uuid", pk: true },
        { id: "payload", name: "pay`load", dataType: "json" },
        {
          id: "unsafe",
          name: "unsafe",
          dataType: "text); DROP TABLE x;--",
          defaultExpression: "0; DROP TABLE x;--",
        },
      ],
    },
  });
  editor.apply([{ type: "createElement", element: table }]);

  const mysql = generateDatabaseDdl(editor, editor.currentPageId, "mysql");
  expect(mysql.sql).toContain('CREATE TABLE `odd``"table`');
  expect(mysql.sql).toContain("`select` CHAR(36) NOT NULL");
  expect(mysql.sql).toContain("`pay``load` JSON NOT NULL");
  expect(mysql.sql).toContain("`unsafe` TEXT NOT NULL");
  expect(mysql.sql).toContain("ENGINE=InnoDB;");
  expect(mysql.sql).not.toContain("DEFAULT 0;");
  expect(mysql.warnings).toHaveLength(2);

  const sqlite = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(sqlite.sql).toContain("PRAGMA foreign_keys = ON;");
  expect(sqlite.sql).toContain('"select" TEXT NOT NULL');
  expect(sqlite.sql).toContain('"pay`load" TEXT NOT NULL');
  expect(sqlite.warnings).toHaveLength(2);
});

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

test("one-to-one constraints and incomplete relations produce actionable SQL warnings", () => {
  const { editor, relation } = databaseFixture("1:1");
  const many = editor.buildElement("erd.relation", {
    id: "many-to-many",
    semantic: {
      from: { table: "users", column: "email" },
      to: { table: "orders", column: "owner" },
      cardinality: "*:*",
    },
  });
  editor.apply([{ type: "createElement", element: many }]);
  const result = generateDatabaseDdl(
    editor,
    editor.currentPageId,
    "postgresql",
  );
  expect(result.sql).toContain(
    'CONSTRAINT "uq_orders_user_id" UNIQUE ("user_id")',
  );
  expect(result.sql).toContain(
    `-- Warning: ${many.id}: many-to-many relation requires an explicit junction table.`,
  );
  expect(result.relationCount).toBe(2);
  expect(result.sql).toContain(`CONSTRAINT "fk_orders_user_id_users"`);
  expect(relation.id).toBe("orders-owner");
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

test("logical relations are drawn but emit no foreign key or uniqueness", () => {
  for (const cardinality of ["*:1", "1:1"] as const) {
    const { editor, relation } = databaseFixture(cardinality);
    editor.apply([
      {
        type: "updateSemantic",
        id: relation.id,
        semantic: {
          ...(relation.semantic as ErdRelationSemantic),
          logical: true,
        },
      },
    ]);
    for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
      const result = generateDatabaseDdl(editor, editor.currentPageId, dialect);
      expect(result.sql).not.toContain("FOREIGN KEY");
      expect(result.sql).not.toContain("uq_orders_user_id");
      expect(result.warnings).toEqual([]);
      expect(result.relationCount).toBe(1);
    }
  }
});

test("an empty table's name cannot break out of its skip comment", () => {
  const editor = makeEditor();
  editor.createElement("erd.table", {
    id: "evil",
    semantic: {
      tableName: "x\nDROP TABLE victim; --\r\u2028DROP TABLE victim;",
      columns: [],
    },
    visual: { x: 0, y: 0, width: 200 },
  });
  for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
    const { sql } = generateDatabaseDdl(editor, editor.currentPageId, dialect);
    for (const line of sql.split(/[\n\r\v\f\u0085\u2028\u2029]/))
      expect(
        line.trim() === "" ||
          line.startsWith("--") ||
          line === "PRAGMA foreign_keys = ON;",
      ).toBe(true);
  }
  const database = new Database(":memory:");
  database.run("CREATE TABLE victim (id INTEGER)");
  database.exec(
    generateDatabaseDdl(editor, editor.currentPageId, "sqlite").sql,
  );
  expect(
    database
      .query("SELECT name FROM sqlite_master WHERE name = 'victim'")
      .all(),
  ).toHaveLength(1);
});

test("frame DDL isolates nested databases and diagnoses cross-scope dependencies", () => {
  const { editor } = databaseFixture();
  const pageId = editor.currentPageId;
  // Explicit members are authoritative even when geometry overlaps another frame.
  editor.apply([
    {
      type: "createElement",
      element: editor.buildElement("frame", {
        id: "db-a",
        semantic: { name: "A", memberIds: ["nested"] },
      }),
    },
    {
      type: "createElement",
      element: editor.buildElement("frame", {
        id: "nested",
        semantic: { name: "Nested", memberIds: ["orders", "local-view"] },
      }),
    },
    {
      type: "createElement",
      element: editor.buildElement("frame", {
        id: "db-b",
        semantic: { name: "B", memberIds: ["users"] },
      }),
    },
    {
      type: "createElement",
      element: editor.buildElement("erd.view", {
        id: "local-view",
        semantic: {
          name: "local_view",
          definition: "SELECT * FROM users",
          dependsOn: ["users"],
        },
      }),
    },
  ]);
  for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
    const a = generateDatabaseDdl(editor, pageId, dialect, { frameId: "db-a" });
    const b = generateDatabaseDdl(editor, pageId, dialect, { frameId: "db-b" });
    expect(a.tableCount).toBe(1);
    expect(b.tableCount).toBe(1);
    expect(a.sql).toContain(
      dialect === "mysql" ? "CREATE TABLE `orders`" : 'CREATE TABLE "orders"',
    );
    expect(a.sql).not.toContain(
      dialect === "mysql" ? "CREATE TABLE `users`" : 'CREATE TABLE "users"',
    );
    expect(a.sql).not.toContain("FOREIGN KEY");
    expect(a.sql).not.toContain("CREATE VIEW");
    expect(
      a.warnings.some((warning) =>
        warning.includes("outside the selected frame"),
      ),
    ).toBe(true);
    expect(
      a.warnings.some((warning) => warning.includes("Definition omitted")),
    ).toBe(true);
    expect(generateDatabaseDdl(editor, pageId, dialect).tableCount).toBe(2);
  }
  editor.apply([
    {
      type: "createElement",
      element: editor.buildElement("frame", {
        id: "empty-db",
        semantic: { name: "Empty", memberIds: [] },
      }),
    },
  ]);
  expect(
    generateDatabaseDdl(editor, pageId, "sqlite", { frameId: "empty-db" })
      .tableCount,
  ).toBe(0);
  expect(() =>
    generateDatabaseDdl(editor, pageId, "sqlite", { frameId: "users" }),
  ).toThrow("frame on the selected page");
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
    { id: "huge", expression: `a IN (${"'x', ".repeat(2000)}'y')` },
    { id: "cast", expression: "a::int > 0" },
    { id: "empty", expression: "  " },
  ]);
  const result = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(result.warnings).toEqual([
    "widgets: check empty was omitted because its expression is empty.",
    "widgets: check huge was omitted because its expression is 10010 characters long, over the 8192-character limit.",
    'widgets: check cast was omitted because its expression contains ":"; write casts as CAST(value AS type).',
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
