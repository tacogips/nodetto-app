import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import type { FrameSemantic } from "@nodetto/ir";
import { runCli } from "./commands.ts";

function lint(source: string, ...options: string[]) {
  return runCli(
    ["lint", "doc.jsonl", ...options],
    {
      readText: () => source,
      writeText: () => {},
    },
    "test",
  );
}

test("app lint reports rules in text and instance context in JSON", () => {
  const editor = new Editor();
  const label = editor.buildElement("text.note", {
    id: "source-label",
    semantic: { text: "W".repeat(100) },
    visual: { x: 0, y: 0, width: 80, height: 20 },
  });
  const source = editor.buildElement("frame", {
    id: "source",
    semantic: { name: "Source", component: true, memberIds: [label.id] },
    visual: { x: 0, y: 0, width: 80, height: 44 },
  });
  editor.apply([
    { type: "createElement", element: label },
    { type: "createElement", element: source },
  ]);
  const instanceId = editor.createComponentInstance(source.id, {
    x: 16,
    y: 16,
  });
  if (!instanceId) throw new Error("missing instance");
  const instance = editor.store.get(instanceId);
  const childId = (instance?.semantic as FrameSemantic).memberIds?.[0];
  const screen = editor.buildElement("frame", {
    id: "screen",
    semantic: { name: "Home", platform: "ios", memberIds: [instanceId] },
    visual: { x: 0, y: 0, width: 390, height: 844 },
  });
  editor.apply([{ type: "createElement", element: screen }]);
  const doc = editor.getSnapshot();
  const sourceText = serializeDocument({
    ...doc,
    pages: doc.pages.map((page) => ({ ...page, mode: "app" })),
  });
  const text = lint(sourceText);
  expect(text.exitCode).toBe(0);
  expect(text.stdout).toContain("app-text-overflow");
  const json = lint(sourceText, "--format", "json");
  expect(json.exitCode).toBe(0);
  const findings = JSON.parse(json.stdout).pages[0].findings;
  expect(findings).toContainEqual(
    expect.objectContaining({
      elementId: childId,
      ruleId: "app-text-overflow",
      context: { screenId: "screen", instanceId },
    }),
  );
});

test("freeform non-app pages keep the clean lint output", () => {
  const editor = new Editor();
  expect(lint(serializeDocument(editor.getSnapshot()))).toEqual({
    exitCode: 0,
    stdout: "",
    stderr: "",
  });
});
