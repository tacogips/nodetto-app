import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import type { ErdTableSemantic } from "@nodetto/ir";
import { generateDatabaseDdl } from "./database-ddl.ts";
import { makeEditor } from "./test-helpers.ts";

function partialIndexTable(
  indexes: readonly {
    id: string;
    name?: string;
    columns: string[];
    unique?: boolean;
    where?: string;
  }[],
) {
  const editor = makeEditor();
  editor.createElement("erd.table", {
    id: "slots-table",
    semantic: {
      tableName: "slots",
      columns: [
        { id: "id", name: "id", dataType: "integer", pk: true },
        { id: "owner", name: "owner_id", dataType: "integer" },
        { id: "code", name: "code", dataType: "text" },
        {
          id: "archived",
          name: "archived_at",
          dataType: "timestamp",
          nullable: true,
        },
      ],
      indexes,
    },
    visual: { x: 0, y: 0, width: 200 },
  });
  return editor;
}

test("partial indexes emit their WHERE condition and SQLite enforces it", () => {
  const editor = partialIndexTable([
    {
      id: "live-code",
      name: "uq_slots_live_code",
      columns: ["owner", "code"],
      unique: true,
      where: "  archived_at IS NULL ",
    },
  ]);
  for (const dialect of ["postgresql", "sqlite"] as const) {
    const result = generateDatabaseDdl(editor, editor.currentPageId, dialect);
    expect(result.warnings).toEqual([]);
    expect(result.sql).toContain(
      'CREATE UNIQUE INDEX "uq_slots_live_code" ON "slots" ("owner_id", "code") WHERE archived_at IS NULL;',
    );
  }
  const database = new Database(":memory:");
  try {
    database.exec(
      generateDatabaseDdl(editor, editor.currentPageId, "sqlite").sql,
    );
    database.exec(
      "INSERT INTO slots (id, owner_id, code, archived_at) VALUES (1, 7, 'k', '2026-01-01')",
    );
    database.exec("INSERT INTO slots (id, owner_id, code) VALUES (2, 7, 'k')");
    expect(() =>
      database.exec(
        "INSERT INTO slots (id, owner_id, code) VALUES (3, 7, 'k')",
      ),
    ).toThrow();
  } finally {
    database.close();
  }
});

test("partial indexes that cannot keep their condition are omitted with warnings", () => {
  const editor = partialIndexTable([
    {
      id: "live-code",
      name: "uq_slots_live_code",
      columns: ["owner", "code"],
      unique: true,
      where: "archived_at IS NULL",
    },
    { id: "unsafe", columns: ["code"], where: "1 = 1; DROP TABLE slots" },
    { id: "plain", columns: ["code"] },
  ]);
  const mysql = generateDatabaseDdl(editor, editor.currentPageId, "mysql");
  expect(mysql.warnings).toEqual([
    "slots: index unsafe was omitted because MySQL does not support partial indexes (WHERE 1 = 1; DROP TABLE slots).",
    "slots: index uq_slots_live_code was omitted because MySQL does not support partial indexes (WHERE archived_at IS NULL).",
  ]);
  expect(mysql.sql).not.toContain("uq_slots_live_code`");
  expect(mysql.sql).toContain(
    "CREATE INDEX `idx_slots_code` ON `slots` (`code`);",
  );
  const postgresql = generateDatabaseDdl(
    editor,
    editor.currentPageId,
    "postgresql",
  );
  expect(postgresql.warnings).toEqual([
    "slots: index unsafe was omitted because its WHERE condition contains a statement separator or SQL comment.",
  ]);
  expect(postgresql.sql).not.toContain("DROP TABLE");
  expect(postgresql.sql).toContain("WHERE archived_at IS NULL;");
});

function tablesEditor(tables: readonly ErdTableSemantic[]) {
  const editor = makeEditor();
  for (const [index, semantic] of tables.entries())
    editor.createElement("erd.table", { id: `table-${index}`, semantic });
  return editor;
}

const TAGS: ErdTableSemantic = {
  tableName: "tags",
  comment: "Labels users attach to notes.\n\nTags nest through parent_tag_id.",
  columns: [
    { id: "id", name: "tag_id", dataType: "INTEGER", pk: true },
    {
      id: "name",
      name: "name",
      dataType: "TEXT",
      comment: "Display name; it's unique.",
    },
    {
      id: "parent",
      name: "parent_tag_id",
      dataType: "INTEGER",
      nullable: true,
      comment: "Parent tag.\r\nNULL for a root tag.",
    },
  ],
  sqlite: { strict: true, withoutRowid: true },
};

test("SQLite table options emit STRICT and WITHOUT ROWID, and SQLite enforces them", () => {
  const editor = tablesEditor([TAGS]);
  const result = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(result.warnings).toEqual([]);
  expect(result.sql).toContain(`-- Labels users attach to notes.
--
-- Tags nest through parent_tag_id.
CREATE TABLE "tags" (
  "tag_id" INTEGER NOT NULL,
  -- Display name; it's unique.
  "name" TEXT NOT NULL,
  -- Parent tag.
  -- NULL for a root tag.
  "parent_tag_id" INTEGER,
  CONSTRAINT "pk_tags" PRIMARY KEY ("tag_id")
) STRICT, WITHOUT ROWID;`);
  const database = new Database(":memory:");
  try {
    database.exec(result.sql);
    const list = database.query("PRAGMA table_list('tags')").get() as {
      strict: number;
      wr: number;
    };
    expect([list.strict, list.wr]).toEqual([1, 1]);
    expect(() =>
      database.exec("INSERT INTO tags (tag_id, name) VALUES ('x', 'a')"),
    ).toThrow();
  } finally {
    database.close();
  }
  const strictOnly = tablesEditor([
    { ...TAGS, sqlite: { strict: true, withoutRowid: false } },
  ]);
  expect(
    generateDatabaseDdl(strictOnly, strictOnly.currentPageId, "sqlite").sql,
  ).toContain("\n) STRICT;");
});

test("other dialects ignore SQLite table options", () => {
  const plain = tablesEditor([{ ...TAGS, sqlite: undefined }]);
  const optioned = tablesEditor([TAGS]);
  for (const dialect of ["postgresql", "mysql"] as const) {
    const result = generateDatabaseDdl(
      optioned,
      optioned.currentPageId,
      dialect,
    );
    expect(result.warnings).toEqual([]);
    expect(result.sql).toBe(
      generateDatabaseDdl(plain, plain.currentPageId, dialect).sql,
    );
    expect(result.sql).not.toContain("STRICT");
    expect(result.sql).not.toContain("ROWID");
  }
});

test("SQLite table options warn when the database would reject the table", () => {
  const editor = tablesEditor([
    {
      tableName: "events",
      columns: [
        {
          id: "id",
          name: "id",
          dataType: "integer",
          pk: true,
          autoIncrement: true,
        },
        { id: "at", name: "at", dataType: "timestamp" },
        { id: "price", name: "price", dataType: "decimal(10,2)" },
        { id: "payload", name: "payload", dataType: "any" },
      ],
      sqlite: { strict: true, withoutRowid: true },
    },
    {
      tableName: "log",
      columns: [{ id: "line", name: "line", dataType: "text" }],
      sqlite: { withoutRowid: true },
    },
  ]);
  const result = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(result.warnings).toEqual([
    "events.price: SQLite STRICT tables accept only INT, INTEGER, REAL, TEXT, BLOB or ANY columns, not NUMERIC; the database will reject this table.",
    "events.id: SQLite does not allow AUTOINCREMENT in WITHOUT ROWID tables; the database will reject this table.",
    "log: SQLite WITHOUT ROWID tables need a primary key; the database will reject this table.",
  ]);
  expect(result.sql).toContain(") STRICT, WITHOUT ROWID;");
  expect(result.sql).toContain(
    'CREATE TABLE "log" (\n  "line" TEXT NOT NULL\n) WITHOUT ROWID;',
  );
});

test("table and column comments use each dialect's comment syntax", () => {
  const editor = tablesEditor([
    {
      ...TAGS,
      columns: [
        ...TAGS.columns,
        { id: "path", name: "path", dataType: "TEXT", comment: "C:\\tags\\" },
        { id: "blank", name: "blank", dataType: "TEXT", comment: "  \n " },
      ],
    },
  ]);
  const postgresql = generateDatabaseDdl(
    editor,
    editor.currentPageId,
    "postgresql",
  );
  expect(postgresql.warnings).toEqual([]);
  expect(
    postgresql.sql,
  ).toContain(`  CONSTRAINT "pk_tags" PRIMARY KEY ("tag_id")
);
COMMENT ON TABLE "tags" IS E'Labels users attach to notes.\\n\\nTags nest through parent_tag_id.';
COMMENT ON COLUMN "tags"."name" IS 'Display name; it''s unique.';
COMMENT ON COLUMN "tags"."parent_tag_id" IS E'Parent tag.\\nNULL for a root tag.';
COMMENT ON COLUMN "tags"."path" IS E'C:\\\\tags\\\\';`);
  expect(postgresql.sql).not.toContain('"blank" IS');
  const mysql = generateDatabaseDdl(editor, editor.currentPageId, "mysql");
  expect(mysql.warnings).toEqual([]);
  expect(mysql.sql).toContain(
    "  `name` TEXT NOT NULL COMMENT 'Display name; it''s unique.',",
  );
  expect(mysql.sql).toContain(
    "  `parent_tag_id` INTEGER COMMENT 'Parent tag.\\nNULL for a root tag.',",
  );
  expect(mysql.sql).toContain(
    "  `path` TEXT NOT NULL COMMENT 'C:\\\\tags\\\\',",
  );
  expect(mysql.sql).toContain(
    ") ENGINE=InnoDB COMMENT='Labels users attach to notes.\\n\\nTags nest through parent_tag_id.';",
  );
  const sqlite = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(sqlite.sql).toContain(
    '  -- C:\\tags\\\n  "path" TEXT NOT NULL,\n  "blank"',
  );
});

test("comments cannot break out of SQL", () => {
  const hostile = "x';\nDROP TABLE tags; --\r*/ \\'";
  const editor = tablesEditor([
    {
      tableName: "tags",
      comment: hostile,
      columns: [
        {
          id: "id",
          name: "id",
          dataType: "integer",
          pk: true,
          comment: hostile,
        },
      ],
    },
  ]);
  const sqlite = generateDatabaseDdl(editor, editor.currentPageId, "sqlite");
  expect(sqlite.sql).toContain(`-- x';
-- DROP TABLE tags; --
-- */ \\'
CREATE TABLE "tags" (
  -- x';
  -- DROP TABLE tags; --
  -- */ \\'
  "id" INTEGER NOT NULL,`);
  const database = new Database(":memory:");
  try {
    database.exec(sqlite.sql);
    expect(
      database
        .query("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'")
        .get(),
    ).toEqual({ n: 1 });
  } finally {
    database.close();
  }
  expect(
    generateDatabaseDdl(editor, editor.currentPageId, "postgresql").sql,
  ).toContain(
    `COMMENT ON TABLE "tags" IS E'x'';\\nDROP TABLE tags; --\\n*/ \\\\''';`,
  );
  expect(
    generateDatabaseDdl(editor, editor.currentPageId, "mysql").sql,
  ).toContain(`COMMENT='x'';\\nDROP TABLE tags; --\\n*/ \\\\''';`);
});

test("MySQL comments over the documented length limits are flagged", () => {
  const editor = tablesEditor([
    {
      tableName: "notes",
      comment: "t".repeat(2049),
      columns: [
        {
          id: "id",
          name: "id",
          dataType: "integer",
          pk: true,
          comment: "c".repeat(1025),
        },
      ],
    },
  ]);
  expect(
    generateDatabaseDdl(editor, editor.currentPageId, "mysql").warnings,
  ).toEqual([
    "notes.id: the comment is longer than MySQL's 1024-character column comment limit.",
    "notes: the comment is longer than MySQL's 2048-character table comment limit.",
  ]);
  expect(
    generateDatabaseDdl(editor, editor.currentPageId, "postgresql").warnings,
  ).toEqual([]);
});
