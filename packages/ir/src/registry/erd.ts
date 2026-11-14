// ERD table and relation definitions with their endpoint helpers.

import {
  checkArray,
  checkBoolean,
  checkEnum,
  checkObject,
  checkString,
} from "../checks.ts";
import { error, type ValidationIssue } from "../issues.ts";
import {
  CARDINALITIES,
  FOREIGN_KEY_DEFERRABILITIES,
  REFERENTIAL_ACTIONS,
} from "../semantics.ts";
import {
  noReferences,
  read,
  type ElementReference,
  type ElementTypeDefinition,
} from "./definition.ts";
import { validateConnectorRouting } from "./generic.ts";

function validateErdEndpoint(
  out: ValidationIssue[],
  value: unknown,
  path: string,
): void {
  if (!checkObject(out, value, path)) {
    return;
  }
  checkString(out, value["table"], `${path}.table`);
  checkString(out, value["column"], `${path}.column`, { optional: true });
  const columns = value["columns"];
  if (columns !== undefined && checkArray(out, columns, `${path}.columns`)) {
    const seen = new Set<string>();
    for (const [index, column] of columns.entries()) {
      const at = `${path}.columns[${index}]`;
      if (checkString(out, column, at)) {
        if (seen.has(column as string))
          out.push(
            error(
              "id.duplicate",
              at,
              `duplicate endpoint column id "${column as string}"`,
            ),
          );
        seen.add(column as string);
      }
    }
    if (columns.length === 0)
      out.push(
        error(
          "erd.emptyEndpointColumns",
          `${path}.columns`,
          "composite endpoint columns must not be empty",
        ),
      );
  }
  if (value["column"] !== undefined && columns !== undefined)
    out.push(
      error(
        "erd.endpointColumnConflict",
        path,
        "an ERD endpoint cannot use both column and columns",
      ),
    );
}

function endpointColumnCount(value: unknown): number {
  if (typeof value !== "object" || value === null) return 0;
  const endpoint = value as Record<string, unknown>;
  if (Array.isArray(endpoint["columns"])) return endpoint["columns"].length;
  return typeof endpoint["column"] === "string" ? 1 : 0;
}

function endpointRef(
  semantic: unknown,
  field: string,
): readonly ElementReference[] {
  const table = read(read(semantic, field), "table");
  if (typeof table === "string" && table.length > 0) {
    return [{ field: `${field}.table`, id: table }];
  }
  return [];
}

export const ERD_TABLE: ElementTypeDefinition = {
  type: "erd.table",
  category: "node",
  keyOrder: {
    keys: ["tableName", "comment", "columns", "indexes", "checks", "sqlite"],
    children: {
      columns: {
        keys: [
          "id",
          "name",
          "dataType",
          "pk",
          "nullable",
          "autoIncrement",
          "identityGeneration",
          "defaultExpression",
          "generatedExpression",
          "comment",
        ],
      },
      indexes: { keys: ["id", "name", "columns", "unique", "where"] },
      checks: { keys: ["id", "name", "expression"] },
      sqlite: { keys: ["strict", "withoutRowid"] },
    },
  },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) {
      return out;
    }
    checkString(out, semantic["tableName"], `${path}.tableName`);
    checkString(out, semantic["comment"], `${path}.comment`, {
      optional: true,
      allowEmpty: true,
    });
    const sqlite = semantic["sqlite"];
    if (sqlite !== undefined && checkObject(out, sqlite, `${path}.sqlite`))
      for (const option of ["strict", "withoutRowid"])
        checkBoolean(out, sqlite[option], `${path}.sqlite.${option}`, {
          optional: true,
        });
    const columns = semantic["columns"];
    if (!checkArray(out, columns, `${path}.columns`)) {
      return out;
    }
    const seen = new Set<string>();
    for (const [i, column] of columns.entries()) {
      const at = `${path}.columns[${i}]`;
      if (!checkObject(out, column, at)) {
        continue;
      }
      if (checkString(out, column["id"], `${at}.id`)) {
        const id = column["id"] as string;
        if (seen.has(id)) {
          out.push({
            severity: "error",
            code: "id.duplicate",
            path: `${at}.id`,
            message: `duplicate column id "${id}"`,
          });
        }
        seen.add(id);
      }
      checkString(out, column["name"], `${at}.name`);
      checkString(out, column["dataType"], `${at}.dataType`);
      checkBoolean(out, column["pk"], `${at}.pk`, { optional: true });
      checkBoolean(out, column["autoIncrement"], `${at}.autoIncrement`, {
        optional: true,
      });
      checkEnum(
        out,
        column["identityGeneration"],
        `${at}.identityGeneration`,
        ["always", "by-default"],
        { optional: true },
      );
      if (
        column["identityGeneration"] !== undefined &&
        column["autoIncrement"] !== true
      )
        out.push(
          error(
            "erd.identity",
            at,
            "identityGeneration requires autoIncrement",
          ),
        );
      if (
        column["autoIncrement"] === true &&
        (column["pk"] !== true ||
          !/^(?:int|integer|smallint|bigint|int2|int4|int8)$/i.test(
            String(column["dataType"]).trim(),
          ) ||
          columns.filter(
            (item) =>
              typeof item === "object" &&
              item !== null &&
              "pk" in item &&
              item.pk === true,
          ).length !== 1 ||
          column["nullable"] === true ||
          !!column["defaultExpression"] ||
          !!column["generatedExpression"])
      )
        out.push(
          error(
            "erd.identity",
            at,
            "auto-increment requires one integer primary key without nullability, default or generated expression",
          ),
        );
      checkBoolean(out, column["nullable"], `${at}.nullable`, {
        optional: true,
      });
      checkString(out, column["defaultExpression"], `${at}.defaultExpression`, {
        optional: true,
      });
      checkString(
        out,
        column["generatedExpression"],
        `${at}.generatedExpression`,
        { optional: true },
      );
      checkString(out, column["comment"], `${at}.comment`, {
        optional: true,
        allowEmpty: true,
      });
      if (
        typeof column["defaultExpression"] === "string" &&
        column["defaultExpression"].trim() !== "" &&
        typeof column["generatedExpression"] === "string" &&
        column["generatedExpression"].trim() !== ""
      )
        out.push(
          error(
            "erd.columnExpressionConflict",
            at,
            "a column cannot have both a default and a generated expression",
          ),
        );
      if (
        column["pk"] === true &&
        typeof column["generatedExpression"] === "string" &&
        column["generatedExpression"].trim() !== ""
      )
        out.push(
          error(
            "erd.generatedPrimaryKey",
            at,
            "a portable generated column cannot be a primary key",
          ),
        );
    }
    const indexes = semantic["indexes"];
    if (indexes !== undefined && checkArray(out, indexes, `${path}.indexes`)) {
      const seenIndexes = new Set<string>();
      for (const [i, index] of indexes.entries()) {
        const at = `${path}.indexes[${i}]`;
        if (!checkObject(out, index, at)) continue;
        if (checkString(out, index["id"], `${at}.id`)) {
          const id = index["id"] as string;
          if (seenIndexes.has(id))
            out.push(
              error("id.duplicate", `${at}.id`, `duplicate index id "${id}"`),
            );
          seenIndexes.add(id);
        }
        checkString(out, index["name"], `${at}.name`, {
          optional: true,
        });
        const indexedColumns = index["columns"];
        if (checkArray(out, indexedColumns, `${at}.columns`)) {
          const seenColumns = new Set<string>();
          for (const [columnIndex, columnId] of indexedColumns.entries()) {
            const columnPath = `${at}.columns[${columnIndex}]`;
            if (checkString(out, columnId, columnPath)) {
              if (seenColumns.has(columnId as string))
                out.push(
                  error(
                    "id.duplicate",
                    columnPath,
                    `duplicate indexed column id "${columnId as string}"`,
                  ),
                );
              if (!seen.has(columnId as string))
                out.push(
                  error(
                    "erd.indexColumn",
                    columnPath,
                    `index references unknown column id "${columnId as string}"`,
                  ),
                );
              seenColumns.add(columnId as string);
            }
          }
        }
        checkBoolean(out, index["unique"], `${at}.unique`, {
          optional: true,
        });
        checkString(out, index["where"], `${at}.where`, { optional: true });
      }
    }
    const checks = semantic["checks"];
    if (checks !== undefined && checkArray(out, checks, `${path}.checks`)) {
      const seenChecks = new Set<string>();
      for (const [i, check] of checks.entries()) {
        const at = `${path}.checks[${i}]`;
        if (!checkObject(out, check, at)) continue;
        if (checkString(out, check["id"], `${at}.id`)) {
          const id = check["id"] as string;
          if (seenChecks.has(id))
            out.push(
              error("id.duplicate", `${at}.id`, `duplicate check id "${id}"`),
            );
          seenChecks.add(id);
        }
        checkString(out, check["name"], `${at}.name`, { optional: true });
        checkString(out, check["expression"], `${at}.expression`);
      }
    }
    return out;
  },
};

export const ERD_RELATION: ElementTypeDefinition = {
  type: "erd.relation",
  category: "edge",
  keyOrder: {
    keys: [
      "from",
      "to",
      "cardinality",
      "onDelete",
      "onUpdate",
      "deferrability",
      "logical",
      "label",
      "routing",
      "routingAxis",
      "routingBend",
      "routingAvoidObstacles",
      "routingWaypoints",
      "fromPort",
      "toPort",
    ],
    children: {
      routingWaypoints: { keys: ["u", "v"] },
      from: { keys: ["table", "column", "columns"] },
      to: { keys: ["table", "column", "columns"] },
    },
  },
  onReferenceDeleted: "cascade",
  references: (semantic) => [
    ...endpointRef(semantic, "from"),
    ...endpointRef(semantic, "to"),
  ],
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) {
      return out;
    }
    validateErdEndpoint(out, semantic["from"], `${path}.from`);
    validateErdEndpoint(out, semantic["to"], `${path}.to`);
    const fromColumns = endpointColumnCount(semantic["from"]);
    const toColumns = endpointColumnCount(semantic["to"]);
    if (fromColumns > 0 && toColumns > 0 && fromColumns !== toColumns)
      out.push(
        error(
          "erd.foreignKeyArity",
          path,
          "foreign-key endpoints must contain the same number of columns",
        ),
      );
    checkEnum(
      out,
      semantic["cardinality"],
      `${path}.cardinality`,
      CARDINALITIES,
    );
    checkEnum(
      out,
      semantic["onDelete"],
      `${path}.onDelete`,
      REFERENTIAL_ACTIONS,
      { optional: true },
    );
    checkEnum(
      out,
      semantic["onUpdate"],
      `${path}.onUpdate`,
      REFERENTIAL_ACTIONS,
      { optional: true },
    );
    checkEnum(
      out,
      semantic["deferrability"],
      `${path}.deferrability`,
      FOREIGN_KEY_DEFERRABILITIES,
      { optional: true },
    );
    checkBoolean(out, semantic["logical"], `${path}.logical`, {
      optional: true,
    });
    checkString(out, semantic["label"], `${path}.label`, {
      optional: true,
      allowEmpty: true,
    });
    validateConnectorRouting(out, semantic, path);
    return out;
  },
};
