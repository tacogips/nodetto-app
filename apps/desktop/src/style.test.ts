import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const CSS = readFileSync(`${import.meta.dir}/style.css`, "utf8");

/** Each rule's selector and declarations, comments removed. */
function rules(css: string): { selector: string; body: string }[] {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? "").trim(),
    body: match[2] ?? "",
  }));
}

test("default shape and connector paint yields to colours stored in the document", () => {
  // Any stylesheet rule beats an SVG presentation attribute, so a default
  // that is not guarded by :not([attribute]) hides the document's colour.
  const painted = rules(CSS).filter(
    (rule) =>
      /\.nodetto-(?:geo|connector)(?![-\w])/.test(rule.selector) &&
      !rule.selector.includes(".nodetto-selected"),
  );
  expect(painted.length).toBeGreaterThan(0);
  for (const rule of painted)
    for (const [, property, value] of rule.body.matchAll(
      /(?:^|;)\s*(fill|stroke|stroke-width)\s*:\s*([^;]+)/g,
    )) {
      if (property === "fill" && value?.trim() === "none") continue;
      expect(`${rule.selector} sets ${property}`).toBe(
        rule.selector.includes(`:not([${property}])`)
          ? `${rule.selector} sets ${property}`
          : `${rule.selector} must be guarded by :not([${property}])`,
      );
    }
});
