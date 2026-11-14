import { expandContainers } from "./frame-tree.ts";
import { databaseObjectsDdl } from "./database-objects-ddl.ts";
import type {
  Element,
  ErdColumn,
  ErdRelationSemantic,
  ErdTableSemantic,
  PageId,
} from "@nodetto/ir";
import { erdEndpointColumnIds } from "@nodetto/ir";
import type { Editor } from "./editor.ts";
import {
  comment,
  commentLines,
  commentText,
  constraintStem,
  type DatabaseDialect,
  MYSQL_COMMENT_LIMIT,
  mysqlString,
  postgresqlString,
  quoteIdentifier,
} from "./database-ddl/dialect.ts";
import {
  defaultFor,
  generatedFor,
  SQLITE_STRICT_TYPES,
  typeFor,
} from "./database-ddl/columns.ts";
import {
  deferrabilityClause,
  isUniqueKey,
  referentialActionClause,
} from "./database-ddl/constraints.ts";
import {
  dialectIncompatibility,
  expressionProblem,
  scanExpression,
} from "./database-ddl/expressions.ts";

export {
  DATABASE_DIALECTS,
  type DatabaseDialect,
} from "./database-ddl/dialect.ts";
export { MAX_SQL_EXPRESSION_LENGTH } from "./database-ddl/expressions.ts";

export interface DatabaseDdl {
  readonly dialect: DatabaseDialect;
  readonly sql: string;
  readonly warnings: readonly string[];
  readonly tableCount: number;
  readonly objectCount: number;
  readonly relationCount: number;
  readonly indexCount: number;
  readonly checkCount: number;
}

interface TableModel {
  readonly element: Element;
  readonly semantic: ErdTableSemantic;
  readonly constraints: string[];
  readonly foreignConstraints: string[];
}

/** Deterministic, read-only SQL schema export for one ERD page. */
export function generateDatabaseDdl(
  editor: Editor,
  pageId: PageId,
  dialect: DatabaseDialect,
  options: { readonly frameId?: string } = {},
): DatabaseDdl {
  const warnings: string[] = [];
  // Schema output never follows canvas stacking order. Composite/column order
  // remains authored because those positions carry database semantics.
  const compare = (a: string, b: string): number =>
    a < b ? -1 : a > b ? 1 : 0;
  const pageElements = editor.store.getPageElements(pageId);
  let elements = [...pageElements];
  if (options.frameId !== undefined) {
    const frame = editor.store.get(options.frameId);
    if (frame?.type !== "frame" || frame.page !== pageId)
      throw new Error("DDL scope must be a frame on the selected page.");
    const included = new Set(
      expandContainers(editor.store, [frame.id], editor.createShapeContext(1)),
    );
    elements = elements.filter((element) => {
      if (included.has(element.id)) return true;
      if (element.type !== "erd.relation") return false;
      const relation = element.semantic as ErdRelationSemantic;
      return (
        included.has(relation.from.table) || included.has(relation.to.table)
      );
    });
  }
  const tableSemantic = new Map(
    elements
      .filter((element) => element.type === "erd.table")
      .map((element) => [element.id, element.semantic as ErdTableSemantic]),
  );
  const schemaKey = (element: Element): string => {
    if (element.type === "erd.table")
      return (element.semantic as ErdTableSemantic).tableName;
    if (element.type !== "erd.relation") return element.type;
    const relation = element.semantic as ErdRelationSemantic;
    const endpoint = (end: ErdRelationSemantic["from"]) => {
      const table = tableSemantic.get(end.table);
      return [
        table?.tableName ?? end.table,
        erdEndpointColumnIds(end).map(
          (id) => table?.columns.find((column) => column.id === id)?.name ?? id,
        ),
      ];
    };
    return JSON.stringify([
      endpoint(relation.from),
      endpoint(relation.to),
      relation.cardinality,
      relation.onDelete ?? "",
      relation.onUpdate ?? "",
      relation.deferrability ?? "",
    ]);
  };
  elements.sort(
    (a, b) => compare(schemaKey(a), schemaKey(b)) || compare(a.id, b.id),
  );
  const tables: TableModel[] = elements
    .filter((element) => element.type === "erd.table")
    .map((element) => ({
      element,
      semantic: element.semantic as ErdTableSemantic,
      constraints: [],
      foreignConstraints: [],
    }));
  const relations = elements.filter(
    (element) => element.type === "erd.relation",
  );
  const tablesById = new Map(tables.map((table) => [table.element.id, table]));
  const tableNames = new Set<string>();
  for (const table of tables) {
    const key = table.semantic.tableName.toLocaleLowerCase("en-US");
    if (tableNames.has(key))
      warnings.push(`Duplicate table name: ${table.semantic.tableName}.`);
    tableNames.add(key);
    const columnNames = new Set<string>();
    for (const column of table.semantic.columns) {
      const columnKey = column.name.toLocaleLowerCase("en-US");
      if (columnNames.has(columnKey))
        warnings.push(
          `${table.semantic.tableName}: duplicate column name ${column.name}.`,
        );
      columnNames.add(columnKey);
    }
  }

  const usedConstraintNames = new Set<string>();
  const constraintName = (preferred: string, explicit = false): string => {
    if (explicit) {
      const key = preferred.toLocaleLowerCase("en-US");
      if (usedConstraintNames.has(key))
        warnings.push(`Duplicate constraint name: ${preferred}.`);
      if (
        dialect === "postgresql" &&
        new TextEncoder().encode(preferred).length > 63
      )
        warnings.push(
          `Constraint name ${preferred} exceeds PostgreSQL's 63-byte identifier limit and may be truncated by the database.`,
        );
      usedConstraintNames.add(key);
      return quoteIdentifier(preferred, dialect);
    }
    const base = constraintStem(preferred);
    let candidate = base;
    let suffix = 2;
    while (usedConstraintNames.has(candidate)) {
      candidate = `${base.slice(0, 55 - String(suffix).length - 1)}_${suffix}`;
      suffix += 1;
    }
    usedConstraintNames.add(candidate);
    return quoteIdentifier(candidate, dialect);
  };

  for (const table of tables) {
    for (const check of [...(table.semantic.checks ?? [])].sort(
      (a, b) =>
        compare(a.name ?? a.expression, b.name ?? b.expression) ||
        compare(a.expression, b.expression),
    )) {
      const expression = check.expression.trim();
      const subject = `${table.semantic.tableName}: check ${check.name?.trim() || check.id}`;
      const problem = expressionProblem(expression, dialect);
      if (problem) {
        warnings.push(
          `${subject} was omitted because its expression ${problem}.`,
        );
        continue;
      }
      const incompatibility = dialectIncompatibility(
        expression,
        dialect,
        subject,
      );
      if (incompatibility) warnings.push(incompatibility);
      table.constraints.push(
        `CONSTRAINT ${constraintName(check.name?.trim() || `ck_${table.semantic.tableName}_${check.id}`, Boolean(check.name?.trim()))} CHECK (${scanExpression(expression)?.normalized ?? expression})`,
      );
    }
  }

  for (const relation of relations) {
    const semantic = relation.semantic as ErdRelationSemantic;
    // Logical references document a join path the database does not
    // enforce; they deliberately produce no constraint.
    if (semantic.logical === true) continue;
    if (semantic.cardinality === "*:*") {
      warnings.push(
        `${relation.id}: many-to-many relation requires an explicit junction table.`,
      );
      continue;
    }
    const localEnd =
      semantic.cardinality === "*:1" ? semantic.from : semantic.to;
    const remoteEnd =
      semantic.cardinality === "*:1" ? semantic.to : semantic.from;
    const local = tablesById.get(localEnd.table);
    const remote = tablesById.get(remoteEnd.table);
    // The constraint belongs to the referencing table, not its target.
    if (options.frameId !== undefined && !local) continue;
    if (!local || !remote) {
      warnings.push(
        `${relation.id}: relation references a table outside ${options.frameId === undefined ? "this page" : "the selected frame"}; constraint omitted.`,
      );
      continue;
    }
    const localColumnIds = erdEndpointColumnIds(localEnd);
    const remoteColumnIds = erdEndpointColumnIds(remoteEnd);
    if (!localColumnIds.length || !remoteColumnIds.length) {
      warnings.push(
        `${relation.id}: relation needs a column at both endpoints.`,
      );
      continue;
    }
    if (
      new Set(localColumnIds).size !== localColumnIds.length ||
      new Set(remoteColumnIds).size !== remoteColumnIds.length
    ) {
      warnings.push(
        `${relation.id}: foreign-key endpoints repeat a column; the constraint was omitted.`,
      );
      continue;
    }
    if (localColumnIds.length !== remoteColumnIds.length) {
      warnings.push(
        `${relation.id}: foreign-key endpoints contain different numbers of columns.`,
      );
      continue;
    }
    const localColumns = localColumnIds
      .map((id) => local.semantic.columns.find((column) => column.id === id))
      .filter((column): column is ErdColumn => column !== undefined);
    const remoteColumns = remoteColumnIds
      .map((id) => remote.semantic.columns.find((column) => column.id === id))
      .filter((column): column is ErdColumn => column !== undefined);
    if (
      localColumns.length !== localColumnIds.length ||
      remoteColumns.length !== remoteColumnIds.length
    ) {
      warnings.push(`${relation.id}: relation references a missing column.`);
      continue;
    }
    for (const localColumn of localColumns) {
      if (semantic.onDelete === "set-null" && !localColumn.nullable)
        warnings.push(
          `${relation.id}: ON DELETE SET NULL targets non-nullable column ${local.semantic.tableName}.${localColumn.name}.`,
        );
      if (semantic.onUpdate === "set-null" && !localColumn.nullable)
        warnings.push(
          `${relation.id}: ON UPDATE SET NULL targets non-nullable column ${local.semantic.tableName}.${localColumn.name}.`,
        );
      if (
        (semantic.onDelete === "set-default" ||
          semantic.onUpdate === "set-default") &&
        !localColumn.defaultExpression?.trim()
      )
        warnings.push(
          `${relation.id}: SET DEFAULT targets ${local.semantic.tableName}.${localColumn.name}, which has no authored default expression.`,
        );
    }
    if (!isUniqueKey(remote.semantic, remoteColumnIds))
      warnings.push(
        `${relation.id}: referenced columns ${remote.semantic.tableName}.(${remoteColumns.map((column) => column.name).join(", ")}) are not a primary or matching unique key.`,
      );
    const name = constraintName(
      `fk_${local.semantic.tableName}_${localColumns.map((column) => column.name).join("_")}_${remote.semantic.tableName}`,
    );
    local.foreignConstraints.push(
      `CONSTRAINT ${name} FOREIGN KEY (${localColumns.map((column) => quoteIdentifier(column.name, dialect)).join(", ")}) REFERENCES ${quoteIdentifier(remote.semantic.tableName, dialect)} (${remoteColumns.map((column) => quoteIdentifier(column.name, dialect)).join(", ")})${referentialActionClause(semantic.onDelete, "DELETE", dialect, relation.id, warnings)}${referentialActionClause(semantic.onUpdate, "UPDATE", dialect, relation.id, warnings)}${deferrabilityClause(semantic.deferrability, dialect, relation.id, warnings)}`,
    );
    if (
      semantic.cardinality === "1:1" &&
      !isUniqueKey(local.semantic, localColumnIds)
    )
      local.constraints.push(
        `CONSTRAINT ${constraintName(`uq_${local.semantic.tableName}_${localColumns.map((column) => column.name).join("_")}`)} UNIQUE (${localColumns.map((column) => quoteIdentifier(column.name, dialect)).join(", ")})`,
      );
  }

  const statements = tables.map((table) => {
    if (!table.semantic.columns.length) {
      warnings.push(`${table.semantic.tableName}: table has no columns.`);
      return `-- Skipped empty table ${comment(quoteIdentifier(table.semantic.tableName, dialect))}.`;
    }
    const tableName = table.semantic.tableName;
    const sqlite = dialect === "sqlite" ? table.semantic.sqlite : undefined;
    const definitions = table.semantic.columns.map((column) => {
      const type = typeFor(column, dialect, warnings, tableName);
      if (sqlite?.strict && !SQLITE_STRICT_TYPES.test(type))
        warnings.push(
          `${tableName}.${column.name}: SQLite STRICT tables accept only INT, INTEGER, REAL, TEXT, BLOB or ANY columns, not ${type}; the database will reject this table.`,
        );
      const parts = [quoteIdentifier(column.name, dialect), type];
      if (column.autoIncrement) {
        if (dialect === "sqlite")
          parts.splice(1, 1, "INTEGER PRIMARY KEY AUTOINCREMENT");
        else
          parts.push(
            dialect === "mysql"
              ? "AUTO_INCREMENT"
              : column.identityGeneration === "always"
                ? "GENERATED ALWAYS AS IDENTITY"
                : "GENERATED BY DEFAULT AS IDENTITY",
          );
      }
      if (!column.nullable || column.pk) parts.push("NOT NULL");
      const generatedExpression = generatedFor(
        column,
        dialect,
        warnings,
        table.semantic.tableName,
      );
      if (generatedExpression) {
        parts.push("GENERATED ALWAYS AS", `(${generatedExpression})`, "STORED");
        if (column.defaultExpression?.trim())
          warnings.push(
            `${table.semantic.tableName}.${column.name}: default expression was omitted because the column is generated.`,
          );
      } else {
        const defaultExpression = defaultFor(
          column,
          dialect,
          warnings,
          table.semantic.tableName,
        );
        if (defaultExpression) parts.push("DEFAULT", defaultExpression);
      }
      const note = column.comment?.trim();
      if (note && dialect === "mysql") {
        parts.push("COMMENT", mysqlString(note));
        if ([...commentText(note)].length > MYSQL_COMMENT_LIMIT.column)
          warnings.push(
            `${tableName}.${column.name}: the comment is longer than MySQL's ${MYSQL_COMMENT_LIMIT.column}-character column comment limit.`,
          );
      }
      // A comment line ends at the line break, before the next definition's
      // comma separator.
      return [
        ...(dialect === "sqlite" ? commentLines(note, "  ") : []),
        `  ${parts.join(" ")}`,
      ].join("\n");
    });
    const primary = table.semantic.columns.filter((column) => column.pk);
    if (
      primary.length &&
      !(dialect === "sqlite" && primary.some((column) => column.autoIncrement))
    )
      definitions.push(
        `  CONSTRAINT ${constraintName(`pk_${table.semantic.tableName}`)} PRIMARY KEY (${primary.map((column) => quoteIdentifier(column.name, dialect)).join(", ")})`,
      );
    definitions.push(...table.constraints.map((value) => `  ${value}`));
    if (dialect === "sqlite")
      definitions.push(
        ...table.foreignConstraints.map((value) => `  ${value}`),
      );
    if (sqlite?.withoutRowid) {
      if (!primary.length)
        warnings.push(
          `${tableName}: SQLite WITHOUT ROWID tables need a primary key; the database will reject this table.`,
        );
      for (const column of primary.filter((item) => item.autoIncrement))
        warnings.push(
          `${tableName}.${column.name}: SQLite does not allow AUTOINCREMENT in WITHOUT ROWID tables; the database will reject this table.`,
        );
    }
    const note = table.semantic.comment?.trim();
    // SQLite separates table options with commas: ") STRICT, WITHOUT ROWID".
    const suffix =
      dialect === "mysql"
        ? ` ENGINE=InnoDB${note ? ` COMMENT=${mysqlString(note)}` : ""}`
        : [
            ...(sqlite?.strict ? [" STRICT"] : []),
            ...(sqlite?.withoutRowid ? [" WITHOUT ROWID"] : []),
          ].join(",");
    if (
      dialect === "mysql" &&
      note &&
      [...commentText(note)].length > MYSQL_COMMENT_LIMIT.table
    )
      warnings.push(
        `${tableName}: the comment is longer than MySQL's ${MYSQL_COMMENT_LIMIT.table}-character table comment limit.`,
      );
    const quotedTable = quoteIdentifier(tableName, dialect);
    const postgresqlComments =
      dialect === "postgresql"
        ? [
            ...(note
              ? [
                  `COMMENT ON TABLE ${quotedTable} IS ${postgresqlString(note)};`,
                ]
              : []),
            ...table.semantic.columns.flatMap((column) => {
              const text = column.comment?.trim();
              return text
                ? [
                    `COMMENT ON COLUMN ${quotedTable}.${quoteIdentifier(column.name, dialect)} IS ${postgresqlString(text)};`,
                  ]
                : [];
            }),
          ]
        : [];
    return [
      ...(dialect === "sqlite" ? commentLines(note, "") : []),
      `CREATE TABLE ${quotedTable} (\n${definitions.join(",\n")}\n)${suffix};`,
      ...postgresqlComments,
    ].join("\n");
  });
  const foreignKeys =
    dialect === "sqlite"
      ? []
      : tables.flatMap((table) =>
          table.foreignConstraints.map(
            (constraint) =>
              `ALTER TABLE ${quoteIdentifier(table.semantic.tableName, dialect)} ADD ${constraint};`,
          ),
        );
  const usedIndexNames = new Set<string>();
  const allocateIndexName = (preferred: string, explicit: boolean): string => {
    if (explicit) {
      const key = preferred.toLocaleLowerCase("en-US");
      if (usedIndexNames.has(key))
        warnings.push(`Duplicate index name: ${preferred}.`);
      if (
        dialect === "postgresql" &&
        new TextEncoder().encode(preferred).length > 63
      )
        warnings.push(
          `Index name ${preferred} exceeds PostgreSQL's 63-byte identifier limit and may be truncated by the database.`,
        );
      usedIndexNames.add(key);
      return preferred;
    }
    const base = constraintStem(preferred);
    let candidate = base;
    let suffix = 2;
    while (usedIndexNames.has(candidate)) {
      candidate = `${base.slice(0, 55 - String(suffix).length - 1)}_${suffix}`;
      suffix += 1;
    }
    usedIndexNames.add(candidate);
    return candidate;
  };
  const indexes = tables.flatMap((table) =>
    [...(table.semantic.indexes ?? [])]
      .sort((a, b) => {
        const key = (index: typeof a) =>
          JSON.stringify([
            index.name ?? "",
            index.columns.map(
              (id) =>
                table.semantic.columns.find((column) => column.id === id)
                  ?.name ?? id,
            ),
            !!index.unique,
            index.where?.trim() ?? "",
          ]);
        return compare(key(a), key(b));
      })
      .flatMap((index) => {
        const seenColumns = new Set<string>();
        const columns = index.columns.flatMap((columnId) => {
          if (seenColumns.has(columnId)) {
            warnings.push(
              `${table.semantic.tableName}: index ${index.name || index.id} repeats column ${columnId}; the duplicate was omitted.`,
            );
            return [];
          }
          seenColumns.add(columnId);
          const column = table.semantic.columns.find(
            (candidate) => candidate.id === columnId,
          );
          if (!column)
            warnings.push(
              `${table.semantic.tableName}: index ${index.name || index.id} references missing column ${columnId}.`,
            );
          return column ? [column] : [];
        });
        if (!columns.length) {
          warnings.push(
            `${table.semantic.tableName}: index ${index.name || index.id} has no usable columns and was skipped.`,
          );
          return [];
        }
        const primary = table.semantic.columns
          .filter((column) => column.pk)
          .map((column) => column.id);
        if (
          primary.length === index.columns.length &&
          primary.every((columnId, at) => columnId === index.columns[at])
        ) {
          warnings.push(
            `${table.semantic.tableName}: index ${index.name || index.id} duplicates the primary key and was skipped.`,
          );
          return [];
        }
        // A partial unique index without its condition would reject rows the
        // model allows, so an index whose condition cannot be emitted is
        // omitted rather than widened.
        const condition = index.where?.trim() ?? "";
        const subject = `${table.semantic.tableName}: index ${index.name?.trim() || index.id}`;
        let where = "";
        if (condition) {
          if (dialect === "mysql") {
            warnings.push(
              `${subject} was omitted because MySQL does not support partial indexes (WHERE ${condition}).`,
            );
            return [];
          }
          const problem = expressionProblem(condition, dialect);
          if (problem) {
            warnings.push(
              `${subject} was omitted because its WHERE condition ${problem}.`,
            );
            return [];
          }
          const incompatibility = dialectIncompatibility(
            condition,
            dialect,
            subject,
          );
          if (incompatibility) warnings.push(incompatibility);
          where = ` WHERE ${scanExpression(condition)?.normalized ?? condition}`;
        }
        const explicitName = index.name?.trim() || undefined;
        const preferred =
          explicitName ||
          `${index.unique ? "uq" : "idx"}_${table.semantic.tableName}_${columns
            .map((column) => column.name)
            .join("_")}`;
        const name = allocateIndexName(preferred, explicitName !== undefined);
        return [
          `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(name, dialect)} ON ${quoteIdentifier(table.semantic.tableName, dialect)} (${columns.map((column) => quoteIdentifier(column.name, dialect)).join(", ")})${where};`,
        ];
      }),
  );
  const objects = databaseObjectsDdl(
    elements,
    dialect,
    (name) => quoteIdentifier(name, dialect),
    (dataType, name) =>
      typeFor({ id: name, name, dataType }, dialect, warnings, name),
  );
  warnings.push(...objects.warnings);
  if (!tables.length && !objects.count)
    warnings.push(
      "This page contains no ERD tables or database objects with exportable definitions.",
    );
  const header = [
    `-- Generated by nodetto for ${dialect}.`,
    "-- Review this migration before applying it to a database.",
    ...warnings.map((warning) => `-- Warning: ${comment(warning)}`),
  ];
  const sql = [
    ...header,
    ...(dialect === "sqlite" && tables.length
      ? ["", "PRAGMA foreign_keys = ON;"]
      : []),
    ...(statements.length ? ["", statements.join("\n\n")] : []),
    ...(indexes.length ? ["", indexes.join("\n")] : []),
    ...(foreignKeys.length ? ["", foreignKeys.join("\n")] : []),
    ...(objects.statements.length ? ["", objects.statements.join("\n\n")] : []),
    "",
  ].join("\n");
  return {
    dialect,
    sql,
    warnings,
    tableCount: tables.length,
    objectCount: objects.count,
    relationCount: relations.length,
    indexCount: tables.reduce(
      (count, table) => count + (table.semantic.indexes?.length ?? 0),
      0,
    ),
    checkCount: tables.reduce(
      (count, table) => count + (table.semantic.checks?.length ?? 0),
      0,
    ),
  };
}
