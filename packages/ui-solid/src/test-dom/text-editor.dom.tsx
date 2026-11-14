import assert from "node:assert/strict";
import { Editor } from "@nodetto/core";
import { Show, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { TextEditor } from "../TextEditor.tsx";

for (const scenario of ["replace", "reuse", "page", "commit"] as const) {
  const editor = new Editor();
  const id = editor.createElement("erd.table", {
    semantic: { tableName: "customers", columns: [] },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const [editing, setEditing] = createSignal(true);
  const dispose = render(
    () => (
      <Show when={editing()}>
        <TextEditor
          editor={editor}
          target={{ id, field: "label" }}
          onDone={() => setEditing(false)}
        />
      </Show>
    ),
    host,
  );
  const textarea = host.querySelector("textarea");
  assert.ok(textarea);
  assert.equal(textarea.value, "customers");
  if (scenario === "replace") editor.loadDocument(new Editor().getSnapshot());
  if (scenario === "reuse") editor.loadDocument(editor.getSnapshot());
  if (scenario === "page")
    editor.setCurrentPage(editor.createPage({ name: "Board" }));
  if (scenario === "commit") {
    textarea.value = "accounts";
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    assert.equal(editor.getText(id), "accounts");
  }
  await Promise.resolve();
  assert.equal(
    host.querySelector("textarea"),
    null,
    `${scenario}: stale text editor`,
  );
  dispose();
  host.remove();
  console.log(`ok ${scenario}`);
}
