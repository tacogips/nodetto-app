import { describe, expect, test } from "bun:test";
import { markdownLayout } from "./layout.ts";
import { parseMarkdown } from "./parse.ts";

describe("markdown layout", () => {
  test("wraps text and grows with content", () => {
    const short = markdownLayout(parseMarkdown("hello"), 200);
    const long = markdownLayout(
      parseMarkdown(
        "A long paragraph with many words that must wrap across several lines.",
      ),
      120,
    );
    expect(new Set(long.runs.map((run) => run.y)).size).toBeGreaterThan(1);
    expect(long.height).toBeGreaterThan(short.height);
    expect(markdownLayout([], 100).height).toBe(32);
  });
  test("only safe schemes produce hrefs", () => {
    const layout = markdownLayout(
      parseMarkdown("[ok](https://e.com) [bad](javascript:alert(1))"),
      500,
    );
    expect(layout.runs.find((run) => run.text === "ok")?.href).toBe(
      "https://e.com",
    );
    expect(layout.runs.find((run) => run.text === "bad")?.href).toBeUndefined();
  });
  test("injected code segments retain their roles", () => {
    const layout = markdownLayout(parseMarkdown("```ts\nlet x\n```"), 200, {
      highlight: () => [
        [
          { text: "let", kind: "keyword" },
          { text: " x", kind: "plain" },
        ],
      ],
    });
    expect(layout.boxes.some((box) => box.kind === "codePanel")).toBe(true);
    expect(layout.runs.find((run) => run.text === "let")?.role).toBe("keyword");
  });
  test("renders structural boxes", () => {
    const layout = markdownLayout(
      parseMarkdown(
        "> quote\n\n- [x] task\n\n| a | b |\n| --- | --- |\n| c | d |",
      ),
      300,
    );
    expect(layout.boxes.some((box) => box.kind === "quoteBar")).toBe(true);
    expect(layout.boxes.some((box) => box.kind === "task" && box.checked)).toBe(
      true,
    );
    expect(layout.boxes.some((box) => box.kind === "headerCell")).toBe(true);
  });
});
