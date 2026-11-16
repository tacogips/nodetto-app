export type SnippetEditorKeyResult =
  | { kind: "insertTab" }
  | { kind: "commit" }
  | { kind: "cancel" }
  | { kind: "default" };
export function snippetEditorKey(event: {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  isComposing?: boolean;
}): SnippetEditorKeyResult {
  if (event.isComposing) return { kind: "default" };
  if (event.key === "Tab" && !event.shiftKey) return { kind: "insertTab" };
  if (event.key === "Escape") return { kind: "cancel" };
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
    return { kind: "commit" };
  return { kind: "default" };
}
