import { describe, expect, test } from "bun:test";
import { parseInline } from "./inline.ts";

describe("parseInline", () => {
  test("parses formatted spans and leaves intraword underscores literal", () => {
    expect(parseInline("**b** *i* ~~s~~ `code`")).toEqual([
      { kind: "strong", children: [{ kind: "text", text: "b" }] },
      { kind: "text", text: " " },
      { kind: "emph", children: [{ kind: "text", text: "i" }] },
      { kind: "text", text: " " },
      { kind: "strike", children: [{ kind: "text", text: "s" }] },
      { kind: "text", text: " " },
      { kind: "code", text: "code" },
    ]);
    expect(parseInline("***nested***")).toEqual([
      {
        kind: "strong",
        children: [
          { kind: "emph", children: [{ kind: "text", text: "nested" }] },
        ],
      },
    ]);
    expect(parseInline("snake_case_name")).toEqual([
      { kind: "text", text: "snake_case_name" },
    ]);
  });

  test("retains unsupported syntax and handles links, escapes, entities and breaks", () => {
    expect(parseInline("![a](b.png) $x$ <b>hi</b> [^1]")).toEqual([
      { kind: "text", text: "![a](b.png) $x$ <b>hi</b> [^1]" },
    ]);
    expect(parseInline('[x](https://e.com "title")')).toEqual([
      {
        kind: "link",
        href: "https://e.com",
        children: [{ kind: "text", text: "x" }],
      },
    ]);
    expect(parseInline("<mailto:a@b.test>")[0]?.kind).toBe("link");
    expect(parseInline("\\* &amp; &#x41;  \nnext")).toEqual([
      { kind: "text", text: "* & A" },
      { kind: "break" },
      { kind: "text", text: "next" },
    ]);
  });

  test("handles equal backtick runs and long unmatched delimiters", () => {
    expect(parseInline("`` a ` b ``")).toEqual([
      { kind: "code", text: "a ` b" },
    ]);
    const start = performance.now();
    parseInline("*_".repeat(100_000));
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
