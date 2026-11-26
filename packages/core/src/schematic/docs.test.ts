import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SCHEMATIC_ELEMENT_TYPES } from "@nodetto/ir";
import { expect, test } from "bun:test";
import { SCHEMATIC_ERC_RULE_IDS } from "./erc.ts";

const root = resolve(import.meta.dir, "../../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const parityIds = [
  "pcb-parity-missing-connection",
  "pcb-parity-extra-connection",
  "pcb-parity-missing-part",
  "pcb-parity-extra-part",
  "pcb-parity-value-mismatch",
];

test("schematic documentation pins types, rule tables and ASCII", () => {
  const doc = read("docs/schematic.md");
  expect([...doc].every((character) => character.charCodeAt(0) < 128)).toBe(
    true,
  );
  expect(SCHEMATIC_ELEMENT_TYPES).toHaveLength(18);
  for (const type of SCHEMATIC_ELEMENT_TYPES)
    expect(doc).toContain(`\`${type}\``);
  const ids = [...doc.matchAll(/^\| `([a-z-]+)` \|/gm)].map(
    (match) => match[1],
  );
  expect(ids).toHaveLength(SCHEMATIC_ERC_RULE_IDS.length + parityIds.length);
  expect(new Set(ids)).toEqual(
    new Set([...SCHEMATIC_ERC_RULE_IDS, ...parityIds]),
  );
});

test("README links schematic pages and lists the CLI command", () => {
  const readme = read("README.md");
  expect(readme).toContain("## Schematic pages");
  expect(readme).toContain("(docs/schematic.md)");
  expect(readme).toContain("| `schematic` |");
});
