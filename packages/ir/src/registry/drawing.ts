// Freehand strokes, vector paths, geometric shapes, text notes, review
// comments and reusable text styles.

import {
  checkArray,
  checkBoolean,
  checkEnum,
  checkFontSettings,
  checkNumber,
  checkObject,
  checkString,
} from "../checks.ts";
import { error, type ValidationIssue } from "../issues.ts";
import {
  GEO_KINDS,
  MAX_PATH_CONTOURS,
  MAX_PATH_POINTS,
  PATH_FILL_RULES,
  TEXT_MARK_KINDS,
} from "../semantics.ts";
import {
  noReferences,
  refFields,
  type ElementTypeDefinition,
} from "./definition.ts";

export const DRAW_FREEHAND: ElementTypeDefinition = {
  type: "draw.freehand",
  category: "annotation",
  keyOrder: {
    keys: ["points", "closed"],
    children: {
      points: {
        keys: ["x", "y", "pressure", "controlIn", "controlOut"],
        coordinates: ["x", "y"],
        children: {
          controlIn: { keys: ["x", "y"], coordinates: ["x", "y"] },
          controlOut: { keys: ["x", "y"], coordinates: ["x", "y"] },
        },
      },
    },
  },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) {
      return out;
    }
    const points = semantic["points"];
    checkBoolean(out, semantic["closed"], `${path}.closed`, { optional: true });
    if (!checkArray(out, points, `${path}.points`)) {
      return out;
    }
    for (const [i, point] of points.entries()) {
      const at = `${path}.points[${i}]`;
      if (!checkObject(out, point, at)) {
        continue;
      }
      checkNumber(out, point["x"], `${at}.x`);
      checkNumber(out, point["y"], `${at}.y`);
      for (const field of ["controlIn", "controlOut"]) {
        const control = point[field];
        if (
          control !== undefined &&
          checkObject(out, control, `${at}.${field}`)
        ) {
          checkNumber(out, control["x"], `${at}.${field}.x`);
          checkNumber(out, control["y"], `${at}.${field}.y`);
        }
      }
      checkNumber(out, point["pressure"], `${at}.pressure`, {
        optional: true,
      });
    }
    return out;
  },
};

export const DRAW_PATH: ElementTypeDefinition = {
  type: "draw.path",
  category: "annotation",
  keyOrder: {
    keys: ["name", "contours", "fillRule"],
    children: {
      contours: {
        keys: ["points"],
        children: {
          points: {
            keys: ["x", "y", "pressure", "controlIn", "controlOut"],
            coordinates: ["x", "y"],
            children: {
              controlIn: { keys: ["x", "y"], coordinates: ["x", "y"] },
              controlOut: { keys: ["x", "y"], coordinates: ["x", "y"] },
            },
          },
        },
      },
    },
  },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) return out;
    checkString(out, semantic["name"], `${path}.name`, { optional: true });
    checkEnum(out, semantic["fillRule"], `${path}.fillRule`, PATH_FILL_RULES);
    const contours = semantic["contours"];
    if (!checkArray(out, contours, `${path}.contours`)) return out;
    if (contours.length === 0 || contours.length > MAX_PATH_CONTOURS)
      out.push(
        error(
          "path.contours",
          `${path}.contours`,
          `expected between 1 and ${MAX_PATH_CONTOURS} contours`,
        ),
      );
    let total = 0;
    for (const [contourIndex, contour] of contours.entries()) {
      const contourPath = `${path}.contours[${contourIndex}]`;
      if (!checkObject(out, contour, contourPath)) continue;
      const points = contour["points"];
      if (!checkArray(out, points, `${contourPath}.points`)) continue;
      total += points.length;
      if (points.length < 3)
        out.push(
          error(
            "path.points",
            `${contourPath}.points`,
            "a closed contour requires at least three points",
          ),
        );
      for (const [pointIndex, point] of points.entries()) {
        const at = `${contourPath}.points[${pointIndex}]`;
        if (!checkObject(out, point, at)) continue;
        checkNumber(out, point["x"], `${at}.x`);
        checkNumber(out, point["y"], `${at}.y`);
        checkNumber(out, point["pressure"], `${at}.pressure`, {
          optional: true,
        });
        for (const field of ["controlIn", "controlOut"]) {
          const control = point[field];
          if (
            control !== undefined &&
            checkObject(out, control, `${at}.${field}`)
          ) {
            checkNumber(out, control["x"], `${at}.${field}.x`);
            checkNumber(out, control["y"], `${at}.${field}.y`);
          }
        }
      }
    }
    if (total > MAX_PATH_POINTS)
      out.push(
        error(
          "path.points",
          `${path}.contours`,
          `a compound path may contain at most ${MAX_PATH_POINTS} points`,
        ),
      );
    return out;
  },
};

export const SHAPE_GEO: ElementTypeDefinition = {
  type: "shape.geo",
  category: "node",
  keyOrder: { keys: ["geo", "label"] },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      checkEnum(out, semantic["geo"], `${path}.geo`, GEO_KINDS);
      checkString(out, semantic["label"], `${path}.label`, {
        optional: true,
        allowEmpty: true,
      });
    }
    return out;
  },
};

export const TEXT_NOTE: ElementTypeDefinition = {
  type: "text.note",
  category: "annotation",
  keyOrder: {
    keys: ["text", "marks"],
    children: { marks: { keys: ["start", "end", "kind", "href"] } },
  },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) {
      return out;
    }
    const textOk = checkString(out, semantic["text"], `${path}.text`, {
      allowEmpty: true,
    });
    const length = textOk ? (semantic["text"] as string).length : undefined;
    const marks = semantic["marks"];
    if (marks === undefined) {
      return out;
    }
    if (!checkArray(out, marks, `${path}.marks`)) {
      return out;
    }
    for (const [i, mark] of marks.entries()) {
      const at = `${path}.marks[${i}]`;
      if (!checkObject(out, mark, at)) {
        continue;
      }
      const startOk = checkNumber(out, mark["start"], `${at}.start`, {
        integer: true,
        min: 0,
      });
      const endOk = checkNumber(out, mark["end"], `${at}.end`, {
        integer: true,
        min: 0,
      });
      const kindOk = checkEnum(
        out,
        mark["kind"],
        `${at}.kind`,
        TEXT_MARK_KINDS,
      );
      const hrefOk = checkString(out, mark["href"], `${at}.href`, {
        optional: true,
      });
      if (!startOk || !endOk) {
        continue;
      }
      const start = mark["start"] as number;
      const end = mark["end"] as number;
      if (end < start) {
        out.push({
          severity: "error",
          code: "range.inverted",
          path: at,
          message: "mark end must not precede mark start",
        });
      }
      if (end === start) {
        out.push({
          severity: "error",
          code: "range.empty",
          path: at,
          message: "mark range must contain at least one character",
        });
      }
      if (length !== undefined && end > length) {
        out.push({
          severity: "error",
          code: "range.overflow",
          path: `${at}.end`,
          message: `mark end ${end} exceeds text length ${length}`,
        });
      }
      if (kindOk && mark["kind"] === "link" && mark["href"] === undefined) {
        out.push({
          severity: "error",
          code: "field.missing",
          path: `${at}.href`,
          message: "link marks require a destination",
        });
      }
      if (
        kindOk &&
        hrefOk &&
        mark["kind"] !== "link" &&
        mark["href"] !== undefined
      ) {
        out.push({
          severity: "error",
          code: "field.unexpected",
          path: `${at}.href`,
          message: "only link marks may carry a destination",
        });
      }
    }
    return out;
  },
};

export const REVIEW_COMMENT: ElementTypeDefinition = {
  type: "review.comment",
  category: "resource",
  keyOrder: {
    keys: ["target", "resolved", "messages"],
    children: { messages: { keys: ["id", "author", "body", "createdAt"] } },
  },
  onReferenceDeleted: "detach",
  references: (semantic) => refFields(semantic, ["target"]),
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) return out;
    checkString(out, semantic["target"], `${path}.target`, { optional: true });
    checkBoolean(out, semantic["resolved"], `${path}.resolved`, {
      optional: true,
    });
    const messages = semantic["messages"];
    if (!checkArray(out, messages, `${path}.messages`)) return out;
    if (messages.length === 0)
      out.push(
        error(
          "comment.empty",
          `${path}.messages`,
          "a comment thread needs a message",
        ),
      );
    const ids = new Set<string>();
    for (const [index, message] of messages.entries()) {
      const at = `${path}.messages[${index}]`;
      if (!checkObject(out, message, at)) continue;
      for (const field of ["id", "author", "body", "createdAt"] as const)
        checkString(out, message[field], `${at}.${field}`);
      if (typeof message["id"] === "string") {
        if (ids.has(message["id"]))
          out.push(
            error(
              "comment.messageDuplicate",
              `${at}.id`,
              "message ids must be unique within a thread",
            ),
          );
        ids.add(message["id"]);
      }
      if (
        typeof message["createdAt"] === "string" &&
        !Number.isFinite(Date.parse(message["createdAt"]))
      )
        out.push(
          error(
            "comment.timestamp",
            `${at}.createdAt`,
            "expected an ISO-8601 timestamp",
          ),
        );
    }
    return out;
  },
};

export const TEXT_STYLE: ElementTypeDefinition = {
  type: "design.text-style",
  category: "resource",
  keyOrder: {
    keys: ["name", "value"],
    children: {
      value: {
        keys: [
          "fontFamily",
          "fontSize",
          "fontWeight",
          "fontStyle",
          "fontVariations",
          "fontFeatures",
          "lineHeight",
          "letterSpacing",
          "textAlign",
          "textDecoration",
          "verticalAlign",
        ],
        children: {
          fontVariations: { keys: ["tag", "value"] },
          fontFeatures: { keys: ["tag", "value"] },
        },
      },
    },
  },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) return out;
    checkString(out, semantic["name"], `${path}.name`);
    const value = semantic["value"];
    if (!checkObject(out, value, `${path}.value`)) return out;
    checkString(out, value["fontFamily"], `${path}.value.fontFamily`);
    checkNumber(out, value["fontSize"], `${path}.value.fontSize`, { min: 1 });
    checkNumber(out, value["fontWeight"], `${path}.value.fontWeight`, {
      min: 1,
    });
    if (typeof value["fontWeight"] === "number" && value["fontWeight"] > 1000)
      out.push(
        error("value.max", `${path}.value.fontWeight`, "must not exceed 1000"),
      );
    checkEnum(out, value["fontStyle"], `${path}.value.fontStyle`, [
      "normal",
      "italic",
    ]);
    checkFontSettings(
      out,
      value["fontVariations"],
      `${path}.value.fontVariations`,
      { optional: true },
    );
    checkFontSettings(
      out,
      value["fontFeatures"],
      `${path}.value.fontFeatures`,
      { optional: true, integer: true },
    );
    checkNumber(out, value["lineHeight"], `${path}.value.lineHeight`, {
      min: 0.1,
    });
    checkNumber(out, value["letterSpacing"], `${path}.value.letterSpacing`);
    checkEnum(out, value["textAlign"], `${path}.value.textAlign`, [
      "start",
      "middle",
      "end",
    ]);
    checkEnum(out, value["textDecoration"], `${path}.value.textDecoration`, [
      "none",
      "underline",
      "line-through",
      "underline line-through",
    ]);
    checkEnum(out, value["verticalAlign"], `${path}.value.verticalAlign`, [
      "top",
      "middle",
      "bottom",
    ]);
    return out;
  },
};
