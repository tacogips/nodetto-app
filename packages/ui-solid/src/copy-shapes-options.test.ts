import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import {
  copyShapesOptions,
  defaultCopyShapesOption,
} from "./copy-shapes-options.ts";
test("source options put neighbors first and exclude target", () => {
  const editor = new Editor();
  const a = editor.currentPageId;
  editor.renamePage(a, "A");
  const b = editor.createPage({ name: "B" });
  const c = editor.createPage({ name: "C" });
  const pages = editor.store.listPages();
  const options = copyShapesOptions(pages, b);
  expect(options.map((o) => o.pageId)).toEqual([a, c, a, c]);
  expect(defaultCopyShapesOption(options)?.key).toBe("prev");
  const first = copyShapesOptions(pages, a);
  expect(first[0]?.disabled).toBe(true);
  expect(first[0]?.pageId).toBeNull();
  expect(defaultCopyShapesOption(first)?.key).toBe("next");
  expect(copyShapesOptions(pages, c)[1]?.disabled).toBe(true);
  expect(defaultCopyShapesOption(copyShapesOptions([pages[0]!], a))).toBeNull();
  expect(copyShapesOptions(pages, "missing")).toEqual([]);
});
