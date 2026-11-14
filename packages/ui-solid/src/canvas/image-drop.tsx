// Dropping raster image files onto the canvas: the drag feedback, the
// import itself, and the status and error banners shown while it runs.

import type { Editor } from "@nodetto/core";
import { type Accessor, createSignal, type JSX, Show } from "solid-js";
import { importRasterFiles } from "../image-import.ts";
import { clientToPage } from "./geometry.ts";

export interface ImageDrop {
  readonly active: Accessor<boolean>;
  readonly busy: Accessor<boolean>;
  readonly error: Accessor<string>;
  dismissError(): void;
  onDragEnter(event: DragEvent): void;
  onDragOver(event: DragEvent): void;
  onDragLeave(event: DragEvent & { currentTarget: HTMLElement }): void;
  onDrop(event: DragEvent): void;
}

export function createImageDrop(
  props: { readonly editor: Editor },
  container: () => HTMLElement | undefined,
): ImageDrop {
  const [imageDropActive, setImageDropActive] = createSignal(false);
  const [imageImportBusy, setImageImportBusy] = createSignal(false);
  const [imageImportError, setImageImportError] = createSignal("");

  const carriesFiles = (event: DragEvent): boolean =>
    Array.from(event.dataTransfer?.types ?? []).includes("Files");

  const importDrop = async (event: DragEvent): Promise<void> => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setImageDropActive(false);
    if (imageImportBusy() || props.editor.readOnly) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) return;
    const point = clientToPage(props.editor, container(), event);
    setImageImportBusy(true);
    setImageImportError("");
    try {
      await importRasterFiles(props.editor, files, point);
    } catch (cause) {
      setImageImportError(
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setImageImportBusy(false);
    }
  };

  return {
    active: imageDropActive,
    busy: imageImportBusy,
    error: imageImportError,
    dismissError: () => setImageImportError(""),
    onDragEnter: (event) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setImageDropActive(!props.editor.readOnly);
    },
    onDragOver: (event) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer)
        event.dataTransfer.dropEffect = props.editor.readOnly ? "none" : "copy";
      setImageDropActive(!props.editor.readOnly);
    },
    onDragLeave: (event) => {
      const next = event.relatedTarget;
      if (next && event.currentTarget.contains(next as Node)) return;
      setImageDropActive(false);
    },
    onDrop: (event) => void importDrop(event),
  };
}

/** The drop hint or import progress, and the last import error. */
export function ImageDropStatus(props: {
  readonly drop: ImageDrop;
}): JSX.Element {
  return (
    <>
      <Show when={props.drop.active() || props.drop.busy()}>
        <div class="nodetto-image-drop-overlay" role="status">
          {props.drop.busy()
            ? "Importing images…"
            : "Drop PNG, JPEG, WebP or GIF images"}
        </div>
      </Show>
      <Show when={props.drop.error()}>
        <div class="nodetto-image-drop-error" role="alert">
          <span>{props.drop.error()}</span>
          <button type="button" onClick={() => props.drop.dismissError()}>
            Dismiss
          </button>
        </div>
      </Show>
    </>
  );
}
