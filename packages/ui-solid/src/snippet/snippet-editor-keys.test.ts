import { expect, test } from "bun:test";
import { snippetEditorKey } from "./snippet-editor-keys.ts";
test("maps editing keys and respects composition", () => {
  const key = (
    key: string,
    extra: Partial<Parameters<typeof snippetEditorKey>[0]> = {},
  ) =>
    snippetEditorKey({
      key,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      ...extra,
    }).kind;
  expect(key("Tab")).toBe("insertTab");
  expect(key("Tab", { shiftKey: true })).toBe("default");
  expect(key("Escape")).toBe("cancel");
  expect(key("Enter", { metaKey: true })).toBe("commit");
  expect(key("Enter", { ctrlKey: true })).toBe("commit");
  expect(key("Enter")).toBe("default");
  expect(key("Escape", { isComposing: true })).toBe("default");
});
