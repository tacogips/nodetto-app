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
    expect(b.warnings).toEqual([]);
    expect(b.sql).not.toContain("FOREIGN KEY");
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

test("PostgreSQL aliases use canonical types without custom-type warnings", () => {
  const pairs = [
    ["dec", "decimal"],
    ["dec(8,2)", "decimal(8,2)"],
    ["bpchar(6)", "character(6)"],
    ["char varying(17)", "character varying(17)"],
    ["nchar", "character"],
    ["national char(9)", "character(9)"],
    ["national character(9)", "character(9)"],
    ["nchar varying(16)", "character varying(16)"],
    ["national char varying(12)", "character varying(12)"],
    ["national character varying(12)", "character varying(12)"],
    ["int8[][]", "bigint[][]"],
    ["int2", "smallint"],
    ["int4", "integer"],
    ["int8", "bigint"],
    ["float4", "real"],
    ["float8", "double precision"],
    ["float", "double precision"],
    ["bool", "boolean"],
    ["varchar", "character varying"],
    ["char", "character"],
    ["varbit", "bit varying"],
    ["timestamptz", "timestamp with time zone"],
    ["timetz", "time with time zone"],
    ["serial2", "smallserial"],
    ["serial4", "serial"],
    ["serial8", "bigserial"],
    ["decimal", "numeric"],
    ["varchar(19)", "character varying(19)"],
    ["char(7)", "character(7)"],
    ["varbit(11)", "bit varying(11)"],
    ["timestamptz(3)", "timestamp(3) with time zone"],
    ["timetz(2)", "time(2) with time zone"],
    ["int8[]", "bigint[]"],
    ["varchar(19)[]", "character varying(19)[]"],
  ];
  function report(
    dataType: string,
    dialect: "postgresql" | "mysql" | "sqlite",
  ) {
    const editor = makeEditor();
    editor.apply([
      {
        type: "createElement",
        element: editor.buildElement("erd.table", {
          semantic: {
            tableName: "alias_probe",
            columns: [{ id: "value", name: "value", dataType }],
          },
        }),
      },
    ]);
    return generateDatabaseDdl(editor, editor.currentPageId, dialect);
  }
  for (const [alias, canonical] of pairs) {
    for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
      const actual = report(alias!, dialect);
      const expected = report(canonical!, dialect);
      if (dialect === "postgresql") expect(actual.warnings).toEqual([]);
      expect(actual.sql).toEqual(expected.sql);
    }
  }
  for (const type of [
    "bpchar",
    "bytea",
    "inet",
    "cidr",
    "macaddr",
    "macaddr8",
    "money",
    "xml",
    "point",
    "box",
    "circle",
    "line",
    "lseg",
    "path",
    "polygon",
    "tsvector",
    "tsquery",
    "pg_lsn",
    "pg_snapshot",
    "interval",
    "int4range",
    "tstzmultirange",
  ])
    expect(report(type, "postgresql").warnings).toEqual([]);
  expect(report("custom_domain", "postgresql").warnings.join(" ")).toContain(
    "custom type",
  );
});

test("identity policy emits ALWAYS for PostgreSQL and portable identity elsewhere", () => {
  const editor = makeEditor();
  editor.apply([
    {
      type: "createElement",
      element: editor.buildElement("erd.table", {
        semantic: {
          tableName: "identity_probe",
          columns: [
            {
              id: "id",
              name: "id",
              dataType: "bigint",
              pk: true,
              autoIncrement: true,
              identityGeneration: "always",
            },
          ],
        },
      }),
    },
  ]);
  for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
    const report = generateDatabaseDdl(editor, editor.currentPageId, dialect);
    expect(report.warnings).toEqual([]);
    expect(report.sql).toContain(
      dialect === "postgresql"
        ? "GENERATED ALWAYS AS IDENTITY"
        : dialect === "mysql"
          ? "AUTO_INCREMENT"
          : "INTEGER PRIMARY KEY AUTOINCREMENT",
    );
    if (dialect === "sqlite") {
      const db = new Database(":memory:");
      db.exec(report.sql);
      db.close();
    }
  }
});

test("frame foreign-key scope follows the owner for both relation directions", () => {
  for (const cardinality of ["*:1", "1:*", "1:1"] as const) {
    const { editor, relation } = databaseFixture(cardinality);
    const semantic = relation.semantic as unknown as ErdRelationSemantic;
    const owner =
      cardinality === "*:1" ? semantic.from.table : semantic.to.table;
    const target =
      cardinality === "*:1" ? semantic.to.table : semantic.from.table;
    for (const member of [owner, target]) {
      const frame = editor.createElement("frame", {
        semantic: { name: member, memberIds: [member] },
      });
      const report = generateDatabaseDdl(
        editor,
        editor.currentPageId,
        "postgresql",
        { frameId: frame },
      );
      expect(
        report.warnings.some((warning) =>
          warning.includes("outside the selected frame"),
        ),
      ).toBe(member === owner);
    }
  }
});
