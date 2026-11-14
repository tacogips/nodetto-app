import { describe, expect, test } from "bun:test";
import type { BreadboardImportDiagnostic } from "@nodetto/ir";
import { atomAt, child, children, numberAt, readSexpr } from "./sexpr.ts";

describe("KiCad S-expression reader", () => {
  test("reads atoms, nested lists, quoted values and token positions", () => {
    const result = readSexpr('(a "b c" (d 1.5))');
    expect(result.diagnostics).toEqual([]);
    expect(result.root?.items[0]).toMatchObject({
      kind: "atom",
      text: "a",
      line: 1,
      column: 2,
    });
    expect(result.root?.items[1]).toMatchObject({
      kind: "atom",
      text: "b c",
      quoted: true,
      column: 4,
    });
    expect(result.root?.items[2]).toMatchObject({
      kind: "list",
      line: 1,
      column: 10,
    });
    expect(
      child(result.root as NonNullable<typeof result.root>, "d"),
    ).toMatchObject({
      kind: "list",
      line: 1,
      column: 10,
    });
    const nested = result.root?.items[2];
    expect(nested?.kind === "list" ? atomAt(nested, 1) : undefined).toBe("1.5");
  });

  test("decodes supported and unknown string escapes", () => {
    const result = readSexpr('("x\\"y\\\\z\\n\\r\\t\\q")');
    const atom = result.root?.items[0];
    expect(atom?.kind === "atom" ? atom.text : "").toBe('x"y\\z\n\r\tq');
  });

  test("recovers from malformed input with positioned diagnostics", () => {
    const result = readSexpr('("unfinished');
    expect(result.root).toBeDefined();
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      "sexpr.unterminatedString",
      "sexpr.unclosedList",
    ]);
    expect(readSexpr("((a)").diagnostics.map((item) => item.code)).toContain(
      "sexpr.unclosedList",
    );
    expect(readSexpr(") (a)").diagnostics.map((item) => item.code)).toContain(
      "sexpr.unexpectedClose",
    );
    expect(readSexpr("(a) (b)").diagnostics.map((item) => item.code)).toContain(
      "sexpr.trailingContent",
    );
    expect(readSexpr("").diagnostics.map((item) => item.code)).toContain(
      "sexpr.empty",
    );
    expect(
      readSexpr(`${"(".repeat(300)}x${")".repeat(300)}`).diagnostics.map(
        (item) => item.code,
      ),
    ).toContain("sexpr.tooDeep");
  });

  test("tolerates deterministic arbitrary byte strings", () => {
    let seed = 4129;
    for (let sample = 0; sample < 200; sample += 1) {
      let input = "";
      for (let index = 0; index < 60; index += 1) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        input += String.fromCharCode(seed & 0xff);
      }
      expect(() => readSexpr(input)).not.toThrow();
    }
  });

  test("exports helpers for importers", () => {
    const parsed = readSexpr("(root (item 2))");
    const root = parsed.root;
    expect(root && children(root, "item")).toHaveLength(1);
    const item = root && child(root, "item");
    expect(item && atomAt(item, 0)).toBe("item");
    const diagnostics: BreadboardImportDiagnostic[] = [];
    expect(item && numberAt(item, 1, diagnostics)).toBe(2);
    expect(diagnostics).toEqual([]);
  });
});
