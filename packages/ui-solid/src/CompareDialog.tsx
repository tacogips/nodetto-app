import type { Editor } from "@nodetto/core";
import { parseBand } from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import {
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  type JSX,
} from "solid-js";
import { encodeStoredZip } from "../../core/src/zip.ts";
import { buildComparisons } from "./compare-dialog.ts";
import { rasterizeSvg } from "./raster-export.ts";
import type { SaveHtmlBundle } from "./inspector/HtmlExportSection.tsx";

export function CompareDialog(props: {
  editor: Editor;
  artboardIds: readonly ElementId[];
  save?: SaveHtmlBundle;
  onClose: () => void;
}): JSX.Element {
  let dialog: HTMLDialogElement | undefined;
  const [files, setFiles] = createSignal<File[]>([]);
  const [scale, setScale] = createSignal(2);
  const [grid, setGrid] = createSignal(0);
  const [bands, setBands] = createSignal<string[]>([]);
  const [items, setItems] = createSignal<
    Awaited<ReturnType<typeof buildComparisons>>["items"]
  >([]);
  const [index, setIndex] = createSignal(0);
  const [preview, setPreview] = createSignal("");
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const setPreviewSvg = (svg: string) => {
    if (preview()) URL.revokeObjectURL(preview());
    setPreview(
      svg
        ? URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
        : "",
    );
  };
  onMount(() => dialog?.showModal());
  onCleanup(() => {
    if (preview()) URL.revokeObjectURL(preview());
    dialog?.close();
  });
  const run = async () => {
    setBusy(true);
    setError("");
    setItems([]);
    setPreviewSvg("");
    try {
      const references = await Promise.all(
        files().map(async (file) => {
          if (file.size > 16 * 1024 * 1024)
            throw new Error(`${file.name} is too large (maximum 16 MiB).`);
          return {
            name: file.name,
            bytes: new Uint8Array(await file.arrayBuffer()),
          };
        }),
      );
      const result = await buildComparisons({
        editor: props.editor,
        artboardIds: props.artboardIds,
        references,
        scale: scale(),
        bands: bands().map(parseBand),
        grid: grid() || undefined,
        rasterize: async (svg, s) =>
          new Uint8Array(await (await rasterizeSvg(svg, s)).arrayBuffer()),
      });
      setItems(result.items);
      setIndex(0);
      setPreviewSvg(result.items[0]?.svg ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const show = (i: number) => {
    setIndex(i);
    setPreviewSvg(items()[i]?.svg ?? "");
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const entries = await Promise.all(
        items().map(async (item) => ({
          path: `${String(item.number).padStart(2, "0")}-compare.png`,
          contents: new Uint8Array(
            await (await rasterizeSvg(item.svg, 1)).arrayBuffer(),
          ),
        })),
      );
      const single = entries.length === 1;
      const bytes = single
        ? entries[0].contents
        : encodeStoredZip(entries, "Comparisons");
      const extension = single ? "png" : "zip";
      const name = single ? entries[0].path : "comparisons.zip";
      const blob = new Blob([bytes], {
        type: single ? "image/png" : "application/zip",
      });
      if (props.save) await props.save(name, blob, extension);
      else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      class="nodetto-export-dialog"
      onCancel={(e) => {
        e.preventDefault();
        props.onClose();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header>
        <h2>Compare with reference</h2>
        <button type="button" onClick={props.onClose}>
          Close
        </button>
      </header>
      <label>
        PNG references{" "}
        <input
          type="file"
          accept="image/png"
          multiple={props.artboardIds.length !== 1}
          onChange={(e) => setFiles(Array.from(e.currentTarget.files ?? []))}
        />
      </label>
      <label>
        Scale{" "}
        <select
          value={scale()}
          onChange={(e) => setScale(Number(e.currentTarget.value))}
        >
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </label>
      <label>
        Grid{" "}
        <select
          value={grid()}
          onChange={(e) => setGrid(Number(e.currentTarget.value))}
        >
          <option value="0">None</option>
          <option value="4">4</option>
          <option value="8">8</option>
        </select>
      </label>
      <For each={bands()}>
        {(band, i) => (
          <div>
            <label>
              Band y0:y1:dy{" "}
              <input
                value={band}
                onInput={(e) =>
                  setBands((old) =>
                    old.map((v, n) => (n === i() ? e.currentTarget.value : v)),
                  )
                }
              />
            </label>
            <button
              type="button"
              onClick={() => setBands((old) => old.filter((_, n) => n !== i()))}
            >
              Remove
            </button>
          </div>
        )}
      </For>
      <button
        type="button"
        onClick={() => setBands((old) => [...old, "0:844:0"])}
      >
        Add band
      </button>
      <button type="button" disabled={busy()} onClick={() => void run()}>
        Compare
      </button>
      <Show when={error()}>
        <p role="alert">{error()}</p>
      </Show>
      <Show when={items().length > 0}>
        <div>
          <For each={items()[index()]?.warnings}>
            {(warning) => <p role="status">{warning}</p>}
          </For>
          <img
            src={preview()}
            alt="Reference, artboard, and difference comparison"
            style={{ "max-width": "100%" }}
          />
          <div>
            <button
              type="button"
              disabled={index() === 0}
              onClick={() => show(index() - 1)}
            >
              Previous
            </button>
            <span>
              {index() + 1} / {items().length}
            </span>
            <button
              type="button"
              disabled={index() + 1 >= items().length}
              onClick={() => show(index() + 1)}
            >
              Next
            </button>
            <button type="button" disabled={busy()} onClick={() => void save()}>
              Save PNG
            </button>
          </div>
        </div>
      </Show>
    </dialog>
  );
}
