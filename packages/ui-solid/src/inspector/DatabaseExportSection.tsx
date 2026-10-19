import {
  DATABASE_DIALECTS,
  type DatabaseDialect,
  type Editor,
  generateDatabaseDdl,
} from "@nodetto/core";
import type { PageId } from "@nodetto/ir";
import { createMemo, createSignal, For, type JSX } from "solid-js";
import { createEditorSignals } from "../adapter.ts";

const DIALECT_LABELS: Readonly<Record<DatabaseDialect, string>> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

function fileStem(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "schema"
  );
}

function fallbackCopy(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
  }
}

export function DatabaseExportSection(props: {
  readonly editor: Editor;
  readonly pageId: PageId;
}): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const [dialect, setDialect] = createSignal<DatabaseDialect>("postgresql");
  const [scope, setScope] = createSignal("");
  const frames = createMemo(() => {
    signals.rev();
    return props.editor.store
      .getPageElements(props.pageId)
      .filter((element) => element.type === "frame");
  });
  const frameId = () =>
    frames().some((frame) => frame.id === scope()) ? scope() : undefined;
  const [status, setStatus] = createSignal("");
  const report = createMemo(() => {
    signals.rev();
    return generateDatabaseDdl(props.editor, props.pageId, dialect(), {
      frameId: frameId(),
    });
  });
  const copy = async (): Promise<void> => {
    try {
      if (navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(report().sql);
      else if (!fallbackCopy(report().sql)) throw new Error("copy failed");
      setStatus("SQL copied.");
    } catch {
      setStatus("Clipboard unavailable. Select and copy the SQL below.");
    }
  };
  const download = (): void => {
    const pageName = props.editor.store.getPage(props.pageId)?.name ?? "schema";
    const url = URL.createObjectURL(
      new Blob([report().sql], { type: "application/sql;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileStem(pageName)}${frameId() ? `.${fileStem(frameId() ?? "")}` : ""}.${dialect()}.sql`;
    document.body.append(link);
    try {
      link.click();
      setStatus("SQL download requested.");
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };
  return (
    <section class="nodetto-inspector-section">
      <label>
        DDL scope
        <select
          aria-label="Database DDL scope"
          value={frameId() ?? ""}
          onChange={(event) => {
            setScope(event.currentTarget.value);
            setStatus("");
          }}
        >
          <option value="">Whole page</option>
          <For each={frames()}>
            {(frame) => (
              <option value={frame.id}>
                {(frame.semantic as { name?: string }).name || frame.id}
              </option>
            )}
          </For>
        </select>
      </label>
      <label>
        SQL dialect
        <select
          aria-label="Database SQL dialect"
          value={dialect()}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setDialect(
              DATABASE_DIALECTS.includes(value as DatabaseDialect)
                ? (value as DatabaseDialect)
                : "postgresql",
            );
            setStatus("");
          }}
        >
          <For each={DATABASE_DIALECTS}>
            {(value) => <option value={value}>{DIALECT_LABELS[value]}</option>}
          </For>
        </select>
      </label>
      <button type="button" onClick={() => void copy()}>
        Copy SQL
      </button>
      <button type="button" onClick={download}>
        Download .sql
      </button>
      <textarea
        aria-label="Generated database SQL"
        readOnly
        rows={14}
        value={report().sql}
        style={{
          width: "100%",
          "box-sizing": "border-box",
          "font-family": "monospace",
        }}
      />
      <For each={report().warnings}>{(warning) => <p>{warning}</p>}</For>
      <p role="status">{status()}</p>
    </section>
  );
}

export default DatabaseExportSection;
