import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
test("source avoids Boa-incompatible regex features", () => {
  const root = import.meta.dir;
  const files = readdirSync(root)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(root, f));
  files.push(join(root, "../code-snippet/layout.ts"));
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/\(\?<([=!]|[a-zA-Z])/);
    expect(source).not.toContain("\\p{");
    expect(source).not.toMatch(/\/[dgimsuvy]*[dvy][dgimsuvy]*[;,.)]/);
    expect(source).not.toMatch(/\.replaceAll\s*\(\s*\//);
  }
});
