import { expect, test } from "bun:test";
import type { Element } from "@nodetto/ir";
import {
  codeFlagCommand,
  codeLanguageCommand,
  snippetThemeCommand,
} from "./snippet-edits.ts";
const element = {
  id: "snippet",
  type: "text.code",
  semantic: { code: "", language: "plain", showLineNumbers: true },
  visual: { x: 0, y: 0, width: 100, height: 100, style: { stroke: "#123456" } },
} as Element;
test("snippet edits canonicalize, remove flags and preserve style", () => {
  expect(codeLanguageCommand(element, "rs")).toEqual({
    type: "updateSemantic",
    id: element.id,
    semantic: {
      code: "",
      showLineNumbers: true,
      language: "rust",
    },
  });
  expect(codeLanguageCommand(element, "plain")).toBeNull();
  expect(codeLanguageCommand(element, "nope")).toBeNull();
  expect(codeFlagCommand(element, "wrap", true)).toEqual({
    type: "updateSemantic",
    id: element.id,
    semantic: {
      code: "",
      language: "plain",
      showLineNumbers: true,
      wrap: true,
    },
  });
  expect(codeFlagCommand(element, "showLineNumbers", false)).toEqual({
    type: "updateSemantic",
    id: element.id,
    semantic: { code: "", language: "plain" },
  });
  expect(snippetThemeCommand(element, "dark")).toEqual({
    type: "updateVisual",
    id: element.id,
    visual: { style: { stroke: "#123456", fill: "#1f2427" } },
  });
  expect(
    snippetThemeCommand(
      { ...element, visual: { ...element.visual, style: { fill: "#1f2427" } } },
      "dark",
    ),
  ).toBeNull();
});
