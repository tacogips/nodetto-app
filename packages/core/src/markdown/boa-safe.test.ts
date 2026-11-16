import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Markdown sources avoid regex features unsupported by Boa", () => {
  for (const name of [
    "ast.ts",
    "inline.ts",
    "parse.ts",
    "layout.ts",
    "index.ts",
  ]) {
    const source = readFileSync(new URL(name, import.meta.url), "utf8");
    expect(source).not.toMatch(/\(\?<([=!]|[A-Za-z])/);
    expect(source).not.toMatch(/\\[pP]\{/);
    expect(source).not.toMatch(/\.replaceAll\s*\(/);
  }
});
