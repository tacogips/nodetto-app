import { describe, expect, test } from "bun:test";
import { presentationStartShortcut } from "./window-input.ts";

describe("presentation start shortcut", () => {
  const event = {
    key: "F5",
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: null,
  };
  test("starts first or current and rejects other modifiers and keys", () => {
    expect(presentationStartShortcut(event)).toBe("first");
    expect(presentationStartShortcut({ ...event, shiftKey: true })).toBe(
      "current",
    );
    for (const override of [
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { key: "f5" },
      { key: "F6" },
    ])
      expect(presentationStartShortcut({ ...event, ...override })).toBeNull();
  });
  test("ignores editable targets", () => {
    for (const target of [{ tagName: "INPUT" }, { isContentEditable: true }])
      expect(
        presentationStartShortcut({
          ...event,
          target: target as unknown as EventTarget,
        }),
      ).toBeNull();
  });
});
