import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { ELEMENT_TYPES, isPlainObject } from "@nodetto/ir";
import { labelField } from "./label-field.ts";
import { Batch } from "./batch.ts";

test("update labels use editable fields and override semantic", () => {
  const editor = new Editor();
  const batch = new Batch(editor);
  for (const [type, field] of [
    ["text.note", "text"],
    ["frame", "name"],
    ["node.generic", "label"],
    ["state.node", "name"],
    ["erd.table", "tableName"],
  ] as const) {
    const id = editor.createElement(type);
    batch.apply(
      { op: "update", id, semantic: { [field]: "old" }, label: "Widget" },
      0,
    );
    expect(editor.store.get(id)?.semantic).toMatchObject({ [field]: "Widget" });
  }
});
test("typed add applies a label", () => {
  const editor = new Editor();
  const batch = new Batch(editor);
  batch.apply({ op: "add", type: "text.note", label: "Widget" }, 0);
  expect(editor.store.get(batch.created[0]!.id)?.semantic).toMatchObject({
    text: "Widget",
  });
});

test("all registered types accept their mapped label or report no label", () => {
  for (const type of ELEMENT_TYPES) {
    const editor = new Editor();
    const defaults = editor.registry.getOrFallback(type).defaultSemantic();
    const semantic = isPlainObject(defaults) ? { ...defaults } : {};
    for (const key of [
      "from",
      "to",
      "owner",
      "parent",
      "attachedTo",
      "source",
    ]) {
      if (semantic[key] === "") semantic[key] = "target";
      else if (isPlainObject(semantic[key]) && semantic[key].table === "")
        semantic[key] = { ...semantic[key], table: "target" };
    }
    const id = editor.createElement(type, { semantic });
    const element = editor.store.get(id)!;
    const batch = new Batch(editor);
    const field = labelField(editor, element);
    if ("error" in field)
      expect(() =>
        batch.apply({ op: "update", id, label: "Widget" }, 0),
      ).toThrow("has no text label");
    else {
      batch.apply({ op: "update", id, label: "Widget" }, 0);
      expect({ type, semantic: editor.store.get(id)?.semantic }).toMatchObject({
        type,
        semantic: { [field.field]: "Widget" },
      });
    }
  }
});

test("connector label mappings and semantic precedence", () => {
  const editor = new Editor();
  const batch = new Batch(editor);
  const from = editor.createElement("node.generic");
  const to = editor.createElement("node.generic");
  for (const type of [undefined, "edge.generic"] as const) {
    batch.apply(
      {
        op: "connect",
        from,
        to,
        ...(type ? { type } : {}),
        label: "label",
        semantic: { label: "semantic" },
      },
      0,
    );
    expect(() =>
      batch.apply(
        { op: "connect", from, to, ...(type ? { type } : {}), label: 42 },
        0,
      ),
    ).toThrow('"label" must be a string');
    const connector = editor.store.get(batch.created.at(-1)!.id)!;
    expect(connector.semantic).toMatchObject({ label: "semantic" });
    batch.apply({ op: "update", id: connector.id, label: "Widget" }, 1);
    expect(connector.type).toBe("edge.generic");
    expect(editor.store.get(connector.id)?.semantic).toMatchObject({
      label: "Widget",
    });
  }
  const stateEditor = new Editor();
  const stateFrom = stateEditor.createElement("state.node");
  const stateTo = stateEditor.createElement("state.node");
  const state = stateEditor.createElement("state.transition", {
    semantic: { from: stateFrom, to: stateTo, trigger: "old" },
  });
  new Batch(stateEditor).apply({ op: "update", id: state, label: "Widget" }, 0);
  expect(stateEditor.store.get(state)?.semantic).toMatchObject({
    trigger: "Widget",
  });
});
