import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { CadXY } from "@nodetto/ir";
import ts from "typescript";
import { tessellateCircle } from "./index.ts";

const mathMembers = new Set([
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

function mathUse(node: ts.Identifier): string | undefined {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
    return mathMembers.has(parent.name.text) ? undefined : parent.getText();
  }
  if (ts.isElementAccessExpression(parent) && parent.expression === node) {
    const key = parent.argumentExpression;
    return ts.isStringLiteral(key) && mathMembers.has(key.text)
      ? undefined
      : parent.getText();
  }
  return "indirect Math access";
}

test("CAD source uses only deterministic arithmetic", () => {
  const violations: string[] = [];
  for (const entry of readdirSync(import.meta.dir, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (
      !entry.isFile() ||
      !entry.name.endsWith(".ts") ||
      entry.name.endsWith(".test.ts")
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
      let violation: string | undefined;
      if (ts.isIdentifier(node) && node.text === "Math")
        violation = mathUse(node);
      if (
        node.kind === ts.SyntaxKind.AsteriskAsteriskToken ||
        node.kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken
      ) {
        violation = node.getText();
      }
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

const circles: readonly [CadXY, number, string][] = [
  [
    [0, 0],
    1.6,
    "0e50261b77b47f327810c2d944e51eafdde233705c44ca3c7022f6ce820f3b36",
  ],
  [
    [2, -3],
    50,
    "be15863e52bfc8a5917472a9c8df10baf269421f47be35cb4599af4693c34361",
  ],
  [
    [-3.125, 8.0625],
    7.375,
    "0ae05bc42af63da2adc1efd08f8b680da8d3864fe4c6a66f65a90cc9620b27c0",
  ],
];

test.each(circles)(
  "circle at %j, radius %d has fixed coordinate bytes",
  (center, radius, hash) => {
    const points = tessellateCircle(center, radius);
    const bytes = Buffer.alloc(points.length * 8);
    points.forEach((point, i) => bytes.writeDoubleLE(point, i * 8));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
  },
);
