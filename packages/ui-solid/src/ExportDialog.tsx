import {
  HtmlExportSection,
  type SaveHtmlBundle,
} from "./inspector/HtmlExportSection.tsx";
import { isDatabaseObjectType, shortPageId } from "@nodetto/ir";
import {
  type Editor,
  fabricationLayerGroups,
  orderedTopLevelFrames,
  frameFileStem,
  prototypeFlows,
  exportPrototypeHtml,
} from "@nodetto/core";
import { encodeStoredZip } from "../../core/src/zip.ts";
import { rasterizeSvg } from "./raster-export.ts";
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
  | "gerber"
  | "pcb"
  | "code"
  | "html"
  | "artboards"
  | "prototype";

export interface ExportDialogProps {
  readonly editor: Editor;
  readonly saveArtwork?: SaveArtwork;
  readonly saveHtmlBundle?: SaveHtmlBundle;
  readonly exportBpmn: () => Promise<void>;
  readonly exportBreadboard?: (kind: BreadboardExportKind) => Promise<void>;
  /** Gerber and drill ZIP of a page drawn by Gerber import. */
  readonly exportGerber?: () => Promise<void>;
  readonly exportPcb?: () => Promise<void>;
  readonly error?: string | null;
  readonly onClose: () => void;
  readonly onCompare?: () => void;
}

export function ExportDialog(props: ExportDialogProps): JSX.Element {
  const signals = createEditorSignals(props.editor);
  // A board is exported for fabrication far more often than as artwork.
  const [format, setFormat] = createSignal<Format>(
    props.exportPcb &&
      props.editor.store.getPage(props.editor.currentPageId)?.kind === "pcb"
      ? "pcb"
      : "svg",
  );
  const [artboardFormat, setArtboardFormat] = createSignal<"png" | "svg">(
    "png",
  );
  const [scale, setScale] = createSignal(2);
  const [flow, setFlow] = createSignal("");
  const [device, setDevice] = createSignal(true);
  const [exportError, setExportError] = createSignal("");
  const [exportBusy, setExportBusy] = createSignal(false);
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
      { id: "artboards", label: "All artboards (ZIP)", enabled: true },
      { id: "prototype", label: "Prototype (HTML)", enabled: true },
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
        id: "gerber",
        label: "Gerber",
        enabled:
          props.exportGerber !== undefined &&
          fabricationLayerGroups(
            props.editor.getSnapshot(),
            props.editor.currentPageId,
          ).length > 0,
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
    { label: "Artwork", ids: ["svg", "png", "pdf", "artboards"] },
    {
      label: "Diagram source",
      ids: ["mermaid", "d2", "drawio", "sql", "bpmn", "breadboard", "gerber"],
    },
    { label: "Fabrication", ids: ["pcb"] },
    { label: "Web & developer", ids: ["html", "prototype", "code"] },
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
    gerber:
      "The imported board's Gerber and drill files with your edits, for a board house. Nothing is checked.",
    pcb: "Gerber copper, solder mask, silkscreen, outline and drill files.",
    html: "A website ZIP containing artboard HTML, CSS and assets.",
    code: "Design details, web code and native code for the selected element.",
    artboards: "Export each artboard as an image in a ZIP archive.",
    prototype: "Export a self-contained interactive prototype.",
  };
  const artworkFormat = (): ExportFormat | undefined => {
    const value = active();
    return value === "svg" || value === "png" || value === "pdf"
      ? value
      : undefined;
  };
  const flows = createMemo(() => {
    signals.rev();
    return prototypeFlows(
      props.editor.store,
      props.editor.createShapeContext(),
    ).flows.filter(
      (item) =>
        props.editor.store.get(item.startId)?.page ===
        props.editor.currentPageId,
    );
  });
  const saveFile = async (name: string, blob: Blob, extension: string) => {
    if (props.saveHtmlBundle)
      return props.saveHtmlBundle(name, blob, extension);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  };
  const runExtraExport = async () => {
    if (exportBusy()) return;
    setExportBusy(true);
    setExportError("");
    try {
      if (active() === "prototype") {
        const html = exportSelectedPrototype(props.editor, flow(), device());
        await saveFile(
          "prototype.html",
          new Blob([html], { type: "text/html" }),
          "html",
        );
      } else {
        const bytes = await exportArtboardsZip(
          props.editor,
          artboardFormat(),
          scale(),
        );
        await saveFile(
          "artboards.zip",
          new Blob([bytes], { type: "application/zip" }),
          "zip",
        );
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExportBusy(false);
    }
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
            <Match when={active() === "artboards"}>
              <section>
                <label>
                  Image format
                  <select
                    aria-label="Artboard image format"
                    value={artboardFormat()}
                    onChange={(e) =>
                      setArtboardFormat(
                        e.currentTarget.value === "svg" ? "svg" : "png",
                      )
                    }
                  >
                    <option value="png">PNG</option>
                    <option value="svg">SVG</option>
                  </select>
                </label>
                <Show when={artboardFormat() === "png"}>
                  <label>
                    Resolution
                    <select
                      aria-label="Artboard export scale"
                      value={scale()}
                      onChange={(e) => setScale(Number(e.currentTarget.value))}
                    >
                      <option value="1">1×</option>
                      <option value="2">2×</option>
                      <option value="3">3×</option>
                    </select>
                  </label>
                </Show>
                <button
                  type="button"
                  disabled={exportBusy()}
                  onClick={() => void runExtraExport()}
                >
                  Export artboards ZIP
                </button>
              </section>
            </Match>
            <Match when={active() === "prototype"}>
              <section>
                <label>
                  Flow
                  <select
                    aria-label="Prototype flow"
                    value={flow()}
                    onChange={(e) => setFlow(e.currentTarget.value)}
                  >
                    <option value="">Default</option>
                    <For each={flows()}>
                      {(item) => <option value={item.name}>{item.name}</option>}
                    </For>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={device()}
                    onChange={(e) => setDevice(e.currentTarget.checked)}
                  />{" "}
                  Show device frame
                </label>
                <button
                  type="button"
                  disabled={exportBusy()}
                  onClick={() => void runExtraExport()}
                >
                  Export prototype HTML
                </button>
              </section>
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
            <Match when={active() === "gerber"}>
              <button type="button" onClick={() => void props.exportGerber?.()}>
                Gerber and drill (.zip)
              </button>
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
        <Show when={exportError()}>
          <p role="alert">{exportError()}</p>
        </Show>
        <Show when={props.onCompare}>
          <button type="button" onClick={() => props.onCompare?.()}>
            Compare with reference...
          </button>
        </Show>
        <Show when={props.error}>
          {(error) => <p role="alert">{error()}</p>}
        </Show>
      </div>
    </dialog>
  );
}

/** Generate the ordered artboard archive using the same names as CLI export. */
export async function exportArtboardsZip(
  editor: Editor,
  format: "png" | "svg",
  scale: number,
  rasterize = rasterizeSvg,
): Promise<Uint8Array> {
  const ids = orderedTopLevelFrames(
    editor.store,
    editor.currentPageId,
    editor.createShapeContext(),
  );
  if (!ids.length) throw new Error("Create an artboard to export.");
  const files = [];
  for (const [index, id] of ids.entries()) {
    const frame = editor.store.get(id);
    const svg = editor.exportArtboardSvg(id);
    if (!frame || !svg) throw new Error("Cannot export an artboard.");
    const contents =
      format === "svg"
        ? new TextEncoder().encode(svg)
        : new Uint8Array(await (await rasterize(svg, scale)).arrayBuffer());
    files.push({
      path: `${frameFileStem(index, (frame.semantic as { name?: string }).name ?? "Frame")}.${format}`,
      contents,
    });
  }
  return encodeStoredZip(files, "Artboards");
}

/** Export the flow chosen in the prototype panel. */
export function exportSelectedPrototype(
  editor: Editor,
  flow: string,
  device: boolean,
): string {
  return exportPrototypeHtml(editor, {
    pageId: editor.currentPageId,
    ...(flow ? { flow } : {}),
    device: device ? "frame" : "none",
  });
}
