import type { Editor } from "@nodetto/core";
import type { PageId } from "@nodetto/ir";
import { type Accessor, createSignal, type JSX } from "solid-js";
import {
  STL_IMPORT_NOTE,
  STL_MAX_BYTES,
  STL_SIZE_ERROR,
  stlToMeshCommands,
} from "./mesh-io.ts";
import { cadAuthoringIds, lastElementIndex } from "./sketch-authoring.ts";

/**
 * STL import for one CAD page: a hidden file input, the drop target rules
 * and the notice line. An import is dropped when the page, the document or
 * the editing rights change while the file is being read.
 */
export function createStlImport(options: {
  readonly editor: Editor;
  readonly pageId: PageId;
  /** False before the viewport mounts and after it is removed. */
  readonly active: () => boolean;
}): {
  readonly notice: Accessor<string | undefined>;
  clearNotice(): void;
  openPicker(): void;
  dropEffect(): "copy" | "none";
  drop(files: FileList): void;
  readonly Input: () => JSX.Element;
} {
  const { editor, pageId } = options;
  const [notice, setNotice] = createSignal<string>();
  let fileInput!: HTMLInputElement;
  let importing = false;
  let pickerRevision: number | undefined;

  function canImport(documentRevision: number): boolean {
    return (
      options.active() &&
      !editor.readOnly &&
      editor.currentPageId === pageId &&
      editor.documentOpenRevision === documentRevision &&
      editor.canCreateOn(pageId, "cad.mesh")
    );
  }

  const ready = (version: number) => canImport(version) && !importing;

  async function importStl(
    file: File,
    documentRevision: number,
  ): Promise<void> {
    if (!ready(documentRevision)) return;
    if (!/\.stl$/i.test(file.name)) {
      setNotice("Choose an STL file.");
      return;
    }
    if (file.size > STL_MAX_BYTES) {
      setNotice(STL_SIZE_ERROR);
      return;
    }
    importing = true;
    setNotice(undefined);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!canImport(documentRevision)) return;
      const elements = editor.store.getPageElements(pageId);
      const result = stlToMeshCommands(
        pageId,
        bytes,
        file.name,
        cadAuthoringIds(elements),
        lastElementIndex(elements),
      );
      if ("error" in result) {
        setNotice(result.error);
        return;
      }
      editor.apply(result.commands);
      setNotice(STL_IMPORT_NOTE);
    } catch {
      if (canImport(documentRevision))
        setNotice("Could not import the STL file.");
    } finally {
      importing = false;
    }
  }

  return {
    notice,
    clearNotice: () => setNotice(undefined),
    openPicker() {
      const version = editor.documentOpenRevision;
      if (!ready(version)) return;
      pickerRevision = version;
      fileInput.click();
    },
    dropEffect: () => (ready(editor.documentOpenRevision) ? "copy" : "none"),
    drop(files) {
      const version = editor.documentOpenRevision;
      if (!ready(version)) return;
      const file = files[0];
      if (files.length === 1 && file) void importStl(file, version);
      else setNotice("Drop one STL file at a time.");
    },
    Input: () => (
      <input
        ref={fileInput}
        type="file"
        accept=".stl"
        hidden
        on:change={() => {
          const file = fileInput.files?.[0];
          const version = pickerRevision;
          pickerRevision = undefined;
          fileInput.value = "";
          if (file && version !== undefined) void importStl(file, version);
        }}
      />
    ),
  };
}
