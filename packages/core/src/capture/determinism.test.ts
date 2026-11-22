import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";

const allowedMath = new Set([
  "sqrt",
  "abs",
  "min",
  "max",
  "floor",
  "ceil",
  "round",
  "trunc",
  "sign",
]);

function arithmeticViolation(node: ts.Node): string | undefined {
  if (
    node.kind === ts.SyntaxKind.AsteriskAsteriskToken ||
    node.kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken
  )
    return node.getText();
  if (!ts.isIdentifier(node) || node.text !== "Math") return undefined;
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node)
    return allowedMath.has(parent.name.text) ? undefined : parent.getText();
  if (ts.isElementAccessExpression(parent) && parent.expression === node) {
    const key = parent.argumentExpression;
    if (ts.isStringLiteral(key) && allowedMath.has(key.text)) return undefined;
    return parent.getText();
  }
  return "indirect Math access";
}

test("capture source uses only deterministic arithmetic", () => {
  const violations: string[] = [];
  for (const entry of readdirSync(import.meta.dir, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (
      !entry.isFile() ||
      !/\.tsx?$/.test(entry.name) ||
      /\.test\.tsx?$/.test(entry.name)
    )
      continue;
    const path = resolve(entry.parentPath, entry.name);
    const file = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node): void {
      const violation = arithmeticViolation(node);
      if (violation !== undefined) {
        const { line } = file.getLineAndCharacterOfPosition(
          node.getStart(file),
        );
        violations.push(
          `${relative(import.meta.dir, path)}:${line + 1} ${violation}`,
        );
      }
      node.forEachChild(visit);
    }
    visit(file);
  }
  expect(violations).toEqual([]);
});
