import {
  HtmlExportSection,
  type SaveHtmlBundle,
} from "./inspector/HtmlExportSection.tsx";
import { isDatabaseObjectType, shortPageId } from "@nodetto/ir";
import type { Editor } from "@nodetto/core";
import { availableMermaidKinds } from "@nodetto/io";
import {
  BREADBOARD_EXPORTS,
  breadboardExportEnabled,
  type BreadboardExportKind,
} from "./breadboard-export.ts";
import { pcbExportEnabled } from "./pcb-export.ts";
import {
  createMemo,
  createSignal,
  For,
  type JSX,
  lazy,
  Match,
  onCleanup,
  onMount,
  Show,
  Suspense,
  Switch,
} from "solid-js";
import { createEditorSignals } from "./adapter.ts";
import type {
  ExportFormat,
  SaveArtwork,
} from "./inspector/AssetExportSection.tsx";
import "./ExportDialog.css";

const Artwork = lazy(() =>
  import("./inspector/AssetExportSection.tsx").then((m) => ({
    default: m.AssetExportSection,
  })),
);
const Mermaid = lazy(() => import("./inspector/MermaidExportSection.tsx"));
const D2 = lazy(() => import("./inspector/D2ExportSection.tsx"));
const Drawio = lazy(() => import("./inspector/DrawioExportSection.tsx"));
const Database = lazy(() => import("./inspector/DatabaseExportSection.tsx"));
const Code = lazy(() =>
  import("./inspector/HandoffSection.tsx").then((m) => ({
    default: m.HandoffSection,
  })),
);
type Format =
  | ExportFormat
  | "mermaid"
  | "d2"
  | "drawio"
  | "sql"
  | "bpmn"
  | "breadboard"
  | "pcb"
  | "code"
  | "html";

export interface ExportDialogProps {
  readonly editor: Editor;
  readonly saveArtwork?: SaveArtwork;
  readonly saveHtmlBundle?: SaveHtmlBundle;
  readonly exportBpmn: () => Promise<void>;
  readonly exportBreadboard?: (kind: BreadboardExportKind) => Promise<void>;
  readonly exportPcb?: () => Promise<void>;
  readonly error?: string | null;
  readonly onClose: () => void;
}

export function ExportDialog(props: ExportDialogProps): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const [format, setFormat] = createSignal<Format>("svg");
  let dialog: HTMLDialogElement | undefined;
  const page = createMemo(() => {
    signals.rev();
    return props.editor.store.getPage(props.editor.currentPageId);
  });
  const pages = createMemo(() => {
    signals.rev();
    return props.editor.store.listPages();
  });
  const selected = createMemo(() => {
    signals.rev();
    const ids = [...signals.selection()];
    const id = ids.length === 1 ? ids[0] : undefined;
    return id ? props.editor.store.get(id) : undefined;
  });
  const formats = createMemo(() => {
    signals.rev();
    return [
      { id: "svg", label: "SVG", enabled: true },
      { id: "png", label: "PNG", enabled: true },
      { id: "pdf", label: "PDF", enabled: true },
      {
        id: "mermaid",
        label: "Mermaid",
        enabled:
          availableMermaidKinds(
            props.editor.getSnapshot(),
            props.editor.currentPageId,
          ).length > 0,
      },
      { id: "html", label: "HTML", enabled: true },
      { id: "d2", label: "D2", enabled: true },
      { id: "drawio", label: "draw.io", enabled: true },
      {
        id: "sql",
        label: "SQL",
        enabled: props.editor.store
          .getPageElements(props.editor.currentPageId)
          .some((e) => e.type === "erd.table" || isDatabaseObjectType(e.type)),
      },
      { id: "bpmn", label: "BPMN", enabled: page()?.kind === "bpmn" },
      {
        id: "breadboard",
        label: "Breadboard",
        enabled: breadboardExportEnabled(
          page()?.kind,
          props.exportBreadboard !== undefined,
        ),
      },
      {
        id: "pcb",
        label: "PCB",
        enabled: pcbExportEnabled(page()?.kind, props.exportPcb !== undefined),
      },
      { id: "code", label: "Code", enabled: selected() !== undefined },
    ] satisfies readonly { id: Format; label: string; enabled: boolean }[];
  });
  // Switching pages or deleting the selection cannot leave an unavailable panel active.
  const active = () =>
    formats().find((t) => t.id === format())?.enabled ? format() : "svg";
  const formatGroups: readonly { label: string; ids: readonly Format[] }[] = [
    { label: "Artwork", ids: ["svg", "png", "pdf"] },
    {
      label: "Diagram source",
      ids: ["mermaid", "d2", "drawio", "sql", "bpmn", "breadboard"],
    },
    { label: "Fabrication", ids: ["pcb"] },
    { label: "Web & developer", ids: ["html", "code"] },
  ];
  const descriptions: Record<Format, string> = {
    svg: "Scalable vector artwork for editing and sharing.",
    png: "A raster image with adjustable resolution and background.",
    pdf: "A document sized to your artwork or a printed page.",
    mermaid: "Editable Mermaid source for ER, UML and sequence diagrams.",
    d2: "Editable D2 diagram source.",
    drawio: "An editable .drawio file for draw.io (diagrams.net).",
    sql: "Database schema SQL in your preferred dialect.",
    bpmn: "BPMN 2.0 XML for other process modeling tools.",
    breadboard:
      "BOM and netlists for other circuit tools, and PCB files for board houses such as JLCPCB.",
    pcb: "Gerber copper, solder mask, silkscreen, outline and drill files.",
    html: "A website ZIP containing artboard HTML, CSS and assets.",
    code: "Design details, web code and native code for the selected element.",
  };
  const artworkFormat = (): ExportFormat | undefined => {
    const value = active();
    return value === "svg" || value === "png" || value === "pdf"
      ? value
      : undefined;
  };
  onMount(() => {
    const previous = document.activeElement;
    dialog?.showModal();
    dialog
      ?.querySelector<HTMLSelectElement>('[aria-label="Export format"]')
      ?.focus();
    onCleanup(() => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    });
  });
  return (
    <dialog
      ref={dialog}
      class="nodetto-export-dialog"
      aria-labelledby="nodetto-export-title"
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
    >
      <header>
        <h2 id="nodetto-export-title">Export</h2>
        <button type="button" onClick={props.onClose} aria-label="Close export">
          Close
        </button>
      </header>
      <div class="nodetto-export-choices">
        <label>
          Page
          <select
            aria-label="Export page"
            value={page()?.id ?? ""}
            onChange={(event) =>
              props.editor.setCurrentPage(event.currentTarget.value)
            }
          >
            <For each={pages()}>
              {(item) => (
                <option value={item.id}>
                  {item.name} ({item.kind}) · {shortPageId(item.id)}
                </option>
              )}
            </For>
          </select>
        </label>
        <label>
          Format
          <select
            aria-label="Export format"
            aria-describedby="nodetto-export-description"
            value={active()}
            onChange={(event) => {
              const value = formats().find(
                (item) => item.id === event.currentTarget.value,
              );
              if (value?.enabled) setFormat(value.id);
            }}
          >
            <For each={formatGroups}>
              {(group) => (
                <optgroup label={group.label}>
                  <For each={group.ids}>
                    {(id) => {
                      const item = () =>
                        formats().find((entry) => entry.id === id);
                      return (
                        <option value={id} disabled={!item()?.enabled}>
                          {item()?.label}
                        </option>
                      );
                    }}
                  </For>
                </optgroup>
              )}
            </For>
          </select>
        </label>
        <p id="nodetto-export-description">{descriptions[active()]}</p>
      </div>
      <div class="nodetto-export-panel" id="nodetto-export-panel">
        <Suspense fallback={<p role="status">Loading…</p>}>
          <Switch>
            <Match when={artworkFormat()}>
              {(format) => (
                <Artwork
                  editor={props.editor}
                  format={format()}
                  save={props.saveArtwork}
                  hasSelection={signals.selection().size > 0}
                  id={selected()?.type === "frame" ? selected()?.id : undefined}
                />
              )}
            </Match>
            <Match when={active() === "html"}>
              <HtmlExportSection
                id={selected()?.type === "frame" ? selected()?.id : undefined}
                editor={props.editor}
                save={props.saveHtmlBundle}
              />
            </Match>
            <Match when={active() === "mermaid"}>
              <Mermaid
                editor={props.editor}
                pageId={props.editor.currentPageId}
              />
            </Match>
            <Match when={active() === "d2"}>
              <D2 editor={props.editor} pageId={props.editor.currentPageId} />
            </Match>
            <Match when={active() === "drawio"}>
              <Drawio
                editor={props.editor}
                pageId={props.editor.currentPageId}
              />
            </Match>
            <Match when={active() === "sql"}>
              <Database
                editor={props.editor}
                pageId={props.editor.currentPageId}
              />
            </Match>
            <Match when={active() === "bpmn"}>
              <button type="button" onClick={() => void props.exportBpmn()}>
                Export .bpmn
              </button>
            </Match>
            <Match when={active() === "breadboard"}>
              <For each={BREADBOARD_EXPORTS}>
                {(item) => (
                  <button
                    type="button"
                    onClick={() => void props.exportBreadboard?.(item.kind)}
                  >
                    {item.label}
                  </button>
                )}
              </For>
            </Match>
            <Match when={active() === "pcb"}>
              <button type="button" onClick={() => void props.exportPcb?.()}>
                Gerber and drill (.zip)
              </button>
            </Match>
            <Match when={active() === "code" && selected()}>
              {(element) => <Code editor={props.editor} id={element().id} />}
            </Match>
          </Switch>
        </Suspense>
        <Show when={props.error}>
          {(error) => <p role="alert">{error()}</p>}
        </Show>
      </div>
    </dialog>
  );
}
