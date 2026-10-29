import { describe, expect, test } from "bun:test";
import { Editor } from "./editor.ts";
import {
  findText,
  replaceText,
  textFields,
  textMatcher,
} from "./text-replace.ts";

describe("text search and replace", () => {
  test("finds display text but never identifiers or references", () => {
    const editor = new Editor();
    const a = editor.createElement("shape.geo", {
      semantic: { geo: "rect", label: "api.example.dev" },
    });
    const b = editor.createElement("shape.geo", {
      semantic: { geo: "rect", label: "worker" },
    });
    const edge = editor.createElement("edge.generic", {
      semantic: { from: a, to: b, label: "calls example.dev" },
    });
    const element = editor.store.get(edge);
    if (!element) throw new Error("missing edge");
    expect(textFields(element).map((field) => field.path)).toEqual(["label"]);
    const matcher = textMatcher("example.dev");
    if (typeof matcher === "string") throw new Error(matcher);
    expect(findText(element, matcher)).toHaveLength(1);
  });

  test("replaces part of labels, notes and nested names", () => {
    const editor = new Editor();
    const label = editor.createElement("shape.geo", {
      semantic: { geo: "rect", label: "*.example.dev (edge)" },
    });
    const note = editor.createElement("text.note", {
      semantic: { text: "Serve example.dev and EXAMPLE.DEV" },
    });
    const table = editor.createElement("erd.table", {
      semantic: {
        tableName: "example_dev_hosts",
        columns: [{ id: "c1", name: "example.dev_host", dataType: "text" }],
      },
    });
    const matcher = textMatcher("example.dev", { ignoreCase: true });
    if (typeof matcher === "string") throw new Error(matcher);
    const changes = replaceText(
      editor,
      [label, note, table],
      matcher,
      "example.info",
    );
    expect(changes.map((change) => change.path)).toEqual([
      "label",
      "text",
      "columns[0].name",
    ]);
    expect(editor.store.get(label)?.semantic).toMatchObject({
      label: "*.example.info (edge)",
    });
    expect(editor.getText(note)).toBe("Serve example.info and example.info");
    expect(editor.store.get(table)?.semantic).toMatchObject({
      tableName: "example_dev_hosts",
      columns: [{ id: "c1", name: "example.info_host", dataType: "text" }],
    });
  });

  test("supports regular expressions and reports bad patterns", () => {
    const editor = new Editor();
    const id = editor.createElement("shape.geo", {
      semantic: { geo: "rect", label: "v1.2 and v1.3" },
    });
    const matcher = textMatcher("v1\\.(\\d)", { regex: true });
    if (typeof matcher === "string") throw new Error(matcher);
    replaceText(editor, [id], matcher, "v2.$1");
    expect(editor.store.get(id)?.semantic).toMatchObject({
      label: "v2.2 and v2.3",
    });
    expect(textMatcher("(", { regex: true })).toContain("invalid");
    expect(textMatcher("")).toContain("must not be empty");
  });
});
