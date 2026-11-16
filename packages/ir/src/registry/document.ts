import { checkBoolean, checkObject, checkString } from "../checks.ts";
import { error, type ValidationIssue } from "../issues.ts";
import {
  TEXT_CODE_LANGUAGE_PATTERN,
  TEXT_SNIPPET_MAX_LENGTH,
} from "../semantics/document.ts";
import { noReferences, type ElementTypeDefinition } from "./definition.ts";

function checkText(out: ValidationIssue[], value: unknown, path: string): void {
  if (
    checkString(out, value, path, { allowEmpty: true }) &&
    typeof value === "string" &&
    value.length > TEXT_SNIPPET_MAX_LENGTH
  )
    out.push(error("text.limit", path, "maximum 200000 characters"));
}
export const TEXT_CODE: ElementTypeDefinition = {
  type: "text.code",
  category: "node",
  onReferenceDeleted: "detach",
  references: noReferences,
  keyOrder: { keys: ["code", "language", "showLineNumbers", "wrap"] },
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) return out;
    checkText(out, semantic["code"], `${path}.code`);
    const language = semantic["language"];
    if (
      checkString(out, language, `${path}.language`, { allowEmpty: true }) &&
      typeof language === "string" &&
      !TEXT_CODE_LANGUAGE_PATTERN.test(language)
    )
      out.push(
        error("type.pattern", `${path}.language`, "invalid language token"),
      );
    checkBoolean(out, semantic["showLineNumbers"], `${path}.showLineNumbers`, {
      optional: true,
    });
    checkBoolean(out, semantic["wrap"], `${path}.wrap`, { optional: true });
    return out;
  },
};
export const TEXT_MARKDOWN: ElementTypeDefinition = {
  type: "text.markdown",
  category: "node",
  onReferenceDeleted: "detach",
  references: noReferences,
  keyOrder: { keys: ["markdown"] },
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path))
      checkText(out, semantic["markdown"], `${path}.markdown`);
    return out;
  },
};
