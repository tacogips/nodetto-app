import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "bun:test";
import { BREADBOARD_ERC_RULE_IDS } from "./types.ts";
import { BREADBOARD_ELEMENT_TYPES } from "@nodetto/ir";

const root = resolve(import.meta.dir, "../../../../");
const readText = (path: string) => readFileSync(resolve(root, path), "utf8");

test("ERC documentation lists each rule id exactly once", () => {
  const content = readText("docs/breadboard/erc-rules.md");
  const ids = [...content.matchAll(/^\| `([a-z-]+)` \|/gm)].map(
    (match) => match[1],
  );
  expect(ids).toHaveLength(BREADBOARD_ERC_RULE_IDS.length);
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(ids)).toEqual(new Set(BREADBOARD_ERC_RULE_IDS));
});

test("format documentation names every registered breadboard element type", () => {
  const content = readText("docs/breadboard/format.md");
  expect(BREADBOARD_ELEMENT_TYPES).toHaveLength(13);
  for (const type of BREADBOARD_ELEMENT_TYPES) {
    expect(content).toContain(`\`${type}\``);
  }
});

test("KiCad guide names parser diagnostics and the mapping heading", () => {
  const content = readText("docs/breadboard/kicad-import.md");
  expect(content).toContain("## Symbol mapping");
  expect(content).toContain("sexpr.empty");
  expect(content).toContain("kicad.unknownRoot");
  expect(content).toContain("kicad.legacyFormat");
  expect(content).toContain("written from scratch");
});
