import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "./parse.ts";

describe("Markdown blocks", () => {
  test("headings and rules", () => {
    expect(parseMarkdown("# A #\n\nPara\n===\n\nPara\n---\n\n---")).toEqual([
      { kind: "heading", level: 1, inlines: [{ kind: "text", text: "A" }] },
      { kind: "heading", level: 1, inlines: [{ kind: "text", text: "Para" }] },
      { kind: "heading", level: 2, inlines: [{ kind: "text", text: "Para" }] },
      { kind: "rule" },
    ]);
  });
  test("fences, nested quotes and tasks, ordered lists", () => {
    expect(parseMarkdown("````ts title\n```\n````")[0]).toEqual({
      kind: "code",
      language: "ts",
      text: "```",
    });
    expect(parseMarkdown("~~~js\nhello")[0]).toEqual({
      kind: "code",
      language: "js",
      text: "hello",
    });
    expect(parseMarkdown("> a\n> > b")[0]).toMatchObject({
      kind: "quote",
      blocks: [{ kind: "paragraph" }, { kind: "quote" }],
    });
    expect(parseMarkdown("- [x] done\n  - [ ] sub")[0]).toMatchObject({
      kind: "list",
      items: [
        {
          task: true,
          blocks: [
            { kind: "paragraph" },
            { kind: "list", items: [{ task: false }] },
          ],
        },
      ],
    });
    expect(parseMarkdown("3. a\n4. b")[0]).toMatchObject({
      kind: "list",
      start: 3,
      items: [{}, {}],
    });
  });
  test("tables preserve escaped pipes and normalize rows", () => {
    expect(
      parseMarkdown(
        "| a \\| b | c |\n| :-: | --: |\n| x |\n| y | z | extra | ",
      )[0],
    ).toMatchObject({
      kind: "table",
      align: ["center", "right"],
      header: [[{ text: "a | b" }], [{ text: "c" }]],
      rows: [
        [[{ text: "x" }], []],
        [[{ text: "y" }], [{ text: "z" }]],
      ],
    });
  });
  test("pathological delimiters finish within one second", () => {
    const start = performance.now();
    parseMarkdown("*_".repeat(100_000));
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
