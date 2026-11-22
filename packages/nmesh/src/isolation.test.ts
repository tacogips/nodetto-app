import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { preProcessFile } from "typescript";

test("each mesh format keeps its production imports and exports inside its own directory", () => {
  for (const root of [
    new URL("./", import.meta.url),
    new URL("../../io/src/stl/", import.meta.url),
  ]) {
    const sources = readdirSync(root).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
    );
    expect(sources).toContain("index.ts");
    for (const source of sources) {
      const text = readFileSync(new URL(source, root), "utf8");
      const { importedFiles, referencedFiles, typeReferenceDirectives } =
        preProcessFile(text, true, true);
      for (const { fileName } of [
        ...importedFiles,
        ...referencedFiles,
        ...typeReferenceDirectives,
      ]) {
        expect(fileName.startsWith("./")).toBe(true);
        expect(new URL(fileName, root).href.startsWith(root.href)).toBe(true);
      }
    }
  }
});
